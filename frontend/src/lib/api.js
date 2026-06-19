import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('memoir_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('memoir_token');
      localStorage.removeItem('memoir_user');
      localStorage.removeItem('memoir_user_id');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ─── Family ───────────────────────────────────────────────────────────────────

export const familyAPI = {
  create: (data) => api.post('/family', data).then((r) => r.data),
  get: (id) => api.get(`/family/${id}`).then((r) => r.data),
  getInviteLink: (id) => api.get(`/family/${id}/invite-link`).then((r) => r.data),
  join: (token) => api.post(`/family/join/${token}`).then((r) => r.data),
  getMyFamilies: () => api.get('/user/families').then((r) => r.data),
};

// ─── People ───────────────────────────────────────────────────────────────────

export const peopleAPI = {
  list: (familyId) => api.get(`/family/${familyId}/people`).then((r) => r.data),
  create: (familyId, formData) =>
    api.post(`/family/${familyId}/people`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  get: (id) => api.get(`/people/${id}`).then((r) => r.data),
  update: (id, formData) =>
    api.patch(`/people/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
};

// ─── Relationships ────────────────────────────────────────────────────────────

export const relationshipsAPI = {
  create: (familyId, data) => api.post(`/family/${familyId}/relationships`, data).then((r) => r.data),
  list: (familyId) => api.get(`/family/${familyId}/relationships`).then((r) => r.data),
  delete: (id) => api.delete(`/relationships/${id}`).then((r) => r.data),
};

// ─── Memories ─────────────────────────────────────────────────────────────────

export const memoriesAPI = {
  create: (personId, formData) =>
    api.post(`/people/${personId}/memories`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  list: (personId) => api.get(`/people/${personId}/memories`).then((r) => r.data),
  getPublic: (id) => api.get(`/memories/${id}/public`).then((r) => r.data),
  delete: (id) => api.delete(`/memories/${id}`).then((r) => r.data),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchAPI = {
  search: (familyId, query) =>
    api.post(`/family/${familyId}/search`, { query }).then((r) => r.data),
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

// ─── Feed / Posts / Social Features ───────────────────────────────────────────

export const feedAPI = {
  getFeed: (familyId, cursor, limit = 10) =>
    api.get(`/feed?family_id=${familyId}${cursor ? `&cursor=${cursor}` : ''}&limit=${limit}`).then((r) => r.data),
  createPost: (formData) =>
    api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  toggleLike: (postId) => api.post(`/posts/${postId}/like`).then((r) => r.data),
  addComment: (postId, text) => {
    const fd = new FormData();
    fd.append('text', text);
    return api.post(`/posts/${postId}/comment`, fd).then((r) => r.data);
  },
  getComments: (postId) => api.get(`/posts/${postId}/comments`).then((r) => r.data),
};

export const storiesAPI = {
  getActive: (familyId) => api.get(`/stories?family_id=${familyId}`).then((r) => r.data),
  create: (formData) =>
    api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  markViewed: (storyId) => api.post(`/stories/${storyId}/view`).then((r) => r.data),
};

export const vaultAPI = {
  list: (familyId, folder, fileType) => {
    let url = `/vault?family_id=${familyId}`;
    if (folder && folder !== 'All') url += `&folder=${encodeURIComponent(folder)}`;
    if (fileType) url += `&file_type=${fileType}`;
    return api.get(url).then((r) => r.data);
  },
  upload: (formData) =>
    api.post('/vault/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  delete: (itemId) => api.delete(`/vault/${itemId}`).then((r) => r.data),
};

export const notificationsAPI = {
  list: () => api.get('/notifications').then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
};

export const birthdaysAPI = {
  getUpcoming: (familyId) => api.get(`/birthdays?family_id=${familyId}`).then((r) => r.data),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default api;
