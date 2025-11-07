// Kayko Content Script - Textarea Detection and Auto-Save
(function() {
  'use strict';

  const DEBOUNCE_DELAY = 3000; // 3 seconds
  const ICON_SIZE = 24;
  const trackedTextareas = new WeakMap();
  let debounceTimers = new WeakMap();

  // Detect current LLM platform
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('openai.com')) return 'ChatGPT';
    if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) return 'Claude';
    if (hostname.includes('google.com') && (hostname.includes('gemini') || window.location.pathname.includes('gemini'))) return 'Gemini';
    if (hostname.includes('x.ai')) return 'Grok';
    if (hostname.includes('perplexity.ai')) return 'Perplexity';
    return 'Unknown LLM';
  }

  // Create and inject the Kayko icon
  function createIcon(textarea) {
    const icon = document.createElement('div');
    icon.className = 'kayko-icon';
    icon.innerHTML = `
      <svg class="kayko-icon-idle" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2ZM8 14L4 10L5.41 8.59L8 11.17L14.59 4.58L16 6L8 14Z" fill="#9CA3AF"/>
      </svg>
      <svg class="kayko-icon-saving" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" stroke="#3B82F6" stroke-width="2" fill="none" stroke-dasharray="5 3"/>
      </svg>
      <svg class="kayko-icon-saved" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2ZM8 14L4 10L5.41 8.59L8 11.17L14.59 4.58L16 6L8 14Z" fill="#10B981"/>
      </svg>
    `;
    icon.title = 'Kayko - Click to view saved prompts';
    
    // Click handler to open side panel
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });

    return icon;
  }

  // Position the icon relative to textarea
  function positionIcon(textarea, icon) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    icon.style.position = 'absolute';
    icon.style.top = `${rect.top + scrollTop + 8}px`;
    icon.style.right = `${document.documentElement.clientWidth - (rect.right + scrollLeft) + 8}px`;
    icon.style.zIndex = '10000';
  }

  // Update icon state
  function setIconState(icon, state) {
    icon.classList.remove('idle', 'saving', 'saved');
    icon.classList.add(state);
  }

  // Save prompt to storage
  async function savePrompt(textarea, text) {
    if (!text || text.trim().length < 3) return; // Don't save very short text

    const prompt = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      text: text,
      platform: detectPlatform(),
      url: window.location.href,
      timestamp: Date.now(),
      favorite: false
    };

    try {
      const result = await chrome.storage.local.get(['prompts', 'settings']);
      const prompts = result.prompts || [];
      const settings = result.settings || { maxPrompts: 100, excludedSites: [] };

      // Check if site is excluded
      if (settings.excludedSites.some(site => window.location.hostname.includes(site))) {
        return;
      }

      // Check if this is a duplicate of the last prompt
      if (prompts.length > 0) {
        const lastPrompt = prompts[0];
        if (lastPrompt.text === text && lastPrompt.platform === prompt.platform) {
          return; // Don't save duplicate
        }
      }

      // Add new prompt at the beginning
      prompts.unshift(prompt);

      // Keep only the last N prompts
      if (prompts.length > settings.maxPrompts) {
        prompts.splice(settings.maxPrompts);
      }

      await chrome.storage.local.set({ prompts });
      
      // Update badge count
      chrome.runtime.sendMessage({ action: 'updateBadge' });
      
      return true;
    } catch (error) {
      console.error('Kayko: Error saving prompt', error);
      return false;
    }
  }

  // Handle textarea input with debouncing
  function handleTextareaInput(textarea, icon) {
    // Clear existing timer
    if (debounceTimers.has(textarea)) {
      clearTimeout(debounceTimers.get(textarea));
    }

    // Show saving state
    setIconState(icon, 'saving');

    // Set new timer
    const timer = setTimeout(async () => {
      const success = await savePrompt(textarea, textarea.value);
      if (success) {
        setIconState(icon, 'saved');
        setTimeout(() => setIconState(icon, 'idle'), 2000);
      } else {
        setIconState(icon, 'idle');
      }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(textarea, timer);
  }

  // Track a textarea
  function trackTextarea(textarea) {
    if (trackedTextareas.has(textarea)) return;

    // Create and inject icon
    const icon = createIcon(textarea);
    document.body.appendChild(icon);
    
    // Position icon
    positionIcon(textarea, icon);

    // Store reference
    trackedTextareas.set(textarea, { icon, textarea });

    // Add input listener
    textarea.addEventListener('input', () => handleTextareaInput(textarea, icon));

    // Add focus listener to reposition icon
    textarea.addEventListener('focus', () => positionIcon(textarea, icon));

    // Reposition on scroll and resize
    const repositionHandler = () => positionIcon(textarea, icon);
    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);

    // Hide icon when textarea is removed
    const observer = new MutationObserver(() => {
      if (!document.body.contains(textarea)) {
        icon.remove();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Detect and track all textareas
  function detectTextareas() {
    // Find all textareas and contenteditable elements
    const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
    
    textareas.forEach(textarea => {
      // Only track if it's large enough (likely a prompt input)
      const rect = textarea.getBoundingClientRect();
      if (rect.height > 40 || textarea.rows > 2) {
        trackTextarea(textarea);
      }
    });
  }

  // Initialize
  function init() {
    // Initial detection
    detectTextareas();

    // Watch for dynamically added textareas
    const observer = new MutationObserver(() => {
      detectTextareas();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Periodic check for new textareas (some sites load them dynamically)
    setInterval(detectTextareas, 2000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

