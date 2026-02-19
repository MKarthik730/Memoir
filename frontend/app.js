/* Memoir App - Complete with debugging */
const API_BASE = 'http://127.0.0.1:8000';

function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  if (!t) return; 
  t.textContent = msg; 
  t.style.background = ok ? 'var(--deep)' : '#a33';
  t.classList.add('show'); 
  setTimeout(()=>t.classList.remove('show'), 3500);
}

async function postJSON(path, body){
  const token = localStorage.getItem('memoir_token');
  const headers = {'Content-Type':'application/json'};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  console.log('📤 POST:', API_BASE + path, body);
  const res = await fetch(API_BASE + path, {
    method:'POST', headers, body:JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  console.log('📥 Response:', res.status, data);
  if (!res.ok) throw data; 
  return data;
}

async function getJSON(path){
  const token = localStorage.getItem('memoir_token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  console.log('📤 GET:', API_BASE + path);
  const res = await fetch(API_BASE + path, { headers });
  const data = await res.json().catch(()=>({}));
  console.log('📥 Response:', res.status, data);
  if (!res.ok) throw data;
  return data;
}

async function deleteJSON(path){
  const token = localStorage.getItem('memoir_token');
  console.log('📤 DELETE:', API_BASE + path);
  const res = await fetch(API_BASE + path, {
    method:'DELETE',
    headers: {'Authorization': 'Bearer ' + token}
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw data;
  return data;
}

// Login page
if (document.getElementById('loginForm')){
  document.getElementById('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;
    try{
      const data = await postJSON('/login', {name, password});
      if (data.access_token){
        localStorage.setItem('memoir_token', data.access_token);
        localStorage.setItem('memoir_username', data.username || name);
        localStorage.setItem('memoir_user_id', data.user_id);
        showToast('Logged in — redirecting...');
        setTimeout(()=>location.href='memoir_dashboard.html',600);
      } else throw data;
    }catch(err){
      showToast(err.detail||'Login failed', false);
    }
  });
}

// Signup page
if (document.getElementById('signupForm')){
  document.getElementById('signupForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const password = document.getElementById('signupPassword').value;
    try{
      await postJSON('/sign_up', {name, password});
      showToast('Account created — please sign in');
      setTimeout(()=>location.href='index.html',900);
    }catch(err){
      showToast(err.detail||'Sign up failed', false);
    }
  });
}

// Dashboard page
if (document.body.classList.contains('page-dashboard')){
  console.log('🚀 Dashboard initialized');
  
  const token = localStorage.getItem('memoir_token');
  const username = localStorage.getItem('memoir_username') || 'User';
  
  if (!token){ 
    console.log('❌ No token - redirecting to login');
    location.href='index.html'; 
  }

  // Set user info
  const userEl = document.getElementById('username');
  const avatar = document.getElementById('userAvatar');
  if (userEl) userEl.textContent = username;
  if (avatar) avatar.textContent = username.charAt(0).toUpperCase();

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', ()=>{ 
    localStorage.clear();
    location.href='index.html'; 
  });

  // State
  let categories = [];
  let currentCategory = null;
  let currentPerson = null;

  // Get DOM elements
  const elements = {
    categoriesContainer: document.getElementById('categoriesContainer'),
    peopleContainer: document.getElementById('peopleContainer'),
    filesContainer: document.getElementById('filesContainer'),
    categoryView: document.getElementById('categoryView'),
    personView: document.getElementById('personView'),
    fileView: document.getElementById('fileView'),
    galleryView: document.getElementById('galleryView'),
    galleryContainer: document.getElementById('galleryContainer'),
    imageModal: document.getElementById('imageModal'),
    imageModalImg: document.getElementById('imageModalImg'),
    imageModalTitle: document.getElementById('imageModalTitle'),
    imageModalMeta: document.getElementById('imageModalMeta'),
    imageModalDesc: document.getElementById('imageModalDesc'),
    imageModalClose: document.getElementById('imageModalClose'),
    imageModalOverlay: document.getElementById('imageModalOverlay'),
    categoryModal: document.getElementById('categoryModal'),
    personModal: document.getElementById('personModal'),
    categoryForm: document.getElementById('categoryForm'),
    personForm: document.getElementById('personForm'),
    categoryNameInput: document.getElementById('categoryNameInput'),
    personNameInput: document.getElementById('personNameInput'),
    memoryTextInput: document.getElementById('memoryTextInput'),
    addMemoryBtn: document.getElementById('addMemoryBtn'),
    viewBtn: document.getElementById('viewBtn'),
    downloadPdfBtn: document.getElementById('downloadPdfBtn'),
    downloadGalleryPdfBtn: document.getElementById('downloadGalleryPdfBtn'),
    galleryMemoryTextInput: document.getElementById('galleryMemoryTextInput'),
    galleryAddMemoryBtn: document.getElementById('galleryAddMemoryBtn'),
  };

  console.log('✅ Elements loaded:', Object.keys(elements).filter(k=>!!elements[k]).length, '/', Object.keys(elements).length);

  // Modal controls
  document.getElementById('addCategoryBtn')?.addEventListener('click', ()=>{
    console.log('➕ Opening category modal');
    elements.categoryModal.classList.remove('hidden');
    elements.categoryNameInput.focus();
  });

  document.getElementById('closeCategoryModal')?.addEventListener('click', ()=>{
    elements.categoryModal.classList.add('hidden');
    elements.categoryNameInput.value = '';
  });

  document.getElementById('cancelCategoryBtn')?.addEventListener('click', ()=>{
    elements.categoryModal.classList.add('hidden');
    elements.categoryNameInput.value = '';
  });

  document.getElementById('addPersonBtn')?.addEventListener('click', ()=>{
    console.log('➕ Opening person modal');
    elements.personModal.classList.remove('hidden');
    elements.personNameInput.focus();
  });

  document.getElementById('closePersonModal')?.addEventListener('click', ()=>{
    elements.personModal.classList.add('hidden');
    elements.personNameInput.value = '';
  });

  document.getElementById('cancelPersonBtn')?.addEventListener('click', ()=>{
    elements.personModal.classList.add('hidden');
    elements.personNameInput.value = '';
  });

  // Close modals on background click
  elements.categoryModal?.addEventListener('click', (e)=>{
    if (e.target === elements.categoryModal){
      elements.categoryModal.classList.add('hidden');
    }
  });

  elements.personModal?.addEventListener('click', (e)=>{
    if (e.target === elements.personModal){
      elements.personModal.classList.add('hidden');
    }
  });

  // CREATE CATEGORY
  elements.categoryForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = elements.categoryNameInput.value.trim();
    console.log('📁 Creating category:', name);
    
    if (!name) {
      showToast('Please enter a category name', false);
      return;
    }
    
    try{
      await postJSON('/home/category', {cat_name: name});
      showToast('✅ Category created!');
      elements.categoryNameInput.value = '';
      elements.categoryModal.classList.add('hidden');
      await loadCategories();
    }catch(err){
      console.error('❌ Create category error:', err);
      showToast(err.detail || 'Failed to create category', false);
    }
  });

  // CREATE PERSON
  elements.personForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = elements.personNameInput.value.trim();
    console.log('👤 Creating person:', name, 'in category:', currentCategory?.id);
    
    if (!name) {
      showToast('Please enter a person name', false);
      return;
    }
    
    if (!currentCategory) {
      showToast('No category selected', false);
      return;
    }
    
    try{
      await postJSON('/home/person', {
        person_name: name,
        category_id: currentCategory.id
      });
      showToast('✅ Person added!');
      elements.personNameInput.value = '';
      elements.personModal.classList.add('hidden');
      await showCategoryPeople(currentCategory);
    }catch(err){
      console.error('❌ Create person error:', err);
      showToast(err.detail || 'Failed to add person', false);
    }
  });

  // LOAD CATEGORIES
  async function loadCategories(){
    console.log('📁 Loading categories...');
    try{
      categories = await getJSON('/home/categories');
      console.log(`✅ Loaded ${categories.length} categories`);
      renderCategories();
    }catch(e){ 
      console.error('❌ Load categories error:', e);
      showToast('Failed to load categories', false); 
    }
  }

  function renderCategories(){
    const container = elements.categoriesContainer;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!categories.length){
      container.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">👋</div>
          <h3>Welcome to Memoir!</h3>
          <p>Start by creating your first category.</p>
          <p class="hint">Examples: Family, Friends, Travel</p>
          <button class="btn primary btn-large" onclick="document.getElementById('addCategoryBtn').click()">
            Create Your First Category
          </button>
        </div>
      `;
      return;
    }

    categories.forEach(cat=>{
      const el = document.createElement('div');
      el.className = 'category-card';
      el.innerHTML = `
        <div class="card-content">
          <div class="card-icon">📁</div>
          <div class="card-info">
            <div class="card-title">${escapeHtml(cat.cat_name)}</div>
            <div class="card-subtitle muted">Click to view people</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-delete" title="Delete">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      
      el.querySelector('.card-content').addEventListener('click', ()=>showCategoryPeople(cat));
      el.querySelector('.btn-delete').addEventListener('click', async (e)=>{
        e.stopPropagation();
        if (!confirm(`Delete "${cat.cat_name}"?`)) return;
        try{
          await deleteJSON(`/home/category/${cat.id}`);
          showToast('Category deleted');
          loadCategories();
        }catch(err){ showToast('Delete failed', false); }
      });
      
      container.appendChild(el);
    });
  }

  // SHOW CATEGORY PEOPLE
  async function showCategoryPeople(category){
    console.log('👥 Loading people for:', category.cat_name);
    currentCategory = category;
    currentPerson = null;
    
    elements.categoryView.classList.add('hidden');
    elements.personView.classList.remove('hidden');
    elements.fileView.classList.add('hidden');
    
    document.getElementById('categoryTitle').textContent = category.cat_name;

    try{
      const people = await getJSON(`/home/category/${category.id}/people`);
      console.log(`✅ Loaded ${people.length} people`);
      renderPeople(people);
    }catch(e){
      console.error('❌ Load people error:', e);
      showToast('Failed to load people', false);
    }
  }

  function renderPeople(people){
    const container = elements.peopleContainer;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!people.length){
      container.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">👥</div>
          <h3>Add People</h3>
          <p>Who belongs in "${escapeHtml(currentCategory.cat_name)}"?</p>
          <button class="btn primary btn-large" onclick="document.getElementById('addPersonBtn').click()">
            Add First Person
          </button>
        </div>
      `;
      return;
    }

    people.forEach(person=>{
      const el = document.createElement('div');
      el.className = 'person-card';
      el.innerHTML = `
        <div class="card-content">
          <div class="card-icon">👤</div>
          <div class="card-info">
            <div class="card-title">${escapeHtml(person.person_name)}</div>
            <div class="card-subtitle muted">Click to view files</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-delete" title="Delete">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      
      el.querySelector('.card-content').addEventListener('click', ()=>showPersonFiles(person));
      el.querySelector('.btn-delete').addEventListener('click', async (e)=>{
        e.stopPropagation();
        if (!confirm(`Delete "${person.person_name}"?`)) return;
        try{
          await deleteJSON(`/home/person/${person.id}`);
          showToast('Person deleted');
          showCategoryPeople(currentCategory);
        }catch(err){ showToast('Delete failed', false); }
      });
      
      container.appendChild(el);
    });
  }

  // SHOW PERSON FILES
  async function showPersonFiles(person){
    console.log('📄 Loading files and memories for:', person.person_name);
    currentPerson = person;
    
    elements.categoryView.classList.add('hidden');
    elements.personView.classList.add('hidden');
    elements.fileView.classList.remove('hidden');

    document.getElementById('personTitle').textContent = person.person_name;
    document.getElementById('breadcrumbCategory').textContent = currentCategory.cat_name;

    try{
      const [files, memories] = await Promise.all([
        getJSON(`/home/person/${person.id}/files`),
        getJSON(`/home/person/${person.id}/memories`)
      ]);
      console.log(`✅ Loaded ${files.length} files and ${memories.length} memories`);
      renderFilesAndMemories(files, memories);
    }catch(e){
      console.error('❌ Load files/memories error:', e);
      showToast('Failed to load files and memories', false);
    }
  }

  function renderFilesAndMemories(files, memories){
    const container = elements.filesContainer;
    if (!container) return;
    
    container.innerHTML = '';
    
    // Combine and sort by creation date (newest first)
    const allItems = [
      ...files.map(f => ({...f, type: 'file'})),
      ...memories.map(m => ({...m, type: 'memory'}))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (!allItems.length){
      container.innerHTML = `
        <div class="empty-state-small">
          <p>No memories or photos yet for ${escapeHtml(currentPerson.person_name)}.</p>
          <p class="muted">Use the sections above to add memories or upload photos.</p>
        </div>
      `;
      return;
    }

    allItems.forEach(item=>{
      const el = document.createElement('div');
      el.className = item.type === 'file' ? 'file-card' : 'memory-card';
      
      if (item.type === 'file') {
        const isImage = item.file_type && item.file_type.startsWith('image/');
        const imageSrc = `/home/person/${currentPerson.id}/files/${item.id}/download`;
        
        el.innerHTML = `
          <div class="file-meta">
            <div class="file-thumb ${isImage ? 'clickable' : ''}" ${isImage ? `data-image-src="${imageSrc}" data-image-title="${escapeHtml(item.file_name)}" data-image-meta="${escapeHtml(currentCategory.cat_name)} • ${escapeHtml(currentPerson.person_name)} • ${formatDate(item.created_at)}" data-image-desc="${escapeHtml(item.description || '')}"` : ''}>
              ${isImage ? 
                `<img src="${imageSrc}" alt="${escapeHtml(item.file_name)}" class="file-image-thumb" />` :
                getFileIcon(item.file_type)
              }
            </div>
            <div class="file-info">
              <div class="fname">${escapeHtml(item.file_name)}</div>
              <div class="muted small">${item.file_type} • ${formatDate(item.created_at)}</div>
              ${item.description ? `<div class="file-desc">${escapeHtml(item.description)}</div>` : ''}
            </div>
          </div>
          <button class="btn-icon btn-delete-file" title="Delete">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;

        // Add click handler for images
        if (isImage) {
          el.querySelector('.file-thumb').addEventListener('click', function() {
            const src = this.dataset.imageSrc;
            const title = this.dataset.imageTitle;
            const meta = this.dataset.imageMeta;
            const desc = this.dataset.imageDesc;
            openImageModal(src, title, meta, desc);
          });
        }
        
        el.querySelector('.btn-delete-file').addEventListener('click', async ()=>{
          if (!confirm('Delete file?')) return;
          try{
            await deleteJSON(`/home/person/${currentPerson.id}/files/${item.id}`);
            showToast('File deleted');
            showPersonFiles(currentPerson);
          }catch(err){ showToast('Delete failed', false); }
        });
      } else {
        el.innerHTML = `
          <div class="memory-content">
            <div class="memory-text">${escapeHtml(item.content)}</div>
            <div class="memory-meta">
              <span class="muted small">${formatDate(item.created_at)}</span>
              <button class="btn-icon btn-delete-memory" title="Delete memory">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
        
        el.querySelector('.btn-delete-memory').addEventListener('click', async ()=>{
          if (!confirm('Delete memory?')) return;
          try{
            await deleteJSON(`/home/person/${currentPerson.id}/memories/${item.id}`);
            showToast('Memory deleted');
            showPersonFiles(currentPerson);
          }catch(err){ showToast('Delete failed', false); }
        });
      }
      
      container.appendChild(el);
    });
  }

  // NAVIGATION
  document.getElementById('backToCategoriesBtn')?.addEventListener('click', ()=>{
    currentCategory = null;
    currentPerson = null;
    elements.categoryView.classList.remove('hidden');
    elements.personView.classList.add('hidden');
    elements.fileView.classList.add('hidden');
  });

  document.getElementById('backToPeopleBtn')?.addEventListener('click', ()=>{
    currentPerson = null;
    elements.categoryView.classList.add('hidden');
    elements.personView.classList.remove('hidden');
    elements.fileView.classList.add('hidden');
    showCategoryPeople(currentCategory);
  });

  // FILE UPLOAD
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const descInput = document.getElementById('descInput');

  dropZone?.addEventListener('click', ()=>fileInput.click());
  dropZone?.addEventListener('dragover', (e)=>{ e.preventDefault(); dropZone.classList.add('drag'); });
  dropZone?.addEventListener('dragleave', ()=>dropZone.classList.remove('drag'));
  dropZone?.addEventListener('drop', (e)=>{ 
    e.preventDefault(); 
    dropZone.classList.remove('drag'); 
    if (e.dataTransfer.files.length) fileInput.files = e.dataTransfer.files; 
  });

  uploadBtn?.addEventListener('click', ()=>{
    if (!currentPerson) return showToast('Select a person first', false);
    const file = fileInput.files?.[0];
    if (!file) return showToast('Choose a file', false);
    uploadFile(file, descInput.value);
  });

  function uploadFile(file, description){
    const fd = new FormData(); 
    fd.append('file', file); 
    if (description) fd.append('description', description);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/home/person/${currentPerson.id}/upload`);
    xhr.setRequestHeader('Authorization', 'Bearer '+token);
    
    xhr.upload.onprogress = (e)=>{
      if (e.lengthComputable) progressBar.style.width = Math.round((e.loaded/e.total)*100) + '%';
    };
    
    xhr.onload = ()=>{
      progressBar.style.width = '0%';
      progressWrap.classList.add('hidden');
      if (xhr.status>=200 && xhr.status<300){ 
        showToast('✅ Uploaded!'); 
        fileInput.value=''; 
        descInput.value=''; 
        showPersonFiles(currentPerson); 
      } else { 
        showToast('Upload failed', false); 
      }
    };
    
    progressWrap.classList.remove('hidden');
    xhr.send(fd);
  }

  function getFileIcon(type){
    if (!type) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎬';
    if (type.includes('audio')) return '🎵';
    if (type.includes('pdf')) return '📕';
    return '📄';
  }

  function escapeHtml(s){ 
    return (s||'').replace(/[&<>"']/g, c=>({ 
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" 
    })[c]); 
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  // MEMORY HANDLING
  elements.addMemoryBtn?.addEventListener('click', async ()=>{
    if (!currentPerson) return showToast('Select a person first', false);
    const content = elements.memoryTextInput.value.trim();
    if (!content) return showToast('Enter some text for your memory', false);
    
    try{
      await postJSON(`/home/person/${currentPerson.id}/memory`, {content});
      showToast('Memory added!');
      elements.memoryTextInput.value = '';
      showPersonFiles(currentPerson);
    }catch(e){
      showToast('Failed to add memory', false);
    }
  });

  // VIEW BUTTON - show all content in gallery
  elements.viewBtn?.addEventListener('click', ()=>{
    showGalleryView();
  });

  // PDF DOWNLOAD
  elements.downloadPdfBtn?.addEventListener('click', ()=>{
    if (currentPerson) {
      downloadMemoriesPdf();
    }
  });

  elements.downloadGalleryPdfBtn?.addEventListener('click', ()=>{
    downloadMemoriesPdf();
  });

  // GALLERY FILTERS - removed

  // GALLERY ADD MEMORY
  elements.galleryAddMemoryBtn?.addEventListener('click', async ()=>{
    const content = elements.galleryMemoryTextInput.value.trim();
    if (!content) {
      showToast('Please enter a memory', false);
      return;
    }
    showToast('Please go to a specific person to add memories', false);
  });

  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.imageModal?.classList.contains('hidden')) {
      closeImageModal();
    }
  });

  let allContent = [];

  async function showGalleryView() {
    console.log('🖼️ Loading gallery view');
    
    elements.categoryView.classList.add('hidden');
    elements.personView.classList.add('hidden');
    elements.fileView.classList.add('hidden');
    elements.galleryView.classList.remove('hidden');

    try {
      const response = await getJSON('/home/user/all-content');
      allContent = response.content;
      console.log(`✅ Loaded ${allContent.length} items`);
      renderGallery(allContent);
    } catch(e) {
      console.error('❌ Load gallery error:', e);
      showToast('Failed to load gallery', false);
    }
  }

  function renderGallery(content) {
    const container = elements.galleryContainer;
    if (!container) return;

    // Only show memories
    const filteredContent = content.filter(item => item.type === 'memory');

    container.innerHTML = '';

    if (!filteredContent.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No memories found.</p>
          <p class="muted">Add some memories to see them here.</p>
        </div>
      `;
      return;
    }

    filteredContent.forEach(item => {
      const el = document.createElement('div');
      el.className = 'gallery-item gallery-memory';

      el.innerHTML = `
        <div class="gallery-thumb">
          <div class="memory-icon">📝</div>
        </div>
        <div class="gallery-info">
          <div class="gallery-title">${escapeHtml(item.content.substring(0, 100))}${item.content.length > 100 ? '...' : ''}</div>
          <div class="gallery-meta">${escapeHtml(item.category_name)} • ${escapeHtml(item.person_name)}</div>
          <div class="gallery-date">${formatDate(item.created_at)}</div>
        </div>
      `;

      container.appendChild(el);
    });
  }

  async function downloadMemoriesPdf() {
    try {
      showToast('Generating PDF...');
      const response = await fetch(`${API_BASE}/home/user/memories/pdf`, {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('memoir_token')
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'PDF generation failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memories.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF downloaded!');
    } catch(e) {
      console.error('PDF download error:', e);
      showToast(e.message || 'Failed to download PDF', false);
    }
  }

  function openImageModal(imageSrc, title, meta, description) {
    elements.imageModalImg.src = imageSrc;
    elements.imageModalImg.alt = title;
    elements.imageModalTitle.textContent = title;
    elements.imageModalMeta.textContent = meta;
    elements.imageModalDesc.textContent = description || '';
    elements.imageModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  function closeImageModal() {
    elements.imageModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }

  // INITIALIZE
  loadCategories();
}