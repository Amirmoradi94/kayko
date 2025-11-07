// Kayko Content Script - Textarea Detection and Auto-Save
(function() {
  'use strict';

  // Version check - helps identify if old cached code is running
  const KAYKO_VERSION = '1.0.1';
  console.log('Kayko: Content script v' + KAYKO_VERSION + ' loaded');

  const DEBOUNCE_DELAY = 3000; // 3 seconds
  const ICON_SIZE = 24;
  const trackedTextareas = new WeakMap();
  const trackedIcons = new Set(); // Track icons separately since WeakMap can't be iterated
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

  // Safely get extension URL with error handling
  let extensionContextWarningShown = false; // Track if we've already warned
  let extensionContextValid = true; // Track if extension context is valid
  
  function getExtensionURL(path) {
    // If we know context is invalid, return empty immediately
    if (!extensionContextValid) {
      return '';
    }
    
    try {
      if (chrome.runtime && chrome.runtime.getURL) {
        const url = chrome.runtime.getURL(path);
        return url;
      } else {
        extensionContextValid = false;
      }
    } catch (error) {
      extensionContextValid = false;
      // Only show warning once per page load to avoid spam
      if (!extensionContextWarningShown) {
        console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
        // Show user-friendly notification
        showExtensionContextNotification();
        extensionContextWarningShown = true;
      }
    }
    // Fallback: return empty string (caller should handle this)
    return '';
  }
  
  // Show a user-friendly notification about extension context
  function showExtensionContextNotification() {
    try {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #F59E0B;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
      `;
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Kayko Extension</div>
        <div style="margin-bottom: 12px;">Extension was reloaded. Please refresh this page (F5) to restore full functionality.</div>
        <button id="kayko-refresh-btn" style="
          background: white;
          color: #F59E0B;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        ">Refresh Page</button>
      `;
      
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(notification);
      
      // Add refresh button handler
      const refreshBtn = notification.querySelector('#kayko-refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideInRight 0.3s ease reverse';
          setTimeout(() => notification.remove(), 300);
        }
      }, 10000);
    } catch (error) {
      // Silently fail if we can't show notification
    }
  }

  // Create and inject the Kayko icon
  function createIcon(textarea) {
    const icon = document.createElement('div');
    icon.className = 'kayko-icon idle';
    
    // Create img element that we can swap
    const img = document.createElement('img');
    img.alt = 'Kayko';
    img.className = 'kayko-icon-img';
    
    // Set initial icon (idle state) - using custom idle icon
    const iconUrl = getExtensionURL('icons/idle-icon.png');
    if (iconUrl) {
      img.src = iconUrl;
    }
    
    icon.appendChild(img);
    icon.title = 'Kayko - Click to view saved prompts';
    
    // Click handler to open side panel
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
      } catch (error) {
        console.warn('Kayko: Extension context invalidated');
      }
    });

    return icon;
  }

  // Position the icon relative to textarea (attached to top-right border, outside)
  function positionIcon(textarea, icon) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    icon.style.position = 'absolute';
    
    // For ChatGPT, position on the right side (outside the textarea)
    const isChatGPT = window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com');
    
    if (isChatGPT) {
      // Position on the right side, vertically centered
      icon.style.top = `${rect.top + scrollTop + (rect.height / 2) - 85}px`; // Vertically centered (half of 56px)
      icon.style.left = `${rect.right + scrollLeft + 15}px`; // 25px to the right of textarea
    } else {
      // For other platforms, keep top-right position
      icon.style.top = `${rect.top + scrollTop - 28}px`; // 28px above (half the icon height)
      icon.style.left = `${rect.right + scrollLeft - 28}px`; // 28px from right edge (half icon width)
    }
    
    icon.style.zIndex = '10000';
  }

  // Update icon state
  function setIconState(icon, state) {
    try {
      icon.classList.remove('idle', 'saving', 'saved');
      icon.classList.add(state);
      
      // Get the img element
      let img = icon.querySelector('.kayko-icon-img');
      if (!img) {
        console.warn('Kayko: Image element not found in icon');
        return;
      }
      
      // Change icon image based on state - using custom icons
      let iconPath = '';
      if (state === 'idle') {
        // Idle state - custom idle icon
        iconPath = 'icons/idle-icon.png';
      } else if (state === 'saving') {
        // Saving state - custom saving icon
        iconPath = 'icons/saving-icon.png';
      } else if (state === 'saved') {
        // Saved state - back to idle icon but with green tint via CSS
        iconPath = 'icons/idle-icon.png';
      }
      
      // Safely set the icon source
      if (iconPath) {
        const iconUrl = getExtensionURL(iconPath);
        if (!iconUrl) {
          // Extension context invalidated - skip icon change but keep CSS state
          // Don't log warning here as getExtensionURL already logged it once
          return;
        }
        
        // For ChatGPT, force complete image replacement to prevent overlap
        const isChatGPT = window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com');
        
        if (isChatGPT && state === 'saving') {
          // Remove old image completely and create new one
          img.remove();
          img = document.createElement('img');
          img.alt = 'Kayko';
          img.className = 'kayko-icon-img';
          img.src = iconUrl + '?t=' + Date.now(); // Always use cache buster for saving
          icon.appendChild(img);
        } else {
          // For other states or platforms, just update src
          // Clear the image first to force reload
          img.src = '';
          // Small delay to ensure old image is cleared
          setTimeout(() => {
            if (img && img.parentNode) { // Check if img still exists
              img.src = iconUrl + (state === 'saving' ? '?t=' + Date.now() : '');
            }
          }, 10);
        }
        
        console.log('Kayko: Icon state changed to', state, 'using', iconPath);
      }
    } catch (error) {
      console.error('Kayko: Error setting icon state', error);
    }
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
      // Check if chrome.storage is available
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        console.warn('Kayko: chrome.storage is not available');
        return false;
      }

      const result = await chrome.storage.local.get(['prompts', 'settings']);
      const prompts = result.prompts || [];
      const settings = result.settings || { maxPrompts: 100, excludedSites: [] };

      // Check if site is excluded
      if (settings.excludedSites && settings.excludedSites.some(site => window.location.hostname.includes(site))) {
        return false;
      }

      // Check if this is a duplicate of the last prompt
      if (prompts.length > 0) {
        const lastPrompt = prompts[0];
        if (lastPrompt.text === text && lastPrompt.platform === prompt.platform) {
          return false; // Don't save duplicate
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
      try {
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'updateBadge' });
        }
      } catch (error) {
        // Extension context might be invalidated, ignore silently
      }
      
      return true;
    } catch (error) {
      // Check if it's an extension context error
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.warn('Kayko: Extension was reloaded. Please refresh the page.');
      } else if (error.message && error.message.includes('Cannot read properties')) {
        console.warn('Kayko: Extension context invalidated. Please refresh the page.');
      } else {
        console.error('Kayko: Error saving prompt', error);
      }
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

  // Clean up all existing icons (prevent duplicates)
  function cleanupIcons() {
    try {
      // Ensure trackedIcons is a Set
      if (!trackedIcons || typeof trackedIcons.has !== 'function') {
        // If trackedIcons is not a Set, recreate it
        if (typeof Set !== 'undefined') {
          // Can't recreate it here as it's const, but we can skip cleanup
          console.warn('Kayko: trackedIcons is not properly initialized, skipping cleanup');
        }
        return;
      }
      
      const existingIcons = document.querySelectorAll('.kayko-icon');
      if (!existingIcons || existingIcons.length === 0) return;
      
      existingIcons.forEach(icon => {
        try {
          // Check if this icon is still tracked using our Set
          if (!trackedIcons.has(icon)) {
            // Remove if not tracked
            icon.remove();
          }
        } catch (error) {
          // Silently skip if there's an error with this icon
        }
      });
    } catch (error) {
      console.error('Kayko: Error in cleanupIcons', error);
    }
  }

  // Track a textarea
  function trackTextarea(textarea) {
    if (trackedTextareas.has(textarea)) {
      // Reposition existing icon in case textarea moved
      const existing = trackedTextareas.get(textarea);
      if (existing && existing.icon && document.body.contains(existing.icon)) {
        try {
          positionIcon(textarea, existing.icon);
        } catch (error) {
          // Silently fail
        }
      }
      return;
    }

    try {
      // Clean up any orphaned icons first
      cleanupIcons();
      
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
      // Track icon in Set (with safety check)
      if (trackedIcons && typeof trackedIcons.add === 'function') {
        trackedIcons.add(icon);
      }

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
            // Remove from tracking Set (with safety check)
            if (trackedIcons && typeof trackedIcons.delete === 'function') {
              trackedIcons.delete(icon);
            }
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
      
      // Clean up any existing icons first (in case of page reactivation)
      cleanupIcons();
      
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
          // Clean up orphaned icons periodically
          cleanupIcons();
          detectTextareas();
        } catch (error) {
          // Silently fail
        }
      }, 3000); // Changed from 2s to 3s to be less aggressive
      
      // Clean up icons when page becomes visible again (user returns to tab)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Page is visible again, clean up any duplicates
          setTimeout(() => {
            cleanupIcons();
            detectTextareas();
          }, 500);
        }
      });
    } catch (error) {
      console.error('Kayko: Failed to initialize', error);
    }
  }

  // Expose manual trigger for debugging
  window.kaykoDetect = function() {
    console.log('Kayko: Manual detection triggered');
    detectTextareas();
    console.log('Kayko: Currently tracking', trackedIcons.size, 'icons');
  };

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

