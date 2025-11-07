// Kayko Side Panel JavaScript

let allPrompts = [];
let filteredPrompts = [];
let settings = {};
let showFavoritesOnly = false;

// Initialize
async function init() {
  await loadData();
  setupEventListeners();
  renderPrompts();
  updateStorageInfo();
}

// Load data from storage
async function loadData() {
  const result = await chrome.storage.local.get(['prompts', 'settings']);
  allPrompts = result.prompts || [];
  settings = result.settings || { maxPrompts: 100, excludedSites: [], autoSaveEnabled: true };
  filteredPrompts = [...allPrompts];
}

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  
  // Filters
  document.getElementById('platformFilter').addEventListener('change', applyFilters);
  document.getElementById('dateFilter').addEventListener('change', applyFilters);
  document.getElementById('favoritesFilter').addEventListener('click', toggleFavoritesFilter);
  
  // Footer buttons
  document.getElementById('exportBtn').addEventListener('click', exportPrompts);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importPrompts);
  document.getElementById('clearBtn').addEventListener('click', clearAllPrompts);
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener(handleStorageChange);
}

// Handle search
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  if (query) {
    filteredPrompts = allPrompts.filter(p => 
      p.text.toLowerCase().includes(query) ||
      p.platform.toLowerCase().includes(query)
    );
  } else {
    filteredPrompts = [...allPrompts];
  }
  applyFilters();
}

// Apply filters
function applyFilters() {
  const platformFilter = document.getElementById('platformFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  
  filteredPrompts = [...allPrompts];
  
  // Search filter
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  if (searchQuery) {
    filteredPrompts = filteredPrompts.filter(p => 
      p.text.toLowerCase().includes(searchQuery) ||
      p.platform.toLowerCase().includes(searchQuery)
    );
  }
  
  // Platform filter
  if (platformFilter !== 'all') {
    filteredPrompts = filteredPrompts.filter(p => p.platform === platformFilter);
  }
  
  // Date filter
  if (dateFilter !== 'all') {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    filteredPrompts = filteredPrompts.filter(p => {
      if (dateFilter === 'today') {
        return now - p.timestamp < day;
      } else if (dateFilter === 'week') {
        return now - p.timestamp < 7 * day;
      } else if (dateFilter === 'month') {
        return now - p.timestamp < 30 * day;
      }
      return true;
    });
  }
  
  // Favorites filter
  if (showFavoritesOnly) {
    filteredPrompts = filteredPrompts.filter(p => p.favorite);
  }
  
  renderPrompts();
}

// Toggle favorites filter
function toggleFavoritesFilter() {
  showFavoritesOnly = !showFavoritesOnly;
  const btn = document.getElementById('favoritesFilter');
  btn.classList.toggle('active', showFavoritesOnly);
  applyFilters();
}

// Render prompts
function renderPrompts() {
  const container = document.getElementById('promptsList');
  const emptyState = document.getElementById('emptyState');
  
  if (filteredPrompts.length === 0) {
    emptyState.classList.remove('hidden');
    // Clear existing prompts
    Array.from(container.children).forEach(child => {
      if (child !== emptyState) {
        child.remove();
      }
    });
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Clear existing prompts
  Array.from(container.children).forEach(child => {
    if (child !== emptyState) {
      child.remove();
    }
  });
  
  // Render each prompt
  filteredPrompts.forEach(prompt => {
    const item = createPromptElement(prompt);
    container.appendChild(item);
  });
}

// Create prompt element
function createPromptElement(prompt) {
  const item = document.createElement('div');
  item.className = 'prompt-item';
  item.dataset.id = prompt.id;
  
  const timeAgo = formatTimeAgo(prompt.timestamp);
  const previewText = prompt.text.length > 200 
    ? prompt.text.substring(0, 200) + '...' 
    : prompt.text;
  
  item.innerHTML = `
    <div class="prompt-header">
      <div class="prompt-meta">
        <span class="platform-badge ${prompt.platform}">${prompt.platform}</span>
        <span class="prompt-timestamp">${timeAgo}</span>
      </div>
      <div class="prompt-actions">
        <button class="icon-btn favorite-btn" data-id="${prompt.id}" title="${prompt.favorite ? 'Unfavorite' : 'Favorite'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="${prompt.favorite ? '#F59E0B' : 'none'}" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2L10.163 6.403L15 7.095L11.5 10.507L12.326 15.323L8 13.045L3.674 15.323L4.5 10.507L1 7.095L5.837 6.403L8 2Z" stroke="${prompt.favorite ? '#F59E0B' : 'currentColor'}" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prompt-text" data-id="${prompt.id}">${escapeHtml(previewText)}</div>
    <div class="prompt-footer">
      <button class="btn-sm primary copy-btn" data-id="${prompt.id}">Copy</button>
      <button class="btn-sm expand-btn" data-id="${prompt.id}">View Full</button>
      <button class="btn-sm delete-btn" data-id="${prompt.id}">Delete</button>
    </div>
  `;
  
  // Add event listeners
  item.querySelector('.copy-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    copyPrompt(prompt.id);
  });
  
  item.querySelector('.expand-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleExpand(prompt.id);
  });
  
  item.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deletePrompt(prompt.id);
  });
  
  item.querySelector('.favorite-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(prompt.id);
  });
  
  return item;
}

