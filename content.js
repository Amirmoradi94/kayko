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
    if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) return 'ChatGPT';
    if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) return 'Claude';
    if (hostname.includes('google.com') && (hostname.includes('gemini') || window.location.pathname.includes('gemini'))) return 'Gemini';
    if (hostname.includes('x.ai') || hostname.includes('grok.com')) return 'Grok';
    if (hostname.includes('perplexity.ai')) return 'Perplexity';
    return 'Unknown LLM';
  }

  // Create and inject the Kayko icon
  function createIcon(textarea) {
    const icon = document.createElement('div');
    icon.className = 'kayko-icon idle';
    
    // Use the extension icon
    const iconUrl = chrome.runtime.getURL('icons/icon128.png');
    icon.innerHTML = `<img src="${iconUrl}" alt="Kayko" />`;
    icon.title = 'Kayko - Click to view saved prompts';
    
    // Click handler to open side panel
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });

    return icon;
  }

  // Position the icon relative to textarea (attached to top-right border, outside)
  function positionIcon(textarea, icon) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    icon.style.position = 'absolute';
    // Position at the top edge, slightly above the textarea
    icon.style.top = `${rect.top + scrollTop - 16}px`; // 16px above (half the icon height)
    // Position at the right edge
    icon.style.left = `${rect.right + scrollLeft - 16}px`; // 16px from right edge (half icon width)
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

  // Get text from textarea or contenteditable element
  function getTextContent(element) {
    if (element.tagName === 'TEXTAREA') {
      return element.value;
    } else if (element.isContentEditable) {
      return element.textContent || element.innerText || '';
    }
    return '';
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
      const text = getTextContent(textarea);
      const success = await savePrompt(textarea, text);
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

    try {
      // Create and inject icon
      const icon = createIcon(textarea);
      
      // Safely append to body
      if (document.body) {
        document.body.appendChild(icon);
      } else {
        console.warn('Kayko: document.body not available');
        return;
      }
      
      // Position icon
      positionIcon(textarea, icon);

      // Store reference
      trackedTextareas.set(textarea, { icon, textarea });

      // Add input listeners (multiple events for better compatibility)
      const inputHandler = () => {
        try {
          handleTextareaInput(textarea, icon);
        } catch (error) {
          console.error('Kayko: Error in input handler', error);
        }
      };
      
      textarea.addEventListener('input', inputHandler, { passive: true });
      textarea.addEventListener('keyup', inputHandler, { passive: true });
      textarea.addEventListener('paste', inputHandler, { passive: true });

      // Add focus listener to reposition icon
      textarea.addEventListener('focus', () => {
        try {
          positionIcon(textarea, icon);
        } catch (error) {
          console.error('Kayko: Error repositioning icon', error);
        }
      }, { passive: true });

      // Reposition on scroll and resize
      const repositionHandler = () => {
        try {
          positionIcon(textarea, icon);
        } catch (error) {
          // Silently fail on repositioning errors
        }
      };
      window.addEventListener('scroll', repositionHandler, { passive: true, capture: true });
      window.addEventListener('resize', repositionHandler, { passive: true });

      // Hide icon when textarea is removed
      const observer = new MutationObserver(() => {
        try {
          if (!document.body.contains(textarea)) {
            icon.remove();
            observer.disconnect();
          }
        } catch (error) {
          console.error('Kayko: Error in mutation observer', error);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      console.log('Kayko: Tracking textarea', textarea);
    } catch (error) {
      console.error('Kayko: Failed to track textarea', error);
    }
  }

  // Detect and track all textareas
  function detectTextareas() {
    // Find all textareas and contenteditable elements
    const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
    
    textareas.forEach(textarea => {
      // Skip if already tracked
      if (trackedTextareas.has(textarea)) return;
      
      // Get dimensions
      const rect = textarea.getBoundingClientRect();
      const hasRows = textarea.rows && textarea.rows > 1;
      const isVisible = rect.width > 0 && rect.height > 0;
      
      // Check if it's a known chat UI framework
      const className = textarea.className || '';
      const isKnownChatUI = className.includes('ProseMirror') || 
                           className.includes('tiptap') ||
                           className.includes('contenteditable');
      
      // Track if it's likely a prompt input:
      // - Has minimum height (20px for contenteditable, 30px for textarea) OR multiple rows
      // - Is visible on screen
      // - Has a reasonable width (not a tiny input)
      // - OR is a known chat UI framework
      const minHeight = textarea.isContentEditable ? 20 : 30;
      const meetsSize = isVisible && rect.width > 100 && (rect.height > minHeight || hasRows || isKnownChatUI);
      
      if (meetsSize) {
        console.log('Kayko: Detected textarea', {
          element: textarea,
          rect: rect,
          tagName: textarea.tagName,
          className: className,
          contentEditable: textarea.isContentEditable,
          isKnownChatUI: isKnownChatUI
        });
        try {
          trackTextarea(textarea);
        } catch (error) {
          console.error('Kayko: Error tracking textarea', error);
        }
      }
    });
  }

  // Initialize
  function init() {
    try {
      console.log('Kayko: Content script initialized on', window.location.hostname);
      
      // Initial detection
      detectTextareas();

      // Delayed detection for dynamically loaded content
      setTimeout(() => {
        try {
          console.log('Kayko: Running delayed detection (500ms)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (500ms)', error);
        }
      }, 500);
      
      setTimeout(() => {
        try {
          console.log('Kayko: Running delayed detection (1s)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (1s)', error);
        }
      }, 1000);
      
      setTimeout(() => {
        try {
          console.log('Kayko: Running delayed detection (2s)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (2s)', error);
        }
      }, 2000);
      
      setTimeout(() => {
        try {
          console.log('Kayko: Running delayed detection (3s)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (3s)', error);
        }
      }, 3000);

      // Watch for dynamically added textareas (less aggressive to avoid conflicts)
      if (document.body) {
        const observer = new MutationObserver(() => {
          try {
            detectTextareas();
          } catch (error) {
            // Silently fail to avoid breaking the page
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      // Periodic check for new textareas (some sites load them dynamically)
      setInterval(() => {
        try {
          detectTextareas();
        } catch (error) {
          // Silently fail
        }
      }, 3000); // Changed from 2s to 3s to be less aggressive
    } catch (error) {
      console.error('Kayko: Failed to initialize', error);
    }
  }

  // Expose manual trigger for debugging
  window.kaykoDetect = function() {
    console.log('Kayko: Manual detection triggered');
    detectTextareas();
    console.log('Kayko: Currently tracking', trackedTextareas, 'textareas');
  };

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

