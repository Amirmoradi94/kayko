// Kayko Side Panel JavaScript

let allPrompts = [];
let filteredPrompts = [];
let settings = {};
let showFavoritesOnly = false;
let selectedPromptIds = new Set();

// Detect current platform from active tab
async function detectCurrentPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return 'default';
    
    const url = tab.url.toLowerCase();
    if (url.includes('chatgpt.com') || url.includes('openai.com')) return 'chatgpt';
    if (url.includes('claude.ai') || url.includes('anthropic.com')) return 'claude';
    if (url.includes('aistudio.google.com')) return 'aistudio';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('grok.com') || url.includes('x.ai')) return 'grok';
    if (url.includes('perplexity.ai')) return 'perplexity';
    
    return 'default';
  } catch (error) {
    console.error('Error detecting platform:', error);
    return 'default';
  }
}

// Apply theme based on platform
async function applyTheme() {
  const platform = await detectCurrentPlatform();
  
  // Remove all theme classes
  document.body.classList.remove('theme-chatgpt', 'theme-claude', 'theme-gemini', 'theme-grok', 'theme-perplexity', 'theme-aistudio');
  
  // Apply current theme
  if (platform !== 'default') {
    document.body.classList.add(`theme-${platform}`);
  }
}

// Initialize
async function init() {
  await applyTheme();
  await loadData();
  setupEventListeners();
  renderPrompts();
  updateStorageInfo();
  
  // Re-apply theme when tab changes
  chrome.tabs.onActivated.addListener(applyTheme);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      applyTheme();
    }
  });
}

// Load data from storage
async function loadData() {
  const result = await chrome.storage.local.get(['prompts', 'settings']);
  allPrompts = result.prompts || [];
  settings = result.settings || { 
    maxPrompts: 100, 
    excludedSites: [], 
    autoSaveEnabled: true,
    openaiApiKey: ''
  };
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
  
  // Selection checkboxes
  document.getElementById('selectAllCheckbox').addEventListener('change', handleSelectAll);
  document.getElementById('headerDeleteBtn').addEventListener('click', handleHeaderDelete);
  
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
    updateSelectionUI();
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
  
  // Update selection UI after rendering
  updateSelectionUI();
}

// Create prompt element
function createPromptElement(prompt) {
  const item = document.createElement('div');
  item.className = 'prompt-item';
  item.dataset.id = prompt.id;
  
  const timeAgo = formatTimeAgo(prompt.timestamp);
  const isLongPrompt = prompt.text.length > 100;
  const previewText = isLongPrompt 
    ? prompt.text.substring(0, 100) + '...' 
    : prompt.text;
  
  const isSelected = selectedPromptIds.has(prompt.id);
  item.innerHTML = `
    <div class="prompt-header">
      <div class="prompt-meta">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="platform-badge ${prompt.platform.replace(/\s+/g, '-')}">${prompt.platform}</span>
          <span class="prompt-timestamp">${timeAgo}</span>
        </div>
      </div>
      <div class="prompt-actions">
        <button class="icon-btn expand-toggle-btn" data-id="${prompt.id}" title="${isLongPrompt ? 'Expand' : 'Show Full'}">
          <svg class="arrow-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <input type="checkbox" class="prompt-checkbox" data-id="${prompt.id}" ${isSelected ? 'checked' : ''}>
        <button class="icon-btn favorite-btn" data-id="${prompt.id}" title="${prompt.favorite ? 'Unfavorite' : 'Favorite'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="${prompt.favorite ? '#F59E0B' : 'none'}" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2L10.163 6.403L15 7.095L11.5 10.507L12.326 15.323L8 13.045L3.674 15.323L4.5 10.507L1 7.095L5.837 6.403L8 2Z" stroke="${prompt.favorite ? '#F59E0B' : '#FCD34D'}" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prompt-text" data-id="${prompt.id}">${escapeHtml(previewText)}</div>
    <div class="prompt-footer">
      <button class="btn-sm primary copy-btn" data-id="${prompt.id}">Copy</button>
      <button class="icon-btn enhance-btn" data-id="${prompt.id}" title="Enhance Prompt">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1L8.5 4.5L12 5L8.5 5.5L8 9L7.5 5.5L4 5L7.5 4.5L8 1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M12 2L12.5 3.5L14 4L12.5 4.5L12 6L11.5 4.5L10 4L11.5 3.5L12 2Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
          <path d="M4 10L4.5 11.5L6 12L4.5 12.5L4 14L3.5 12.5L2 12L3.5 11.5L4 10Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
          <path d="M13 9L13.3 10.2L14.5 10.5L13.3 10.8L13 12L12.7 10.8L11.5 10.5L12.7 10.2L13 9Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="btn-sm delete-btn" data-id="${prompt.id}">Delete</button>
    </div>
  `;
  
  // Add event listeners
  item.querySelector('.copy-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    copyPrompt(prompt.id);
  });
  
  item.querySelector('.enhance-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    enhancePrompt(prompt.id);
  });
  
  item.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deletePrompt(prompt.id);
  });
  
  item.querySelector('.favorite-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(prompt.id);
  });
  
  // Add expand toggle listener if arrow button exists
  const expandBtn = item.querySelector('.expand-toggle-btn');
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExpand(prompt.id);
    });
  }
  
  // Add checkbox listener
  const checkbox = item.querySelector('.prompt-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      togglePromptSelection(prompt.id);
    });
  }
  
  // Highlight selected items
  if (isSelected) {
    item.style.backgroundColor = 'var(--bg-secondary)';
    item.style.borderColor = 'var(--primary-color)';
  }
  
  return item;
}

