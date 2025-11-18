// Kayko Content Script - Textarea Detection and Auto-Save
(function() {
  'use strict';

  // Version check - helps identify if old cached code is running
  const KAYKO_VERSION = '1.0.1';
  console.log('Kayko: Content script v' + KAYKO_VERSION + ' loaded');

  const DEBOUNCE_DELAY = 1000; // 1 second
  const ICON_SIZE = 24;
  const trackedTextareas = new WeakMap();
  const trackedIcons = new Set(); // Track icons separately since WeakMap can't be iterated
  let debounceTimers = new WeakMap();
  const positionUpdateTimers = new WeakMap(); // Debounce position updates

  // Check if current website is a supported LLM platform
  function isLLMWebsite() {
    const hostname = window.location.hostname;
    
    // Exclude mail.google.com (Gmail)
    if (hostname.includes('mail.google.com')) {
      return false;
    }
    
    return hostname.includes('openai.com') || 
           hostname.includes('chatgpt.com') ||
           hostname.includes('claude.ai') || 
           hostname.includes('anthropic.com') ||
           hostname.includes('aistudio.google.com') ||
           hostname.includes('gemini.google.com') ||
           (hostname.includes('google.com') && (hostname.includes('gemini') || window.location.pathname.includes('gemini'))) ||
           hostname.includes('x.ai') || 
           hostname.includes('grok.com') ||
           hostname.includes('perplexity.ai');
  }

  // Detect current LLM platform
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) return 'ChatGPT';
    if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) return 'Claude';
    // Google AI Studio and Gemini are separate platforms
    if (hostname.includes('aistudio.google.com') || hostname === 'aistudio.google.com') return 'Google AI Studio';
    if (hostname.includes('gemini.google.com') || hostname === 'gemini.google.com') return 'Gemini';
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
    
    // Check if chrome.runtime exists before trying to use it
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
      extensionContextValid = false;
      if (!extensionContextWarningShown) {
        console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
        showExtensionContextNotification();
        extensionContextWarningShown = true;
      }
      return '';
    }
    
    try {
      const url = chrome.runtime.getURL(path);
      return url;
    } catch (error) {
      extensionContextValid = false;
      // Only show warning once per page load to avoid spam
      if (!extensionContextWarningShown) {
        console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
        showExtensionContextNotification();
        extensionContextWarningShown = true;
      }
      return '';
    }
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
    // Create wrapper container
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'kayko-icon-wrapper';
    
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
    
    // Create ring element (appears on hover)
    const ring = document.createElement('div');
    ring.className = 'kayko-icon-ring';
    
    // Create toggle switch at 3 o'clock position
    const toggleSwitch = document.createElement('button');
    toggleSwitch.className = 'kayko-auto-save-toggle';
    toggleSwitch.type = 'button';
    toggleSwitch.setAttribute('aria-label', 'Toggle auto-save');
    
    // Add toggle switch to ring
    ring.appendChild(toggleSwitch);
    
    // Add ring to wrapper
    iconWrapper.appendChild(icon);
    iconWrapper.appendChild(ring);
    
    // Update ring state based on current auto-save setting
    updateRingState(ring, toggleSwitch);
    
    // Toggle switch click handler
    toggleSwitch.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      try {
        // Get current settings (preserve all existing settings)
        const result = await chrome.storage.local.get('settings');
        const currentSettings = result.settings || { 
          maxPrompts: 100,
          autoSaveEnabled: true,
          openaiApiKey: ''
        };
        
        // Toggle auto-save while preserving all other settings
        const updatedSettings = {
          ...currentSettings,
          autoSaveEnabled: !currentSettings.autoSaveEnabled
        };
        
        // Save updated settings
        await chrome.storage.local.set({ settings: updatedSettings });
        
        // Update ring state with animation
        updateRingState(ring, toggleSwitch, true);
        
        // Update icon title
        const newAutoSaveEnabled = updatedSettings.autoSaveEnabled;
        icon.title = newAutoSaveEnabled 
          ? 'Kayko - Click to view saved prompts' 
          : 'Kayko - Click to manually save prompt';
        
        // Show brief visual feedback
        iconWrapper.classList.add('toggle-feedback');
        setTimeout(() => {
          iconWrapper.classList.remove('toggle-feedback');
        }, 300);
      } catch (error) {
        console.error('Kayko: Error toggling auto-save', error);
      }
    });
    
    // Click handler - behavior depends on auto-save setting
    icon.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Check if auto-save is enabled
      const autoSaveEnabled = await isAutoSaveEnabled();
      
      if (!autoSaveEnabled) {
        // Auto-save is disabled - manual save on click
        manualSave(textarea, icon);
        return;
      }
      
      // Auto-save is enabled - open side panel on click
      // Check if extension context is valid before trying to send message
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        if (!extensionContextWarningShown) {
          console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
        return;
      }
      try {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
      } catch (error) {
        extensionContextValid = false;
        if (!extensionContextWarningShown) {
          console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
      }
    });

    return iconWrapper;
  }
  
  // Update ring state based on auto-save setting
  async function updateRingState(ring, toggleSwitch, animate = false) {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || { autoSaveEnabled: true };
      const autoSaveEnabled = settings.autoSaveEnabled !== false;
      
      // Update ring appearance (colored when on, grey when off)
      if (autoSaveEnabled) {
        ring.classList.add('ring-enabled');
        ring.classList.remove('ring-disabled');
      } else {
        ring.classList.add('ring-disabled');
        ring.classList.remove('ring-enabled');
      }
      
      // Update toggle switch state
      toggleSwitch.classList.toggle('toggle-on', autoSaveEnabled);
      toggleSwitch.classList.toggle('toggle-off', !autoSaveEnabled);
      
      if (animate) {
        ring.classList.add('ring-animate');
        setTimeout(() => {
          ring.classList.remove('ring-animate');
        }, 300);
      }
    } catch (error) {
      console.error('Kayko: Error updating ring state', error);
    }
  }

  // Position the icon relative to textarea (attached to top-right border, outside)
  function positionIcon(textarea, icon) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    icon.style.position = 'absolute';
    
    // For ChatGPT, position on the right side (outside the textarea)
    const isChatGPT = window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com');
    const isPerplexity = window.location.hostname.includes('perplexity.ai');
    const isClaude = window.location.hostname.includes('claude.ai') || window.location.hostname.includes('anthropic.com');
    // Google AI Studio and Gemini are separate platforms
    const isAIStudio = window.location.hostname.includes('aistudio.google.com');
    const isGemini = window.location.hostname.includes('gemini.google.com') ||
                     (window.location.hostname.includes('google.com') && (window.location.hostname.includes('gemini') || window.location.pathname.includes('gemini')));
    
    if (isChatGPT) {
      // Position on the right side, vertically centered
      icon.style.top = `${rect.top + scrollTop + (rect.height / 2) - 85}px`; // Vertically centered (half of 56px)
      icon.style.left = `${rect.right + scrollLeft + 15}px`; // 25px to the right of textarea
    } else if (isPerplexity) {
      // For Perplexity, position relative to top border of textarea
      icon.style.top = `${rect.top + scrollTop - 60}px`; // Relative to top border
      icon.style.left = `${rect.right + scrollLeft - 50}px`; // 50px from right edge
    } else if (isClaude) {
      // For Claude, position higher than default
      icon.style.top = `${rect.top + scrollTop - 63}px`; // 40px above (higher than default 28px)
      icon.style.left = `${rect.right + scrollLeft - 50}px`; // 28px from right edge (half icon width)
    } else if (isAIStudio || isGemini) {
      // For Google AI Studio and Gemini, position higher than default
      icon.style.top = `${rect.top + scrollTop - 66}px`; // 40px above (higher than default 28px)
      icon.style.left = `${rect.right + scrollLeft - 50}px`; // 28px from right edge (half icon width)
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
      
      // Change icon image based on state - using custom icons
      let iconPath = '';
      if (state === 'idle') {
        // Idle state - custom idle icon
        iconPath = 'icons/idle-icon.png';
      } else if (state === 'saving') {
        // Saving state - use moving icon with running animation
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
        
        // Remove ALL existing images first to prevent duplicates (apply to all platforms)
        const existingImgs = icon.querySelectorAll('.kayko-icon-img');
        existingImgs.forEach(existingImg => {
          try {
            existingImg.remove();
          } catch (e) {
            // Silently ignore removal errors
          }
        });
        
        // Create new image element
        const img = document.createElement('img');
        img.alt = 'Kayko';
        img.className = 'kayko-icon-img';
        img.src = iconUrl + (state === 'saving' ? '?t=' + Date.now() : '');
        icon.appendChild(img);
        
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
      // Check if extension context is valid
      if (!extensionContextValid) {
        return false;
      }
      
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        extensionContextValid = false;
        if (!extensionContextWarningShown) {
          console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
        return false;
      }

      const result = await chrome.storage.local.get(['prompts', 'settings']);
      const prompts = result.prompts || [];
      const settings = result.settings || { maxPrompts: 100 };

      // Check if this is a duplicate of the last prompt
      if (prompts.length > 0) {
        const lastPrompt = prompts[0];
        if (lastPrompt.text === text && lastPrompt.platform === prompt.platform) {
          return false; // Don't save duplicate
        }
      }

      // Check if new prompt covers at least 80% of an existing prompt from the same platform
      // If found, update that existing prompt instead of creating a new one
      const currentPlatform = prompt.platform;
      let foundExistingPrompt = false;
      
      // Helper function to calculate coverage percentage
      function calculateCoverage(newText, existingText) {
        // If new text contains the entire existing text, coverage is 100%
        if (newText.includes(existingText)) {
          return 100;
        }
        
        // Calculate coverage based on longest common substring
        const existingLen = existingText.length;
        if (existingLen === 0) return 0;
        
        // Find the longest substring of existing text that appears in new text
        let maxMatchLength = 0;
        for (let i = 0; i < existingLen; i++) {
          for (let j = i + 1; j <= existingLen; j++) {
            const substring = existingText.substring(i, j);
            if (newText.includes(substring)) {
              maxMatchLength = Math.max(maxMatchLength, substring.length);
            }
          }
        }
        
        // Return coverage percentage
        return (maxMatchLength / existingLen) * 100;
      }
      
      for (let i = 0; i < prompts.length; i++) {
        const existingPrompt = prompts[i];
        // Only check prompts from the same platform
        if (existingPrompt.platform === currentPlatform) {
          // Skip if texts are identical (already handled by duplicate check)
          if (text === existingPrompt.text) {
            continue;
          }
          
          // Calculate coverage percentage
          const coverage = calculateCoverage(text, existingPrompt.text);
          
          // If new prompt covers at least 80% of existing prompt, update it
          if (coverage >= 80) {
            // Update the existing prompt with the new text
            existingPrompt.text = text;
            existingPrompt.timestamp = prompt.timestamp;
            existingPrompt.url = prompt.url;
            // Preserve favorite status and other properties
            // Move updated prompt to the beginning (most recent)
            prompts.splice(i, 1);
            prompts.unshift(existingPrompt);
            foundExistingPrompt = true;
            break;
          }
        }
      }

      // If no existing prompt was found to update, add as new prompt
      if (!foundExistingPrompt) {
        prompts.unshift(prompt);
      }

      // Keep only the last N prompts
      if (prompts.length > settings.maxPrompts) {
        prompts.splice(settings.maxPrompts);
      }

      await chrome.storage.local.set({ prompts });
      
      // Update badge count
      try {
        if (extensionContextValid && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
          chrome.runtime.sendMessage({ action: 'updateBadge' });
        }
      } catch (error) {
        // Extension context might be invalidated, mark as invalid
        extensionContextValid = false;
        // Don't show warning here as it's a non-critical operation
      }
      
      return true;
    } catch (error) {
      // Check if it's an extension context error
      extensionContextValid = false;
      if (error.message && (error.message.includes('Extension context invalidated') || 
          error.message.includes('Cannot read properties') ||
          error.message.includes('chrome.storage'))) {
        if (!extensionContextWarningShown) {
          console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
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

  // Check if auto-save is enabled
  async function isAutoSaveEnabled() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return true; // Default to enabled if can't check
      }
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || { autoSaveEnabled: true };
      return settings.autoSaveEnabled !== false;
    } catch (error) {
      return true; // Default to enabled on error
    }
  }

  // Get inner icon element from wrapper
  function getInnerIcon(iconWrapper) {
    // If it's already the inner icon (has .kayko-icon class), return it
    if (iconWrapper.classList && iconWrapper.classList.contains('kayko-icon')) {
      return iconWrapper;
    }
    // Otherwise, find the inner icon
    return iconWrapper.querySelector ? iconWrapper.querySelector('.kayko-icon') : iconWrapper;
  }

  // Handle textarea input with debouncing
  async function handleTextareaInput(textarea, iconWrapper) {
    const icon = getInnerIcon(iconWrapper);
    if (!icon) return;
    
    // Check if auto-save is enabled
    const autoSaveEnabled = await isAutoSaveEnabled();
    if (!autoSaveEnabled) {
      // Auto-save is disabled, just update icon to show it's ready for manual save
      setIconState(icon, 'idle');
      icon.title = 'Kayko - Click to manually save prompt';
      return;
    }

    // Clear existing timer
    if (debounceTimers.has(textarea)) {
      clearTimeout(debounceTimers.get(textarea));
    }

    // Show saving state
    setIconState(icon, 'saving');
    icon.title = 'Kayko - Auto-saving...';

    // Set new timer
    const timer = setTimeout(async () => {
      const text = getTextContent(textarea);
      const success = await savePrompt(textarea, text);
      if (success) {
        setIconState(icon, 'saved');
        icon.title = 'Kayko - Saved! Click to view saved prompts';
        setTimeout(() => {
          setIconState(icon, 'idle');
          icon.title = 'Kayko - Click to view saved prompts';
        }, 2000);
      } else {
        setIconState(icon, 'idle');
        icon.title = 'Kayko - Click to view saved prompts';
      }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(textarea, timer);
  }

  // Manual save function
  async function manualSave(textarea, iconWrapper) {
    const icon = getInnerIcon(iconWrapper);
    if (!icon) return;
    
    const text = getTextContent(textarea);
    if (!text || text.trim().length < 3) {
      // Show brief feedback that text is too short
      const originalTitle = icon.title;
      icon.title = 'Text too short to save (minimum 3 characters)';
      setTimeout(() => {
        icon.title = originalTitle;
      }, 2000);
      return;
    }

    // Show saving state
    setIconState(icon, 'saving');
    icon.title = 'Saving...';

    const success = await savePrompt(textarea, text);
    if (success) {
      setIconState(icon, 'saved');
      icon.title = 'Saved! Right-click to view saved prompts';
      setTimeout(() => {
        setIconState(icon, 'idle');
        icon.title = 'Kayko - Click to manually save prompt (Right-click to view saved prompts)';
      }, 2000);
    } else {
      setIconState(icon, 'idle');
      icon.title = 'Kayko - Click to manually save prompt (Right-click to view saved prompts)';
    }
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
      
      const existingIconWrappers = document.querySelectorAll('.kayko-icon-wrapper');
      if (!existingIconWrappers || existingIconWrappers.length === 0) return;
      
      existingIconWrappers.forEach(iconWrapper => {
        try {
          // Check if this icon wrapper is still tracked using our Set
          if (!trackedIcons.has(iconWrapper)) {
            // Remove if not tracked
            iconWrapper.remove();
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
          // Always reposition when detected again (handles position changes)
          positionIcon(textarea, existing.icon);
          // Ensure only one image exists in the icon (apply to all platforms)
          const innerIcon = getInnerIcon(existing.icon);
          if (innerIcon) {
            const imgs = innerIcon.querySelectorAll('.kayko-icon-img');
            if (imgs.length > 1) {
              // Keep only the first one, remove the rest
              for (let i = 1; i < imgs.length; i++) {
                try {
                  imgs[i].remove();
                } catch (e) {
                  // Silently ignore
                }
              }
            }
          }
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

      // Get inner icon for title and event listeners
      const innerIcon = getInnerIcon(icon);
      
      // Update icon title based on auto-save status
      (async () => {
        const autoSaveEnabled = await isAutoSaveEnabled();
        if (!autoSaveEnabled && innerIcon) {
          innerIcon.title = 'Kayko - Click to manually save prompt (Right-click to view saved prompts)';
        }
      })();

      // Right-click handler to open side panel (works regardless of auto-save setting)
      if (innerIcon) {
        innerIcon.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
          if (!extensionContextWarningShown) {
            console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
            showExtensionContextNotification();
            extensionContextWarningShown = true;
          }
          return;
        }
        try {
          chrome.runtime.sendMessage({ action: 'openSidePanel' });
        } catch (error) {
          extensionContextValid = false;
          if (!extensionContextWarningShown) {
            console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
            showExtensionContextNotification();
            extensionContextWarningShown = true;
          }
        }
        });
      }

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

      // Use ResizeObserver to watch for textarea position/size changes
      // This catches when the textarea moves due to layout changes
      let resizeObserver = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          try {
            if (document.body.contains(textarea) && document.body.contains(icon)) {
              // Debounce resize observer updates
              if (positionUpdateTimers.has(icon)) {
                clearTimeout(positionUpdateTimers.get(icon));
              }
              
              const timer = setTimeout(() => {
                requestAnimationFrame(() => {
                  try {
                    if (document.body.contains(textarea) && document.body.contains(icon)) {
                      positionIcon(textarea, icon);
                    }
                  } catch (error) {
                    // Silently fail
                  }
                });
                positionUpdateTimers.delete(icon);
              }, 50); // 50ms debounce for resize updates (faster than mutation)
              
              positionUpdateTimers.set(icon, timer);
            }
          } catch (error) {
            // Silently fail on repositioning errors
          }
        });
        resizeObserver.observe(textarea);
        
        // Also observe parent elements that might affect position
        let parent = textarea.parentElement;
        let depth = 0;
        while (parent && depth < 5 && parent !== document.body) {
          resizeObserver.observe(parent);
          parent = parent.parentElement;
          depth++;
        }
      }

      // Use MutationObserver to watch for DOM changes that might affect textarea position
      // This catches when new messages are added, layout shifts occur, etc.
      const mutationObserver = new MutationObserver((mutations) => {
        try {
          if (!document.body.contains(textarea)) {
            // Textarea was removed
            if (trackedIcons && typeof trackedIcons.delete === 'function') {
              trackedIcons.delete(icon);
            }
            if (resizeObserver) {
              resizeObserver.disconnect();
            }
            // Clean up position update timer
            if (positionUpdateTimers.has(icon)) {
              clearTimeout(positionUpdateTimers.get(icon));
              positionUpdateTimers.delete(icon);
            }
            mutationObserver.disconnect();
            icon.remove();
            return;
          }
          
          // Check if any mutations might affect layout
          let shouldReposition = false;
          for (const mutation of mutations) {
            // If nodes were added/removed or attributes changed, reposition
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
              // Check if mutation is near the textarea or its ancestors
              let target = mutation.target;
              let checkDepth = 0;
              while (target && checkDepth < 10) {
                if (target === textarea || target.contains(textarea)) {
                  shouldReposition = true;
                  break;
                }
                target = target.parentElement;
                checkDepth++;
              }
              if (shouldReposition) break;
            }
          }
          
          if (shouldReposition && document.body.contains(textarea) && document.body.contains(icon)) {
            // Debounce position updates to avoid excessive repositioning
            if (positionUpdateTimers.has(icon)) {
              clearTimeout(positionUpdateTimers.get(icon));
            }
            
            const timer = setTimeout(() => {
              // Use requestAnimationFrame to batch position updates
              requestAnimationFrame(() => {
                try {
                  if (document.body.contains(textarea) && document.body.contains(icon)) {
                    positionIcon(textarea, icon);
                  }
                } catch (error) {
                  // Silently fail
                }
              });
              positionUpdateTimers.delete(icon);
            }, 100); // 100ms debounce for position updates
            
            positionUpdateTimers.set(icon, timer);
          }
        } catch (error) {
          console.error('Kayko: Error in mutation observer', error);
        }
      });
      
      // Observe the document body for changes that might affect layout
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'] // Watch for style/class changes that affect layout
      });

      // Store observers for cleanup
      trackedTextareas.set(textarea, { 
        icon, 
        textarea, 
        resizeObserver, 
        mutationObserver 
      });
      
      console.log('Kayko: Tracking textarea', textarea);
    } catch (error) {
      console.error('Kayko: Failed to track textarea', error);
    }
  }

  // Detect and track all textareas
  function detectTextareas() {
    // Only run on LLM websites
    if (!isLLMWebsite()) {
      return;
    }
    
    // Find all textareas and contenteditable elements
    // Note: [contenteditable] matches all elements with the attribute (regardless of value)
    // We'll filter out contenteditable="false" elements below
    const textareas = document.querySelectorAll('textarea, [contenteditable]');
    
    textareas.forEach(textarea => {
      // Skip if already tracked
      if (trackedTextareas.has(textarea)) return;
      
      // Check if element is actually contenteditable (some sites use contenteditable="false")
      const isContentEditable = textarea.isContentEditable || 
                                 textarea.getAttribute('contenteditable') === 'true' ||
                                 textarea.getAttribute('contenteditable') === '' ||
                                 textarea.hasAttribute('contenteditable');
      
      // Skip if contenteditable is explicitly false
      if (textarea.hasAttribute('contenteditable') && textarea.getAttribute('contenteditable') === 'false') {
        return;
      }
      
      // Get dimensions
      const rect = textarea.getBoundingClientRect();
      const hasRows = textarea.rows && textarea.rows > 1;
      const isVisible = rect.width > 0 && rect.height > 0;
      
      // Check if it's a known chat UI framework
      const className = textarea.className || '';
      const id = textarea.id || '';
      const placeholder = textarea.placeholder || textarea.getAttribute('placeholder') || '';
      const isKnownChatUI = className.includes('ProseMirror') || 
                           className.includes('tiptap') ||
                           className.includes('contenteditable') ||
                           className.includes('prompt') ||
                           className.includes('input') ||
                           className.includes('chat') ||
                           id.includes('prompt') ||
                           id.includes('input') ||
                           id.includes('chat') ||
                           placeholder.toLowerCase().includes('prompt') ||
                           placeholder.toLowerCase().includes('message');
      
      // Google AI Studio specific detection - check for Google AI Studio patterns
      const isAIStudio = window.location.hostname.includes('aistudio.google.com');
      const isAIStudioInput = isAIStudio && (
        className.includes('mat') || // Material Design classes common in Google apps
        className.includes('input') ||
        id.includes('input') ||
        textarea.getAttribute('role') === 'textbox' ||
        textarea.getAttribute('aria-label')?.toLowerCase().includes('prompt') ||
        textarea.getAttribute('aria-label')?.toLowerCase().includes('message')
      );
      
      // Track if it's likely a prompt input:
      // - Has minimum height (20px for contenteditable, 30px for textarea) OR multiple rows
      // - Is visible on screen
      // - Has a reasonable width (not a tiny input)
      // - OR is a known chat UI framework
      const minHeight = isContentEditable ? 20 : 30;
      const meetsSize = isVisible && rect.width > 100 && (rect.height > minHeight || hasRows || isKnownChatUI);
      
      // Google AI Studio specific: be more lenient with size requirements if it matches Google AI Studio patterns
      const meetsAIStudioSize = isAIStudioInput && isVisible && rect.width > 50 && rect.height > 15;
      
      if (meetsSize || meetsAIStudioSize) {
        console.log('Kayko: Detected textarea', {
          element: textarea,
          rect: rect,
          tagName: textarea.tagName,
          className: className,
          id: id,
          contentEditable: isContentEditable,
          contentEditableAttr: textarea.getAttribute('contenteditable'),
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
      // Only run on LLM websites
      if (!isLLMWebsite()) {
        console.log('Kayko: Not an LLM website, skipping initialization');
        return;
      }
      
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