// Copy prompt to clipboard
async function copyPrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  try {
    await navigator.clipboard.writeText(prompt.text);
    showNotification('Copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
    showNotification('Failed to copy', 'error');
  }
}

// Toggle expand
function toggleExpand(id) {
  const textElement = document.querySelector(`.prompt-text[data-id="${id}"]`);
  const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
  const prompt = allPrompts.find(p => p.id === id);
  
  if (textElement.classList.contains('expanded')) {
    textElement.classList.remove('expanded');
    textElement.textContent = prompt.text.length > 200 
      ? prompt.text.substring(0, 200) + '...' 
      : prompt.text;
    btn.textContent = 'View Full';
  } else {
    textElement.classList.add('expanded');
    textElement.textContent = prompt.text;
    btn.textContent = 'Show Less';
  }
}

// Delete prompt
async function deletePrompt(id) {
  if (!confirm('Are you sure you want to delete this prompt?')) return;
  
  allPrompts = allPrompts.filter(p => p.id !== id);
  await chrome.storage.local.set({ prompts: allPrompts });
  applyFilters();
  updateStorageInfo();
  showNotification('Prompt deleted');
}

// Toggle favorite
async function toggleFavorite(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  prompt.favorite = !prompt.favorite;
  await chrome.storage.local.set({ prompts: allPrompts });
  renderPrompts();
  showNotification(prompt.favorite ? 'Added to favorites' : 'Removed from favorites');
}

// Export prompts
function exportPrompts() {
  const dataStr = JSON.stringify(allPrompts, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kayko-prompts-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showNotification('Prompts exported successfully');
}

// Import prompts
async function importPrompts(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedPrompts = JSON.parse(text);
    
    if (!Array.isArray(importedPrompts)) {
      throw new Error('Invalid format');
    }
    
    // Merge with existing prompts (avoid duplicates)
    const existingIds = new Set(allPrompts.map(p => p.id));
    const newPrompts = importedPrompts.filter(p => !existingIds.has(p.id));
    
    allPrompts = [...newPrompts, ...allPrompts];
    
    // Apply max prompts limit
    if (allPrompts.length > settings.maxPrompts) {
      allPrompts = allPrompts.slice(0, settings.maxPrompts);
    }
    
    await chrome.storage.local.set({ prompts: allPrompts });
    applyFilters();
    updateStorageInfo();
    showNotification(`Imported ${newPrompts.length} new prompts`);
  } catch (error) {
    console.error('Import failed:', error);
    showNotification('Failed to import prompts', 'error');
  }
  
  // Reset file input
  e.target.value = '';
}

// Clear all prompts
async function clearAllPrompts() {
  if (!confirm('Are you sure you want to delete ALL saved prompts? This cannot be undone.')) return;
  
  allPrompts = [];
  await chrome.storage.local.set({ prompts: [] });
  applyFilters();
  updateStorageInfo();
  showNotification('All prompts cleared');
}

// Open settings modal
async function openSettings() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('hidden');
  
  // Populate current settings
  document.getElementById('maxPromptsInput').value = settings.maxPrompts;
  document.getElementById('excludedSitesInput').value = settings.excludedSites.join(', ');
  document.getElementById('autoSaveToggle').checked = settings.autoSaveEnabled !== false;
}

// Close settings modal
function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

// Save settings
async function saveSettings() {
  const maxPrompts = parseInt(document.getElementById('maxPromptsInput').value);
  const excludedSites = document.getElementById('excludedSitesInput').value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const autoSaveEnabled = document.getElementById('autoSaveToggle').checked;
  
  settings = { maxPrompts, excludedSites, autoSaveEnabled };
  await chrome.storage.local.set({ settings });
  
  // Trim prompts if needed
  if (allPrompts.length > maxPrompts) {
    allPrompts = allPrompts.slice(0, maxPrompts);
    await chrome.storage.local.set({ prompts: allPrompts });
    applyFilters();
  }
  
  closeSettings();
  showNotification('Settings saved');
}

// Update storage info
function updateStorageInfo() {
  document.getElementById('promptCount').textContent = allPrompts.length;
}

// Handle storage changes from other contexts
function handleStorageChange(changes, namespace) {
  if (namespace === 'local' && changes.prompts) {
    allPrompts = changes.prompts.newValue || [];
    applyFilters();
    updateStorageInfo();
  }
}

// Format time ago
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'success') {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#EF4444' : '#10B981'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    to {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize on load
init();

