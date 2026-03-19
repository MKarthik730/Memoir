/* Memoir App - Modern UI JavaScript */
const API_BASE = 'http://127.0.0.1:8000';

// API Functions
async function postJSON(path, body) {
  const token = localStorage.getItem('memoir_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function getJSON(path) {
  const token = localStorage.getItem('memoir_token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  const res = await fetch(API_BASE + path, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function deleteJSON(path) {
  const token = localStorage.getItem('memoir_token');
  const res = await fetch(API_BASE + path, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

// Toast Notification System
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check',
    error: 'fa-times',
    warning: 'fa-exclamation',
    info: 'fa-info'
  };
  
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${icons[type]}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title || titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  container.appendChild(toast);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });
  
  setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// Utility Functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
  }
  
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Modal Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Confirm Dialog
function showConfirm(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 400px;">
      <div class="modal-body">
        <div class="confirm-modal">
          <div class="confirm-icon">⚠️</div>
          <h3 class="confirm-title">${escapeHtml(title)}</h3>
          <p class="confirm-message">${escapeHtml(message)}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
            <button class="btn btn-primary" id="confirmOk">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  overlay.querySelector('#confirmCancel').addEventListener('click', () => {
    closeConfirm();
  });
  
  overlay.querySelector('#confirmOk').addEventListener('click', () => {
    closeConfirm();
    if (onConfirm) onConfirm();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeConfirm();
  });
  
  function closeConfirm() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
  }
}

// Skeleton Loader
function createSkeleton(type = 'card') {
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton';
  
  if (type === 'card') {
    skeleton.classList.add('skeleton-card');
  } else if (type === 'text') {
    skeleton.classList.add('skeleton-text');
  } else if (type === 'avatar') {
    skeleton.classList.add('skeleton-avatar');
  }
  
  return skeleton;
}

// Emotion Colors
const EMOTION_COLORS = {
  'happy': '#22c55e',
  'joyful': '#8bc34a',
  'excited': '#f59e0b',
  'grateful': '#06b6d4',
  'nostalgic': '#a855f7',
  'sad': '#3b82f6',
  'angry': '#ef4444',
  'anxious': '#eab308',
  'fearful': '#78716c',
  'disgusted': '#64748b',
  'neutral': '#9ca3af',
  'peaceful': '#ec4899',
  'proud': '#f97316',
  'loving': '#ec4899',
  'difficult': '#64748b',
  'bittersweet': '#8b5cf6'
};

function getEmotionColor(emotion) {
  return EMOTION_COLORS[emotion] || EMOTION_COLORS['neutral'];
}

function getEmotionEmoji(emotion) {
  const emojis = {
    'happy': '😊',
    'joyful': '😄',
    'excited': '🤩',
    'grateful': '🙏',
    'nostalgic': '🥹',
    'sad': '😢',
    'angry': '😤',
    'anxious': '😰',
    'fearful': '😨',
    'disgusted': '🤢',
    'neutral': '😐',
    'peaceful': '😌',
    'proud': '🥳',
    'loving': '❤️',
    'difficult': '😔',
    'bittersweet': '😔'
  };
  return emojis[emotion] || '😐';
}

// Search functionality
function initSearch(inputSelector, itemSelector, searchFields) {
  const input = document.querySelector(inputSelector);
  if (!input) return;
  
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll(itemSelector).forEach(item => {
      const text = searchFields.map(field => {
        const el = item.querySelector(field);
        return el ? el.textContent.toLowerCase() : '';
      }).join(' ');
      
      item.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

// Initialize particle effects
function initParticles(containerId, count = 30) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 5 + 's';
    particle.style.animationDuration = (10 + Math.random() * 10) + 's';
    container.appendChild(particle);
  }
}

// Initialize mobile menu
function initMobileMenu(sidebarId, toggleId) {
  const sidebar = document.getElementById(sidebarId);
  const toggle = document.getElementById(toggleId);
  
  if (!sidebar || !toggle) return;
  
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// Animate on scroll
function initScrollAnimation() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('page-enter-active');
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    el.classList.add('page-enter');
    observer.observe(el);
  });
}

// Tab navigation
function initTabs(containerSelector, activeClass = 'active') {
  const containers = document.querySelectorAll(containerSelector);
  
  containers.forEach(container => {
    const tabs = container.querySelectorAll('[data-tab]');
    const panels = container.querySelectorAll('[data-tab-content]');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove(activeClass));
        panels.forEach(p => p.classList.add('hidden'));
        
        tab.classList.add(activeClass);
        const panel = container.querySelector(`[data-tab-content="${target}"]`);
        if (panel) panel.classList.remove('hidden');
      });
    });
  });
}

// Form validation
function validateForm(formElement) {
  let isValid = true;
  const inputs = formElement.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    input.classList.remove('error', 'success');
    
    if (input.hasAttribute('required') && !input.value.trim()) {
      input.classList.add('error');
      isValid = false;
    } else if (input.value.trim()) {
      input.classList.add('success');
    }
    
    // Email validation
    if (input.type === 'email' && input.value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.value)) {
        input.classList.add('error');
        isValid = false;
      }
    }
    
    // Password validation
    if (input.type === 'password' && input.hasAttribute('minlength')) {
      const minLength = parseInt(input.getAttribute('minlength'));
      if (input.value.length < minLength) {
        input.classList.add('error');
        isValid = false;
      }
    }
  });
  
  return isValid;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Add transition class to all animated elements
  document.querySelectorAll('.memory-card, .glass-card, .stat-card').forEach(el => {
    el.style.transition = 'all 0.3s ease';
  });
  
  // Initialize search on dashboard
  initSearch('#searchInput', '.memory-card', ['.memory-card-content', '.memory-card-person-name']);
  
  // Initialize mobile menu
  initMobileMenu('sidebar', 'menuToggle');
  
  // Initialize scroll animations
  initScrollAnimation();
});

// Export for use in other scripts
window.Memoir = {
  showToast,
  openModal,
  closeModal,
  showConfirm,
  getEmotionColor,
  getEmotionEmoji,
  formatDate,
  escapeHtml,
  validateForm,
  postJSON,
  getJSON,
  deleteJSON,
  API_BASE
};