// Toggle expand/collapse prompt
function toggleExpand(id) {
  const textElement = document.querySelector(`.prompt-text[data-id="${id}"]`);
  const expandBtn = document.querySelector(`.expand-toggle-btn[data-id="${id}"]`);
  const prompt = allPrompts.find(p => p.id === id);
  
  if (!textElement || !prompt) return;
  
  const isLongPrompt = prompt.text.length > 100;
  
  if (textElement.classList.contains('expanded')) {
    // Collapse
    textElement.classList.remove('expanded');
    const previewText = isLongPrompt 
      ? prompt.text.substring(0, 100) + '...' 
      : prompt.text;
    textElement.innerHTML = escapeHtml(previewText);
    if (expandBtn) {
      expandBtn.title = isLongPrompt ? 'Expand' : 'Show Full';
      const arrowIcon = expandBtn.querySelector('.arrow-icon');
      if (arrowIcon) {
        arrowIcon.style.transform = 'rotate(0deg)';
      }
    }
  } else {
    // Expand
    textElement.classList.add('expanded');
    textElement.innerHTML = escapeHtml(prompt.text);
    if (expandBtn) {
      expandBtn.title = 'Collapse';
      const arrowIcon = expandBtn.querySelector('.arrow-icon');
      if (arrowIcon) {
        arrowIcon.style.transform = 'rotate(180deg)';
      }
    }
  }
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

// Enhance prompt using OpenAI
async function enhancePrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  // Get OpenAI API key from settings
  if (!settings.openaiApiKey) {
    showNotification('Please set your OpenAI API key in Settings', 'error');
    openSettings();
    return;
  }
  
  const enhanceBtn = document.querySelector(`.enhance-btn[data-id="${id}"]`);
  const originalTitle = enhanceBtn.title;
  enhanceBtn.title = 'Enhancing...';
  enhanceBtn.disabled = true;
  enhanceBtn.style.opacity = '0.6';
  enhanceBtn.style.cursor = 'wait';
  
  try {
    const systemPrompt = `# ROLE

You are an expert prompt engineering specialist with deep knowledge of LLM behavior, cognitive psychology, and information architecture. Your sole purpose is to transform user prompts into highly effective, structured prompts that maximize LLM performance.

# TASK

Analyze the user's input prompt and generate an enhanced, optimized version that will produce superior results from any LLM. Do not execute the prompt—only return the improved version.

# ANALYSIS FRAMEWORK

Before enhancing, identify:

1. **Core Intent**: What is the user truly trying to achieve?

2. **Missing Elements**: What critical information is absent (context, constraints, format)?

3. **Ambiguities**: What could be misinterpreted or is too vague?

4. **Complexity Level**: Does this require step-by-step reasoning, examples, or role-playing?

5. **Output Requirements**: What format and depth would best serve the user's goal?

# ENHANCEMENT STRUCTURE

Transform the prompt using this six-component framework:

## 1. CONTEXT

- Establish relevant background information

- Define the domain and target audience

- Specify any constraints or requirements

- Include relevant facts or current state

## 2. ROLE/PERSONA

- Assign the LLM an appropriate expert role

- Define the perspective and expertise level needed

- Example: "You are a senior software architect..." or "Act as an experienced teacher..."

## 3. TASK/INSTRUCTION

- State the objective clearly and specifically

- Break complex tasks into numbered steps

- Use action verbs (analyze, generate, evaluate, compare)

- Front-load the most critical instruction

## 4. CONSTRAINTS & RULES

- Define boundaries and limitations

- Specify what to avoid or exclude

- Set quality standards or requirements

- Include any mandatory elements

## 5. OUTPUT FORMAT

- Specify the desired structure (bullet points, paragraphs, tables, code, JSON)

- Define length requirements (word count, number of items)

- Indicate organization (sections, headers, prioritization)

- Request examples if applicable

## 6. EXAMPLES (if needed)

- For complex or nuanced tasks, provide sample input-output pairs

- Show the desired style, tone, or approach

- Demonstrate edge cases if relevant

# ENHANCEMENT PRINCIPLES

- **Specificity**: Replace vague terms with precise language

- **Clarity**: Use unambiguous phrasing and delimiters (###, """, ---)

- **Completeness**: Ensure all six components are addressed when relevant

- **Chain-of-Thought**: Add "think step-by-step" for complex reasoning tasks

- **Contextual Density**: Pack relevant information efficiently

- **Action-Oriented**: Use imperative verbs and direct instructions

# OUTPUT REQUIREMENTS

Return ONLY the enhanced prompt in this format:

---

**ENHANCED PROMPT:**

[Your optimized prompt here, properly structured with all relevant components]

---

**KEY IMPROVEMENTS MADE:**

- [Brief bullet list of 2-4 major enhancements]

# QUALITY STANDARDS

The enhanced prompt must:

✓ Be immediately executable by any LLM

✓ Leave no room for misinterpretation

✓ Include clear success criteria

✓ Be 30-60% more effective than the original

✓ Maintain the user's original intent

✗ Never add assumptions not implied by the original

✗ Never be overly verbose or include filler

# SPECIAL CASES

- **Very short prompts** (< 10 words): Expand significantly with inferred context

- **Already well-structured prompts**: Focus on precision refinements

- **Multi-step tasks**: Add explicit step numbering and intermediate checkpoints

- **Creative tasks**: Preserve creative freedom while adding helpful structure

- **Technical tasks**: Include relevant technical constraints and standards

# PROCESSING STEPS

1. Read and analyze the user's original prompt

2. Identify gaps, ambiguities, and improvement opportunities

3. Structure the enhanced prompt using the six-component framework

4. Add appropriate prompt engineering techniques (CoT, role-playing, etc.)

5. Verify the enhanced prompt maintains original intent

6. Output the enhanced version with improvement notes

Now, await the user's prompt to enhance.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt.text }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    const data = await response.json();
    const enhancedText = data.choices[0]?.message?.content || '';
    
    if (!enhancedText) {
      throw new Error('No response from API');
    }
    
    // Extract the enhanced prompt from the response
    let enhancedPrompt = enhancedText;
    // Try multiple patterns to extract the enhanced prompt
    const patterns = [
      /---\s*\n\*\*ENHANCED PROMPT:\*\*\s*\n([\s\S]*?)\n\s*---/,
      /ENHANCED PROMPT:\s*\n([\s\S]*?)(?:\n\s*---|\n\s*\*\*KEY IMPROVEMENTS|$)/,
      /---\s*\nENHANCED PROMPT:\s*\n([\s\S]*?)\n\s*---/,
    ];
    
    for (const pattern of patterns) {
      const match = enhancedText.match(pattern);
      if (match && match[1]) {
        enhancedPrompt = match[1].trim();
        break;
      }
    }
    
    // If no pattern matched, use the full response
    if (enhancedPrompt === enhancedText && enhancedText.length > 500) {
      // Try to extract just the prompt part (before "KEY IMPROVEMENTS" or similar)
      const splitMatch = enhancedText.split(/\*\*KEY IMPROVEMENTS|KEY IMPROVEMENTS|Improvements/i);
      if (splitMatch[0]) {
        enhancedPrompt = splitMatch[0].replace(/---\s*\n?\*\*ENHANCED PROMPT:\*\*\s*\n?/i, '').trim();
      }
    }
    
    // Show enhanced prompt in a modal or replace the text
    showEnhancedPromptModal(prompt, enhancedPrompt, enhancedText);
    
  } catch (error) {
    console.error('Enhancement error:', error);
    showNotification(`Enhancement failed: ${error.message}`, 'error');
  } finally {
    enhanceBtn.title = originalTitle;
    enhanceBtn.disabled = false;
    enhanceBtn.style.opacity = '1';
    enhanceBtn.style.cursor = 'pointer';
  }
}

// Show enhanced prompt in modal
function showEnhancedPromptModal(originalPrompt, enhancedPrompt, fullResponse) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h2>Enhanced Prompt</h2>
        <button class="icon-btn close-enhanced-modal">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="setting-item">
          <label><strong>Original Prompt:</strong></label>
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px; white-space: pre-wrap; font-family: monospace; font-size: 13px;">${escapeHtml(originalPrompt.text)}</div>
        </div>
        <div class="setting-item">
          <label><strong>Enhanced Prompt:</strong></label>
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px; white-space: pre-wrap; font-family: monospace; font-size: 13px;">${escapeHtml(enhancedPrompt)}</div>
        </div>
        <div class="setting-item">
          <label><strong>Full Response:</strong></label>
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px; white-space: pre-wrap; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto;">${escapeHtml(fullResponse)}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm" id="copyEnhancedBtn">Copy Enhanced</button>
        <button class="btn-sm" id="replacePromptBtn">Replace Original</button>
        <button class="btn-primary" id="saveAsNewBtn">Save as New Prompt</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  modal.querySelector('.close-enhanced-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.querySelector('#copyEnhancedBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(enhancedPrompt);
      showNotification('Enhanced prompt copied to clipboard!');
    } catch (error) {
      showNotification('Failed to copy', 'error');
    }
  });
  
  modal.querySelector('#replacePromptBtn').addEventListener('click', async () => {
    const promptIndex = allPrompts.findIndex(p => p.id === originalPrompt.id);
    if (promptIndex !== -1) {
      allPrompts[promptIndex].text = enhancedPrompt;
      await chrome.storage.local.set({ prompts: allPrompts });
      renderPrompts();
      showNotification('Prompt replaced with enhanced version');
      modal.remove();
    }
  });
  
  modal.querySelector('#saveAsNewBtn').addEventListener('click', async () => {
    const newPrompt = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      text: enhancedPrompt,
      platform: originalPrompt.platform,
      url: originalPrompt.url,
      timestamp: Date.now(),
      favorite: false
    };
    
    allPrompts.unshift(newPrompt);
    await chrome.storage.local.set({ prompts: allPrompts });
    applyFilters();
    updateStorageInfo();
    showNotification('Enhanced prompt saved as new');
    modal.remove();
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
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
  document.getElementById('openaiApiKeyInput').value = settings.openaiApiKey || '';
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
  const openaiApiKey = document.getElementById('openaiApiKeyInput').value.trim();
  
  settings = { maxPrompts, excludedSites, autoSaveEnabled, openaiApiKey };
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

// Toggle individual prompt selection
function togglePromptSelection(id) {
  if (selectedPromptIds.has(id)) {
    selectedPromptIds.delete(id);
  } else {
    selectedPromptIds.add(id);
  }
  updateSelectionUI();
  // Update the checkbox state
  const checkbox = document.querySelector(`.prompt-checkbox[data-id="${id}"]`);
  if (checkbox) {
    checkbox.checked = selectedPromptIds.has(id);
  }
  // Update item highlight
  const item = document.querySelector(`.prompt-item[data-id="${id}"]`);
  if (item) {
    if (selectedPromptIds.has(id)) {
      item.style.backgroundColor = 'var(--bg-secondary)';
      item.style.borderColor = 'var(--primary-color)';
    } else {
      item.style.backgroundColor = '';
      item.style.borderColor = '';
    }
  }
}

// Handle select all checkbox
function handleSelectAll(e) {
  const isChecked = e.target.checked;
  filteredPrompts.forEach(prompt => {
    if (isChecked) {
      selectedPromptIds.add(prompt.id);
    } else {
      selectedPromptIds.delete(prompt.id);
    }
  });
  updateSelectionUI();
  renderPrompts();
}

// Handle header delete button
async function handleHeaderDelete() {
  if (selectedPromptIds.size === 0) {
    showNotification('No prompts selected', 'error');
    return;
  }
  
  const count = selectedPromptIds.size;
  if (!confirm(`Are you sure you want to delete ${count} prompt${count > 1 ? 's' : ''}?`)) {
    return;
  }
  
  allPrompts = allPrompts.filter(p => !selectedPromptIds.has(p.id));
  selectedPromptIds.clear();
  await chrome.storage.local.set({ prompts: allPrompts });
  applyFilters();
  updateStorageInfo();
  showNotification(`${count} prompt${count > 1 ? 's' : ''} deleted`);
  updateSelectionUI();
  renderPrompts();
}

// Update selection UI
function updateSelectionUI() {
  const headerDeleteBtn = document.getElementById('headerDeleteBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  
  // Show/hide delete button based on selection
  if (selectedPromptIds.size > 0) {
    headerDeleteBtn.style.display = 'block';
  } else {
    headerDeleteBtn.style.display = 'none';
  }
  
  // Update select all checkbox state
  if (filteredPrompts.length > 0) {
    const allSelected = filteredPrompts.every(p => selectedPromptIds.has(p.id));
    const someSelected = filteredPrompts.some(p => selectedPromptIds.has(p.id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = someSelected && !allSelected;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
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

