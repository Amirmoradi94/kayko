// Kayko Content Script - Textarea Detection and Auto-Save
(function() {
  'use strict';

  // Prevent duplicate initialization
  if (window.kaykoInitialized) {
    console.warn('Kayko: Content script already initialized, skipping');
    return;
  }
  window.kaykoInitialized = true;

  // Version check - helps identify if old cached code is running
  const KAYKO_VERSION = '1.0.1';
  console.log('Kayko: Content script v' + KAYKO_VERSION + ' loaded on', window.location.hostname);

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
        //console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
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
        //console.warn('Kayko: Extension context invalidated. Please refresh this page (F5) to restore functionality.');
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

  // Create and inject the Kayko icon - Cat with Ear Toggles Design
  // context: 'prompt' for LLM textareas, 'form' for regular forms
  function createIcon(textarea, context = 'prompt') {
    // Create wrapper container
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'kayko-icon-wrapper';
    iconWrapper.setAttribute('data-context', context);

    const icon = document.createElement('div');
    icon.className = 'kayko-icon idle';
    icon.setAttribute('data-context', context);
    
    // Create cat face SVG inline for better control
    const catSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    catSvg.setAttribute('viewBox', '0 0 64 64');
    catSvg.setAttribute('width', '56');
    catSvg.setAttribute('height', '56');
    catSvg.innerHTML = `
      <!-- Left Ear -->
      <path class="cat-ear cat-ear-left" d="M8 24 L16 8 L24 24 Z" fill="#FFB84D" stroke="#E59400" stroke-width="1.5"/>
      <path class="cat-ear-inner" d="M12 22 L16 12 L20 22 Z" fill="#FFD699"/>
      
      <!-- Right Ear -->
      <path class="cat-ear cat-ear-right" d="M40 24 L48 8 L56 24 Z" fill="#FFB84D" stroke="#E59400" stroke-width="1.5"/>
      <path class="cat-ear-inner" d="M44 22 L48 12 L52 22 Z" fill="#FFD699"/>
      
      <!-- Head -->
      <ellipse class="cat-head" cx="32" cy="38" rx="24" ry="20" fill="#FFB84D" stroke="#E59400" stroke-width="1.5"/>
      
      <!-- Left Eye -->
      <ellipse class="cat-eye cat-eye-left" cx="22" cy="36" rx="5" ry="6" fill="#2D3748"/>
      <ellipse class="cat-eye-shine" cx="20" cy="34" rx="2" ry="2" fill="white" opacity="0.8"/>
      
      <!-- Right Eye -->
      <ellipse class="cat-eye cat-eye-right" cx="42" cy="36" rx="5" ry="6" fill="#2D3748"/>
      <ellipse class="cat-eye-shine" cx="40" cy="34" rx="2" ry="2" fill="white" opacity="0.8"/>
      
      <!-- Nose -->
      <path class="cat-nose" d="M32 42 L29 46 L35 46 Z" fill="#FF8FA3"/>
      
      <!-- Mouth (omega shape ω) -->
      <path class="cat-mouth" d="M26 48 Q29 52 32 48 Q35 52 38 48" fill="none" stroke="#2D3748" stroke-width="1.5" stroke-linecap="round"/>
      
      <!-- Whiskers Left -->
      <line class="cat-whisker" x1="4" y1="40" x2="18" y2="42" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
      <line class="cat-whisker" x1="4" y1="46" x2="18" y2="46" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
      <line class="cat-whisker" x1="4" y1="52" x2="18" y2="50" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
      
      <!-- Whiskers Right -->
      <line class="cat-whisker" x1="60" y1="40" x2="46" y2="42" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
      <line class="cat-whisker" x1="60" y1="46" x2="46" y2="46" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
      <line class="cat-whisker" x1="60" y1="52" x2="46" y2="50" stroke="#E59400" stroke-width="1" stroke-linecap="round"/>
    `;
    
    icon.appendChild(catSvg);
    icon.title = 'Kayko - Click to view saved prompts';
    
    // Create ear toggles container
    const earToggles = document.createElement('div');
    earToggles.className = 'kayko-ear-toggles';
    earToggles.setAttribute('data-context', context);

    // Left ear toggle - Auto-save on/off (works for both prompts and forms)
    const leftToggle = document.createElement('button');
    leftToggle.className = 'kayko-toggle-left toggle-off';
    leftToggle.type = 'button';
    leftToggle.setAttribute('aria-label', 'Toggle auto-save');
    leftToggle.title = context === 'form' ? 'Form auto-save: OFF' : 'Auto-save: OFF';
    leftToggle.setAttribute('data-context', context);

    // Right ear toggle - Context-aware (Enhance for prompts, Restore for forms)
    const rightToggle = document.createElement('button');
    rightToggle.className = 'kayko-toggle-right';
    rightToggle.type = 'button';
    const rightLabel = context === 'form' ? 'Restore form data' : 'Enhance prompt with AI';
    rightToggle.setAttribute('aria-label', rightLabel);
    rightToggle.title = rightLabel;
    rightToggle.setAttribute('data-context', context);

    // Add different icon/styling for form context
    if (context === 'form') {
      rightToggle.classList.add('toggle-restore');
    }
    
    earToggles.appendChild(leftToggle);
    earToggles.appendChild(rightToggle);
    
    // Add elements to wrapper
    iconWrapper.appendChild(icon);
    iconWrapper.appendChild(earToggles);
    
    // Update left toggle state based on current auto-save setting
    updateToggleState(leftToggle, false, context);
    
    // Left toggle click handler - Toggle auto-save (context-aware)
    leftToggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      try {
        const result = await chrome.storage.local.get('settings');
        const currentSettings = result.settings || {
          maxPrompts: 100,
          autoSaveEnabled: false,
          formAutoSaveEnabled: true,
          openaiApiKey: ''
        };

        const isFormContext = context === 'form';
        const settingKey = isFormContext ? 'formAutoSaveEnabled' : 'autoSaveEnabled';
        const currentValue = currentSettings[settingKey];

        const updatedSettings = {
          ...currentSettings,
          [settingKey]: !currentValue
        };

        await chrome.storage.local.set({ settings: updatedSettings });

        // Update toggle state with animation
        updateToggleState(leftToggle, true, context);

        // Update icon title
        const newState = !currentValue ? 'ON' : 'OFF';
        const label = isFormContext ? 'Form auto-save' : 'Auto-save';
        icon.title = `Kayko - ${label} ${newState}`;

      } catch (error) {
        //console.error('Kayko: Error toggling auto-save', error);
      }
    });
    
    // Right toggle click handler - Context-aware (Enhance for prompts, Restore for forms)
    rightToggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      try {
        if (context === 'form') {
          // Form context: Restore form data
          // Find the parent form - textarea here is actually the form element
          const form = (textarea && textarea.tagName === 'FORM') ? textarea : textarea.closest('form');

          if (!form) {
            rightToggle.title = 'No form found';
            setTimeout(() => {
              rightToggle.title = 'Restore form data';
            }, 2000);
            return;
          }

          const success = await restoreFormData(form);
          if (success) {
            rightToggle.classList.add('toggle-feedback');
            rightToggle.title = 'Restored!';
            setTimeout(() => {
              rightToggle.classList.remove('toggle-feedback');
              rightToggle.title = 'Restore form data';
            }, 2000);
          } else {
            rightToggle.title = 'No saved data to restore';
            setTimeout(() => {
              rightToggle.title = 'Restore form data';
            }, 2000);
          }
        } else {
          // Prompt context: Enhance prompt
          const text = getTextContent(textarea);
          if (!text || text.trim().length < 3) {
            rightToggle.title = 'Type at least 3 characters first';
            setTimeout(() => {
              rightToggle.title = 'Enhance prompt with AI';
            }, 2000);
            return;
          }

          // Check for OpenAI API key
          const result = await chrome.storage.local.get('settings');
          const settings = result.settings || {};

          if (!settings.openaiApiKey) {
            rightToggle.title = 'Set OpenAI API key in settings first';
            // Open side panel to settings
            try {
              chrome.runtime.sendMessage({ action: 'openSidePanel' });
              setTimeout(() => {
                chrome.runtime.sendMessage({ action: 'openSettings' });
              }, 500);
            } catch (error) {
              //console.error('Kayko: Error opening settings', error);
            }
            setTimeout(() => {
              rightToggle.title = 'Enhance prompt with AI';
            }, 3000);
            return;
          }

          // Show enhancing state
          rightToggle.classList.add('toggle-feedback');
          rightToggle.title = 'Enhancing...';

          // Call enhance function (reuse existing logic)
          await enhancePromptInline(textarea, text, settings.openaiApiKey, rightToggle);
        }

      } catch (error) {
        //console.error('Kayko: Error in right toggle', error);
        rightToggle.title = context === 'form' ? 'Restore failed' : 'Enhancement failed';
        setTimeout(() => {
          const label = context === 'form' ? 'Restore form data' : 'Enhance prompt with AI';
          rightToggle.title = label;
        }, 2000);
      }
    });
    
    // Click handler for cat face - toggle side panel (open/close)
    icon.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        if (!extensionContextWarningShown) {
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
        return;
      }
      try {
        chrome.runtime.sendMessage({ action: 'toggleSidePanel' });
      } catch (error) {
        extensionContextValid = false;
        if (!extensionContextWarningShown) {
          showExtensionContextNotification();
          extensionContextWarningShown = true;
        }
      }
    });

    return iconWrapper;
  }
  
  // Update toggle state based on auto-save setting (context-aware)
  async function updateToggleState(toggle, animate = false, context = 'prompt') {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || { autoSaveEnabled: false, formAutoSaveEnabled: true };

      const isFormContext = context === 'form';
      const settingKey = isFormContext ? 'formAutoSaveEnabled' : 'autoSaveEnabled';
      const isEnabled = settings[settingKey] === true;

      toggle.classList.toggle('toggle-on', isEnabled);
      toggle.classList.toggle('toggle-off', !isEnabled);

      const label = isFormContext ? 'Form auto-save' : 'Auto-save';
      toggle.title = isEnabled ? `${label}: ON` : `${label}: OFF`;

      if (animate) {
        toggle.classList.add('toggle-feedback');
        setTimeout(() => {
          toggle.classList.remove('toggle-feedback');
        }, 300);
      }
    } catch (error) {
      console.error('Kayko: Error updating toggle state', error);
    }
  }
  
  // Enhance prompt inline and insert back into textarea
  async function enhancePromptInline(textarea, text, apiKey, toggle) {
    try {
      const systemPrompt = `You are an expert prompt engineer. Transform the user's prompt into a better version that will get superior AI responses.

WHAT TO DO:
- Rewrite the prompt with more clarity and detail
- Make reasonable assumptions to fill in gaps (don't ask questions!)
- Add helpful context, constraints, and output format
- Structure complex requests with clear steps
- Keep the original intent but make it more effective

WHAT NOT TO DO:
- NEVER ask clarifying questions
- NEVER say "please provide more details"
- NEVER ask what the user wants
- NEVER output anything except the enhanced prompt itself

PROMPT TYPE ADAPTATIONS:
- Image/Design: Add style, mood, lighting, composition, artistic approach
- Coding: Add language, best practices, error handling, comments
- Writing: Add tone, audience, structure, length guidance
- Analysis: Add scope, criteria, format for findings
- Creative: Add vivid details while preserving creative freedom

EXAMPLE:
Original: "write a poem about love"
Enhanced: "Write a heartfelt poem about love, exploring themes of connection and vulnerability. Use vivid imagery and metaphors. The poem should be 12-16 lines with a gentle, reflective tone. Include at least one unexpected comparison that illuminates love in a new way."

OUTPUT RULE:
Return ONLY the enhanced prompt. No quotes, no labels, no explanations. Just the improved prompt text ready to paste and use.`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.5,
          max_tokens: 1500
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const enhancedText = data.choices[0]?.message?.content || text;
      
      // Insert enhanced text back into textarea
      if (textarea.tagName === 'TEXTAREA') {
        textarea.value = enhancedText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (textarea.isContentEditable) {
        textarea.textContent = enhancedText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      toggle.classList.remove('toggle-feedback');
      toggle.title = 'Enhanced! ✓';
      setTimeout(() => {
        toggle.title = 'Enhance prompt with AI';
      }, 2000);
      
    } catch (error) {
      console.error('Kayko: Enhancement error', error);
      toggle.classList.remove('toggle-feedback');
      toggle.title = 'Enhancement failed';
      setTimeout(() => {
        toggle.title = 'Enhance prompt with AI';
      }, 2000);
    }
  }

  // Position the icon relative to textarea (attached to top-right border, outside)
  function positionIcon(textarea, iconWrapper) {
    const rect = textarea.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // iconWrapper is the wrapper div returned by createIcon
    iconWrapper.style.position = 'absolute';
    
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
      iconWrapper.style.top = `${rect.top + scrollTop + (rect.height / 2) - 32}px`; // Vertically centered (half of 64px wrapper)
      iconWrapper.style.left = `${rect.right + scrollLeft + 15}px`; // 15px to the right of textarea
    } else if (isPerplexity) {
      // For Perplexity, position relative to top border of textarea
      iconWrapper.style.top = `${rect.top + scrollTop - 60}px`; // Relative to top border
      iconWrapper.style.left = `${rect.right + scrollLeft - 50}px`; // 50px from right edge
    } else if (isClaude) {
      // For Claude, position higher than default
      iconWrapper.style.top = `${rect.top + scrollTop - 63}px`; // Above textarea
      iconWrapper.style.left = `${rect.right + scrollLeft - 50}px`; // From right edge
    } else if (isAIStudio || isGemini) {
      // For Google AI Studio and Gemini, position higher than default
      iconWrapper.style.top = `${rect.top + scrollTop - 66}px`; // Above textarea
      iconWrapper.style.left = `${rect.right + scrollLeft - 50}px`; // From right edge
    } else {
      // For other platforms, keep top-right position
      iconWrapper.style.top = `${rect.top + scrollTop - 28}px`; // 28px above (half the icon height)
      iconWrapper.style.left = `${rect.right + scrollLeft - 28}px`; // 28px from right edge (half icon width)
    }
    
    iconWrapper.style.zIndex = '10000';
    console.log('Kayko: Icon positioned at', iconWrapper.style.top, iconWrapper.style.left);
  }

  // Update icon state - now uses CSS classes for SVG cat face animations
  function setIconState(icon, state) {
    try {
      icon.classList.remove('idle', 'saving', 'saved');
      icon.classList.add(state);
      // CSS handles all animations for the cat face SVG
      //console.log('Kayko: Icon state changed to', state);
    } catch (error) {
      console.error('Kayko: Error setting icon state', error);
    }
  }

  // Save prompt to storage
  // forceSave: true = always save (used for Enter key), false = check for duplicates/substrings
  async function savePrompt(textarea, text, forceSave = false) {
    if (!text || text.trim().length < 3) {
      //console.log('Kayko: Text too short to save:', text?.length || 0, 'chars');
      return false; // Don't save very short text
    }
    
    //console.log('Kayko: Attempting to save prompt:', text.substring(0, 50) + '...', 'forceSave:', forceSave);

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
          //console.log('Kayko: Duplicate detected, skipping save');
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
          
          // Check if the existing prompt contains the new text (user deleted some characters)
          // In this case, UPDATE the existing prompt with the shorter text
          if (existingPrompt.text.includes(text)) {
            // The new text is a substring of an existing prompt - update it
            existingPrompt.text = text;
            existingPrompt.timestamp = prompt.timestamp;
            existingPrompt.url = prompt.url;
            // Move updated prompt to the beginning (most recent)
            prompts.splice(i, 1);
            prompts.unshift(existingPrompt);
            foundExistingPrompt = true;
            break;
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
      //console.log('Kayko: Prompt saved successfully! Total prompts:', prompts.length);
      
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
        return false; // Default to disabled if can't check
      }
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || { autoSaveEnabled: false };
      return settings.autoSaveEnabled !== false;
    } catch (error) {
      return false; // Default to disabled on error
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
      console.log('Kayko: Created icon for textarea');
      
      // Safely append to body
      if (document.body) {
        document.body.appendChild(icon);
        console.log('Kayko: Icon appended to body');
      } else {
        console.warn('Kayko: document.body not available');
        return;
      }
      
      // Position icon
      positionIcon(textarea, icon);
      console.log('Kayko: Icon positioned');

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

      // Add Enter key listener to save prompt when Enter is pressed
      const enterKeyHandler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          //console.log('Kayko: Enter key pressed!');
          try {
            // Capture text immediately before it might be cleared
            const text = getTextContent(textarea);
            //console.log('Kayko: Captured text on Enter:', text?.substring(0, 50) || '(empty)');
            if (text && text.trim().length >= 3) {
              // Save the prompt asynchronously (don't block Enter key)
              const innerIcon = getInnerIcon(icon);
              if (innerIcon) {
                setIconState(innerIcon, 'saving');
                innerIcon.title = 'Saving...';
              }
              
              // Save without awaiting to not block the Enter key submission
              // forceSave = true to bypass substring check (user pressed Enter = final intent)
              savePrompt(textarea, text, true).then(success => {
                if (innerIcon) {
                  if (success) {
                    setIconState(innerIcon, 'saved');
                    innerIcon.title = 'Saved!';
                    setTimeout(async () => {
                      setIconState(innerIcon, 'idle');
                      const autoSaveEnabled = await isAutoSaveEnabled();
                      innerIcon.title = autoSaveEnabled 
                        ? 'Kayko - Click to view saved prompts' 
                        : 'Kayko - Click to manually save prompt';
                    }, 2000);
                  } else {
                    setIconState(innerIcon, 'idle');
                    isAutoSaveEnabled().then(autoSaveEnabled => {
                      innerIcon.title = autoSaveEnabled 
                        ? 'Kayko - Click to view saved prompts' 
                        : 'Kayko - Click to manually save prompt';
                    });
                  }
                }
              }).catch(error => {
                console.error('Kayko: Error saving prompt on Enter', error);
              });
            }
          } catch (error) {
            console.error('Kayko: Error in Enter key handler', error);
          }
        }
      };
      
      textarea.addEventListener('keydown', enterKeyHandler);

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
      
      //console.log('Kayko: Tracking textarea', textarea);
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
    console.log('Kayko: Found', textareas.length, 'potential textarea/contenteditable elements');
    
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
      const ariaLabel = textarea.getAttribute('aria-label') || textarea.getAttribute('aria-labelledby') || '';
      const isKnownChatUI = className.includes('ProseMirror') || 
                           className.includes('tiptap') ||
                           className.includes('contenteditable') ||
                           className.includes('prompt') ||
                           className.includes('input') ||
                           className.includes('chat') ||
                           className.includes('textarea') ||
                           className.includes('message') ||
                           className.includes('query') ||
                           id.includes('prompt') ||
                           id.includes('input') ||
                           id.includes('chat') ||
                           id.includes('message') ||
                           id.includes('query') ||
                           placeholder.toLowerCase().includes('prompt') ||
                           placeholder.toLowerCase().includes('message') ||
                           placeholder.toLowerCase().includes('ask') ||
                           placeholder.toLowerCase().includes('type') ||
                           ariaLabel.toLowerCase().includes('prompt') ||
                           ariaLabel.toLowerCase().includes('message') ||
                           ariaLabel.toLowerCase().includes('ask');
      
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
      const minWidth = isKnownChatUI ? 50 : 100; // Be more lenient for known chat UIs
      const meetsSize = isVisible && rect.width > minWidth && (rect.height > minHeight || hasRows || isKnownChatUI);
      
      // Google AI Studio specific: be more lenient with size requirements if it matches Google AI Studio patterns
      const meetsAIStudioSize = isAIStudioInput && isVisible && rect.width > 50 && rect.height > 15;
      
      // Perplexity and other LLM sites: be more lenient for contenteditable elements
      const isPerplexity = window.location.hostname.includes('perplexity.ai');
      const meetsLLMContentEditable = isPerplexity && isContentEditable && isVisible && rect.width > 50 && rect.height > 15;
      
      if (meetsSize || meetsAIStudioSize || meetsLLMContentEditable) {
        console.log('Kayko: Detected valid textarea', {
          tagName: textarea.tagName,
          className: className,
          id: id,
          contentEditable: isContentEditable,
          rect: { width: rect.width, height: rect.height },
          isKnownChatUI: isKnownChatUI
        });
        try {
          trackTextarea(textarea);
        } catch (error) {
          console.error('Kayko: Error tracking textarea', error);
        }
      } else {
        console.log('Kayko: Skipped textarea (doesn\'t meet size requirements)', {
          tagName: textarea.tagName,
          width: rect.width,
          height: rect.height,
          minHeight: minHeight
        });
      }
    });
  }

  // Initialize
  function init() {
    try {
      const hostname = window.location.hostname;
      const isLLM = isLLMWebsite();
      
      console.log('Kayko: Content script initialized on', hostname);
      console.log('Kayko: Is LLM website?', isLLM);
      
      // Only run textarea detection on LLM websites
      if (!isLLM) {
        console.log('Kayko: Not an LLM website, skipping textarea detection (form detection will still run)');
        return;
      }
      
      // Clean up any existing icons first (in case of page reactivation)
      cleanupIcons();
      
      // Initial detection
      console.log('Kayko: Starting textarea detection...');
      detectTextareas();

      // Delayed detection for dynamically loaded content
      setTimeout(() => {
        try {
          //console.log('Kayko: Running delayed detection (500ms)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (500ms)', error);
        }
      }, 500);
      
      setTimeout(() => {
        try {
          //console.log('Kayko: Running delayed detection (1s)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (1s)', error);
        }
      }, 1000);
      
      setTimeout(() => {
        try {
          //console.log('Kayko: Running delayed detection (2s)');
          detectTextareas();
        } catch (error) {
          console.error('Kayko: Error in delayed detection (2s)', error);
        }
      }, 2000);
      
      setTimeout(() => {
        try {
          //console.log('Kayko: Running delayed detection (3s)');
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

  // Call init to start textarea detection
  init();

  // Expose manual trigger for debugging
  window.kaykoDetect = function() {
    //console.log('Kayko: Manual detection triggered');
    detectTextareas();
    //console.log('Kayko: Currently tracking', trackedIcons.size, 'icons');
  };

  // ============================================
  // FORM AUTO-SAVE FUNCTIONALITY
  // ============================================

  const FORM_DEBOUNCE_DELAY = 2000; // 2 seconds
  const trackedForms = new WeakMap();
  const formSaveTimers = new WeakMap();
  const formRestoreButtons = new WeakMap();

  // Check if form auto-save is enabled
  async function isFormAutoSaveEnabled() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return false;
      }
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || { formAutoSaveEnabled: true };
      return settings.formAutoSaveEnabled !== false;
    } catch (error) {
      return false;
    }
  }

  // Check if field is sensitive (password, credit card, etc.)
  function isSensitiveField(field) {
    const type = field.type?.toLowerCase() || '';
    const name = field.name?.toLowerCase() || '';
    const id = field.id?.toLowerCase() || '';
    const autocomplete = field.getAttribute('autocomplete')?.toLowerCase() || '';
    
    // Password fields
    if (type === 'password') return true;
    
    // Credit card fields
    if (name.includes('card') || name.includes('cvv') || name.includes('cvc') || 
        id.includes('card') || id.includes('cvv') || id.includes('cvc') ||
        autocomplete.includes('cc-')) return true;
    
    // SSN fields
    if (name.includes('ssn') || id.includes('ssn') || 
        name.includes('social') || id.includes('social')) return true;
    
    // Hidden fields (usually not user input)
    if (type === 'hidden') return true;
    
    return false;
  }

  // Get form field value based on field type
  function getFormFieldValue(field) {
    const type = field.type?.toLowerCase() || '';

    // Skip file inputs (can't restore for security reasons)
    if (type === 'file') {
      return null;
    }

    if (type === 'checkbox') {
      return {
        checked: field.checked,
        displayValue: field.checked ? '✓ Checked' : '✗ Unchecked'
      };
    }

    if (type === 'radio') {
      // For radio buttons, get the label of the selected option
      const label = getFieldLabel(field);
      return {
        checked: field.checked,
        value: field.value,
        displayValue: field.checked ? label : null
      };
    }

    if (field.tagName === 'SELECT') {
      if (field.multiple) {
        const selected = Array.from(field.selectedOptions);
        return {
          values: selected.map(opt => opt.value),
          displayValue: selected.map(opt => opt.text || opt.value).join(', ')
        };
      }
      const selectedOption = field.options[field.selectedIndex];
      return {
        value: field.value,
        displayValue: selectedOption ? (selectedOption.text || field.value) : field.value
      };
    }

    // Date/time formatting
    if (type === 'date' && field.value) {
      try {
        const date = new Date(field.value);
        return {
          value: field.value,
          displayValue: date.toLocaleDateString()
        };
      } catch (e) {
        return { value: field.value, displayValue: field.value };
      }
    }

    if (type === 'time' && field.value) {
      return {
        value: field.value,
        displayValue: field.value // Keep time as-is, already readable
      };
    }

    if (type === 'datetime-local' && field.value) {
      try {
        const date = new Date(field.value);
        return {
          value: field.value,
          displayValue: date.toLocaleString()
        };
      } catch (e) {
        return { value: field.value, displayValue: field.value };
      }
    }

    if (type === 'color' && field.value) {
      return {
        value: field.value,
        displayValue: field.value.toUpperCase()
      };
    }

    if (type === 'range' && field.value) {
      const min = field.min || 0;
      const max = field.max || 100;
      return {
        value: field.value,
        displayValue: `${field.value} (${min}-${max})`
      };
    }

    // Default: text, email, url, tel, number, etc.
    return {
      value: field.value || '',
      displayValue: field.value || ''
    };
  }

  // Set form field value based on field type
  function setFormFieldValue(field, storedValue) {
    const type = field.type?.toLowerCase() || '';

    // Handle new object format or legacy simple values
    let value = storedValue;
    if (storedValue && typeof storedValue === 'object') {
      if (type === 'checkbox' || type === 'radio') {
        value = storedValue.checked;
      } else if (field.tagName === 'SELECT' && field.multiple) {
        value = storedValue.values || storedValue.value;
      } else {
        value = storedValue.value;
      }
    }

    if (type === 'checkbox' || type === 'radio') {
      field.checked = Boolean(value);
    } else if (field.tagName === 'SELECT') {
      if (field.multiple && Array.isArray(value)) {
        Array.from(field.options).forEach(opt => {
          opt.selected = value.includes(opt.value);
        });
      } else {
        field.value = value;
      }
    } else {
      field.value = value || '';
    }

    // Trigger events for form validation
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Generate unique identifier for form (stable across page reloads)
  function getFormIdentifier(form) {
    // Try form ID first (most stable)
    if (form.id) {
      console.log('Kayko: Using form ID as identifier:', form.id);
      return form.id;
    }

    // Try form name (stable if defined)
    if (form.name) {
      console.log('Kayko: Using form name as identifier:', form.name);
      return form.name;
    }

    // Try form action URL (stable if defined)
    if (form.action) {
      try {
        const url = new URL(form.action, window.location.href);
        console.log('Kayko: Using form action pathname as identifier:', url.pathname);
        return url.pathname;
      } catch (e) {
        // Invalid URL, use as-is
        console.log('Kayko: Using form action as identifier:', form.action);
        return form.action;
      }
    }

    // If only one form on page, use consistent identifier
    const forms = Array.from(document.querySelectorAll('form'));
    if (forms.length === 1) {
      console.log('Kayko: Single form detected, using "main-form" identifier');
      return 'main-form';
    }

    // Fallback: Create stable identifier based on form structure
    // Use field names/ids to create a signature (stable as long as form structure doesn't change)
    const fields = form.querySelectorAll('input, textarea, select');
    const signature = Array.from(fields)
      .map(f => f.name || f.id || f.type)
      .filter(Boolean)
      .slice(0, 5) // Use first 5 fields for signature
      .join('-');

    if (signature) {
      const hash = hashString(signature);
      console.log('Kayko: Using form structure hash as identifier:', `form-${hash}`, '(from signature:', signature + ')');
      return `form-${hash}`;
    }

    // Last resort: use form's position/index (least stable, may change if DOM changes)
    const index = forms.indexOf(form);
    console.warn('Kayko: Using form index as identifier (unstable):', `form-${index}`);
    return `form-${index}`;
  }

  // Simple hash function for strings
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Generate storage key for form data
  function getFormStorageKey(form) {
    const formId = getFormIdentifier(form);
    const url = window.location.origin + window.location.pathname;
    return `${url}#${formId}`;
  }

  // Get all form fields (excluding sensitive ones)
  // Get human-readable label for a form field
  function getFieldLabel(field) {
    // 1. Try <label for="fieldId">
    if (field.id) {
      const labelFor = document.querySelector(`label[for="${field.id}"]`);
      if (labelFor && labelFor.textContent) {
        return labelFor.textContent.trim().replace(/[:\*\s]+$/, '');
      }
    }

    // 2. Try parent <label> element
    const parentLabel = field.closest('label');
    if (parentLabel) {
      // Get text content but exclude the input's text
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(i => i.remove());
      const text = clone.textContent.trim().replace(/[:\*\s]+$/, '');
      if (text) return text;
    }

    // 3. Try aria-label
    if (field.getAttribute('aria-label')) {
      return field.getAttribute('aria-label').trim();
    }

    // 4. Try aria-labelledby
    const labelledBy = field.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl && labelEl.textContent) {
        return labelEl.textContent.trim().replace(/[:\*\s]+$/, '');
      }
    }

    // 5. Try placeholder
    if (field.placeholder) {
      return field.placeholder.trim();
    }

    // 6. Try nearby label in same container (common pattern)
    const parent = field.parentElement;
    if (parent) {
      // Look for label sibling
      const siblingLabel = parent.querySelector('label');
      if (siblingLabel && siblingLabel !== parentLabel) {
        const text = siblingLabel.textContent.trim().replace(/[:\*\s]+$/, '');
        if (text) return text;
      }

      // Look for previous sibling text
      let sibling = field.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === 'LABEL' || sibling.classList?.contains('label')) {
          const text = sibling.textContent.trim().replace(/[:\*\s]+$/, '');
          if (text) return text;
        }
        sibling = sibling.previousElementSibling;
      }
    }

    // 7. Try title attribute
    if (field.title) {
      return field.title.trim();
    }

    // 8. Fallback to name or id (cleaned up)
    const fallback = field.name || field.id || '';
    // Convert camelCase or snake_case to readable text
    return fallback
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim() || 'Field';
  }

  function getFormFields(form) {
    const fields = {};
    const inputs = form.querySelectorAll('input, textarea, select');
    const radioGroups = new Map(); // Track radio button groups

    inputs.forEach(field => {
      if (isSensitiveField(field)) {
        return; // Skip sensitive fields
      }

      const type = field.type?.toLowerCase() || '';

      // Skip file inputs
      if (type === 'file') {
        return;
      }

      // Handle radio buttons specially - group them by name
      if (type === 'radio' && field.name) {
        if (!radioGroups.has(field.name)) {
          radioGroups.set(field.name, []);
        }
        radioGroups.get(field.name).push(field);
        return; // Process radio groups separately
      }

      // Prefer ID, fallback to name, then use type + index
      const key = field.id || field.name || `${field.tagName.toLowerCase()}-${type || 'text'}-${Array.from(form.querySelectorAll(field.tagName)).indexOf(field)}`;

      const fieldValue = getFormFieldValue(field);
      if (fieldValue === null) {
        return; // Skip fields that return null (like file inputs)
      }

      if (key) {
        fields[key] = {
          value: fieldValue,
          type: type || field.tagName.toLowerCase(),
          id: field.id,
          name: field.name,
          label: getFieldLabel(field),
          selector: getFieldSelector(field)
        };
      }
    });

    // Process radio button groups
    radioGroups.forEach((radios, groupName) => {
      const selectedRadio = radios.find(r => r.checked);
      const firstRadio = radios[0];

      // Get group label (usually from fieldset legend or nearby label)
      let groupLabel = '';
      const fieldset = firstRadio.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) {
          groupLabel = legend.textContent.trim().replace(/[:\*\s]+$/, '');
        }
      }
      if (!groupLabel) {
        // Try to get label from the group's container
        const container = firstRadio.closest('[role="radiogroup"], .form-group, .radio-group');
        if (container) {
          const label = container.querySelector('label:first-child, .label');
          if (label && !label.querySelector('input')) {
            groupLabel = label.textContent.trim().replace(/[:\*\s]+$/, '');
          }
        }
      }
      if (!groupLabel) {
        groupLabel = groupName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase());
      }

      fields[groupName] = {
        value: {
          selectedValue: selectedRadio ? selectedRadio.value : null,
          displayValue: selectedRadio ? getFieldLabel(selectedRadio) : 'None selected'
        },
        type: 'radio-group',
        name: groupName,
        label: groupLabel,
        selector: `[name="${groupName}"]`
      };
    });

    return fields;
  }

  // Get CSS selector for field (for restoration)
  function getFieldSelector(field) {
    if (field.id) {
      return `#${field.id}`;
    }
    if (field.name) {
      return `[name="${field.name}"]`;
    }
    // Fallback selector
    const tag = field.tagName.toLowerCase();
    const type = field.type ? `[type="${field.type}"]` : '';
    return `${tag}${type}`;
  }

  // Find field by stored key
  function findFormField(form, key, fieldData) {
    // Try ID first
    if (fieldData.id) {
      const field = form.querySelector(`#${fieldData.id}`);
      if (field) return field;
    }
    
    // Try name
    if (fieldData.name) {
      const field = form.querySelector(`[name="${fieldData.name}"]`);
      if (field) return field;
    }
    
    // Try selector
    if (fieldData.selector) {
      try {
        const field = form.querySelector(fieldData.selector);
        if (field) return field;
      } catch (e) {
        // Invalid selector
      }
    }
    
    // Fallback: try key as ID or name
    let field = form.querySelector(`#${key}`);
    if (field) return field;
    field = form.querySelector(`[name="${key}"]`);
    if (field) return field;
    
    return null;
  }

  // Save form data to storage
  async function saveFormData(form) {
    try {
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('Kayko: Extension context invalid, cannot save form data');
        return false;
      }
      
      const enabled = await isFormAutoSaveEnabled();
      if (!enabled) {
        console.log('Kayko: Form auto-save disabled');
        return false;
      }
      
      const storageKey = getFormStorageKey(form);
      const fields = getFormFields(form);
      
      console.log('Kayko: Saving form data, found', Object.keys(fields).length, 'fields');
      
      // Don't save if form is empty
      const hasData = Object.values(fields).some(f => {
        const val = f.value;
        if (val === null || val === undefined) return false;
        if (typeof val === 'boolean') return val;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'object') {
          // Handle new object format
          if (val.checked !== undefined) return val.checked;
          if (val.selectedValue !== undefined) return val.selectedValue !== null;
          if (val.values) return val.values.length > 0;
          if (val.value !== undefined) return val.value && val.value.toString().trim().length > 0;
          if (val.displayValue) return val.displayValue && val.displayValue.toString().trim().length > 0;
        }
        return val && val.toString().trim().length > 0;
      });
      
      if (!hasData) {
        console.log('Kayko: Form is empty, removing saved data');
        // Remove saved data if form is empty
        const result = await chrome.storage.local.get('formData');
        const formData = result.formData || {};
        delete formData[storageKey];
        await chrome.storage.local.set({ formData });
        updateRestoreButton(form, false);
        return false;
      }
      
      const formData = {
        formId: getFormIdentifier(form),
        url: window.location.href,
        timestamp: Date.now(),
        fields: {}
      };
      
      // Store field data including human-readable labels
      Object.keys(fields).forEach(key => {
        formData.fields[key] = {
          value: fields[key].value,
          type: fields[key].type,
          id: fields[key].id,
          name: fields[key].name,
          label: fields[key].label,
          selector: fields[key].selector
        };
      });
      
      const result = await chrome.storage.local.get('formData');
      const allFormData = result.formData || {};
      const isUpdate = allFormData.hasOwnProperty(storageKey);
      allFormData[storageKey] = formData;

      await chrome.storage.local.set({ formData: allFormData });

      console.log(`Kayko: Form data ${isUpdate ? 'updated' : 'created'} successfully (key: ${storageKey})`);
      
      // Update restore button visibility
      updateRestoreButton(form, true);
      
      return true;
    } catch (error) {
      console.error('Kayko: Error saving form data', error);
      return false;
    }
  }

  // Check if a form field is empty
  function isFieldEmpty(field) {
    const type = field.type?.toLowerCase() || '';

    // Checkbox/radio - consider unchecked as empty
    if (type === 'checkbox' || type === 'radio') {
      return !field.checked;
    }

    // Select - check if default option is selected
    if (field.tagName === 'SELECT') {
      if (field.multiple) {
        return field.selectedOptions.length === 0;
      }
      // Check if value is empty or is the first/default option
      return !field.value || field.selectedIndex === 0;
    }

    // Text-based inputs (text, textarea, email, etc.)
    const value = field.value || '';
    return value.trim().length === 0;
  }

  // Restore form data from storage
  async function restoreFormData(form) {
    try {
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return false;
      }
      
      const storageKey = getFormStorageKey(form);
      const result = await chrome.storage.local.get('formData');
      const allFormData = result.formData || {};
      const savedData = allFormData[storageKey];
      
      if (!savedData || !savedData.fields) {
        return false;
      }
      
      let restoredCount = 0;

      // Restore each field only if it's empty
      Object.keys(savedData.fields).forEach(key => {
        const fieldData = savedData.fields[key];

        // Handle radio groups specially
        if (fieldData.type === 'radio-group') {
          const radios = form.querySelectorAll(`[name="${key}"]`);
          const hasSelection = Array.from(radios).some(r => r.checked);

          // Only restore if no radio is selected
          if (!hasSelection) {
            const selectedValue = fieldData.value?.selectedValue;
            if (selectedValue) {
              radios.forEach(radio => {
                if (radio.value === selectedValue) {
                  radio.checked = true;
                  radio.dispatchEvent(new Event('change', { bubbles: true }));
                  restoredCount++;
                }
              });
            }
          }
          return;
        }

        const field = findFormField(form, key, fieldData);

        if (field && !isSensitiveField(field)) {
          try {
            // Check if field is empty before restoring
            if (isFieldEmpty(field)) {
              setFormFieldValue(field, fieldData.value);
              restoredCount++;
            }
          } catch (e) {
            console.warn('Kayko: Error restoring field', key, e);
          }
        }
      });
      
      if (restoredCount > 0) {
        showRestoreNotification(`Restored ${restoredCount} field${restoredCount > 1 ? 's' : ''}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Kayko: Error restoring form data', error);
      return false;
    }
  }

  // Show restore notification
  function showRestoreNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'kayko-form-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10B981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: kayko-notification-slide 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'kayko-notification-slide 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Create restore button for form
  function createRestoreButton(form) {
    const button = document.createElement('button');
    button.className = 'kayko-form-restore-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2L10.163 6.403L15 7.095L11.5 10.507L12.326 15.323L8 13.045L3.674 15.323L4.5 10.507L1 7.095L5.837 6.403L8 2Z" fill="currentColor"/>
      </svg>
      <span>Restore Form</span>
    `;
    button.title = 'Restore saved form data';
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const success = await restoreFormData(form);
      if (success) {
        button.classList.add('restored');
        setTimeout(() => {
          button.classList.remove('restored');
        }, 2000);
      }
    });
    
    return button;
  }

  // Update restore button visibility (now handles icons instead of buttons)
  async function updateRestoreButton(form, hasData) {
    // With the new universal icon approach, we don't need to show/hide
    // The icon is always visible and handles restore functionality
    // This function is kept for compatibility but doesn't need to do anything
    let icon = formRestoreButtons.get(form);

    if (icon && icon.classList && icon.classList.contains('kayko-icon-wrapper')) {
      // Icon already exists, no action needed
      console.log('Kayko: Form icon already exists and visible');
    }
  }

  // Check for saved data and show restore button
  async function checkForSavedFormData(form) {
    try {
      if (!extensionContextValid || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('Kayko: Cannot check for saved form data - extension context invalid');
        return;
      }
      
      const storageKey = getFormStorageKey(form);
      console.log('Kayko: Checking for saved data with key:', storageKey);
      const result = await chrome.storage.local.get('formData');
      const allFormData = result.formData || {};
      const savedData = allFormData[storageKey];
      
      if (savedData && savedData.fields && Object.keys(savedData.fields).length > 0) {
        console.log('Kayko: Found saved data for form, showing restore button');
        updateRestoreButton(form, true);
      } else {
        console.log('Kayko: No saved data found for this form');
      }
    } catch (error) {
      console.error('Kayko: Error checking for saved form data', error);
    }
  }

  // Handle form field input with debouncing
  function handleFormFieldInput(form) {
    // Clear existing timer
    if (formSaveTimers.has(form)) {
      clearTimeout(formSaveTimers.get(form));
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      await saveFormData(form);
      formSaveTimers.delete(form);
    }, FORM_DEBOUNCE_DELAY);
    
    formSaveTimers.set(form, timer);
  }

  // Track a form
  async function trackForm(form) {
    if (trackedForms.has(form)) {
      return; // Already tracked
    }

    try {
      const enabled = await isFormAutoSaveEnabled();
      if (!enabled) {
        console.log('Kayko: Form auto-save disabled, skipping form tracking');
        return;
      }

      trackedForms.set(form, true);
      console.log('Kayko: Form tracked successfully');

      // Create and inject cat icon for form (with 'form' context)
      const formIcon = createIcon(form, 'form');

      // Append to documentElement (html) to avoid stacking context issues
      if (document.documentElement) {
        document.documentElement.appendChild(formIcon);
        console.log('Kayko: Form icon appended to documentElement');
      } else if (document.body) {
        document.body.appendChild(formIcon);
        console.log('Kayko: Form icon appended to body');
      } else {
        console.warn('Kayko: Neither documentElement nor body available for form icon');
        return;
      }

      // Position icon at bottom-right corner of viewport (fixed position)
      const positionFormIcon = () => {
        formIcon.style.position = 'fixed';
        formIcon.style.display = 'block';
        formIcon.style.visibility = 'visible';
        formIcon.style.opacity = '1';
        formIcon.style.bottom = '20px';
        formIcon.style.right = '20px';
        formIcon.style.top = 'auto';
        formIcon.style.left = 'auto';
        formIcon.style.zIndex = '2147483647';

        console.log('Kayko: Form icon positioned at bottom-right corner (fixed)');
      };

      positionFormIcon();

      // Store icon reference
      formRestoreButtons.set(form, formIcon);
      if (trackedIcons && typeof trackedIcons.add === 'function') {
        trackedIcons.add(formIcon);
      }

      // Check for existing saved data
      await checkForSavedFormData(form);

      // Add input listeners to all fields
      const handleFieldChange = (e) => {
        handleFormFieldInput(form);
      };

      form.addEventListener('input', handleFieldChange, { passive: true });
      form.addEventListener('change', handleFieldChange, { passive: true });

      // Clear saved data on form submit (optional)
      form.addEventListener('submit', async () => {
        // Optionally clear saved data after successful submit
        // Uncomment if desired:
        // const storageKey = getFormStorageKey(form);
        // const result = await chrome.storage.local.get('formData');
        // const formData = result.formData || {};
        // delete formData[storageKey];
        // await chrome.storage.local.set({ formData });
      }, { passive: true });

      // Icon stays at bottom-right corner with fixed positioning, no need to reposition on scroll/resize
      console.log('Kayko: Form icon will stay at bottom-right corner (fixed positioning)');

    } catch (error) {
      console.error('Kayko: Error tracking form', error);
    }
  }

  // Detect all forms on page
  function detectForms() {
    // Skip form detection on LLM websites - they use textarea detection instead
    if (isLLMWebsite()) {
      console.log('Kayko: LLM website detected, skipping form detection (using textarea detection instead)');
      return;
    }
    
    const forms = document.querySelectorAll('form');
    console.log('Kayko: Detected', forms.length, 'form(s) on page');
    
    forms.forEach((form, index) => {
      // Skip if already tracked
      if (trackedForms.has(form)) {
        // Silently skip - form already tracked
        return;
      }
      
      // Skip if form has no fields
      const fields = form.querySelectorAll('input, textarea, select');
      const hasFields = fields.length > 0;

      if (!hasFields) {
        // Silently skip - form has no fields
        return;
      }
      
      // Skip if this form contains a tracked textarea (LLM chat area)
      let containsLLMTextarea = false;
      const formTextareas = form.querySelectorAll('textarea, [contenteditable]');
      formTextareas.forEach(textarea => {
        if (trackedTextareas.has(textarea)) {
          containsLLMTextarea = true;
        }
      });
      
      if (containsLLMTextarea) {
        // Silently skip - form contains LLM textarea
        return;
      }

      console.log('Kayko: Tracking form with', fields.length, 'fields');
      trackForm(form);
    });
  }

  // Initialize form detection
  async function initFormDetection() {
    const enabled = await isFormAutoSaveEnabled();
    if (!enabled) {
      console.log('Kayko: Form auto-save is disabled in settings');
      return;
    }
    
    console.log('Kayko: Initializing form detection...');
    
    // Initial detection
    detectForms();
    
    // Watch for dynamically added forms using MutationObserver with debouncing
    if (document.body) {
      let formDetectionTimer = null;

      const observer = new MutationObserver(() => {
        // Debounce form detection to avoid excessive checks
        if (formDetectionTimer) {
          clearTimeout(formDetectionTimer);
        }

        formDetectionTimer = setTimeout(() => {
          try {
            detectForms();
          } catch (error) {
            // Silently fail to avoid breaking the page
          }
        }, 500); // Wait 500ms after mutations stop before checking
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('Kayko: MutationObserver set up for form detection (debounced)');
    }
  }

  // Start form detection when DOM is ready
  // Note: init() for textarea detection is already called above
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormDetection);
  } else {
    initFormDetection();
  }
  
  // Expose manual trigger for debugging
  window.kaykoDetectForms = function() {
    console.log('Kayko: Manual form detection triggered');
    detectForms();
    console.log('Kayko: Currently tracking', trackedForms.size || 0, 'forms');
  };
  
  window.kaykoTestFormSave = async function() {
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) {
      console.log('Kayko: No forms found on page');
      return;
    }
    console.log('Kayko: Testing form save on first form');
    const form = forms[0];
    await saveFormData(form);
    await checkForSavedFormData(form);
  };
  
  window.kaykoDebug = function() {
    console.log('=== Kayko Debug Info ===');
    console.log('Hostname:', window.location.hostname);
    console.log('Is LLM Website:', isLLMWebsite());
    console.log('Tracked textareas:', trackedTextareas.size || 0);
    console.log('Tracked forms:', trackedForms.size || 0);
    console.log('Tracked icons:', trackedIcons.size || 0);
    
    const textareas = document.querySelectorAll('textarea, [contenteditable]');
    console.log('Found textareas/contenteditable:', textareas.length);
    textareas.forEach((t, i) => {
      const rect = t.getBoundingClientRect();
      console.log(`Textarea ${i}:`, {
        tag: t.tagName,
        id: t.id,
        className: t.className,
        contentEditable: t.isContentEditable,
        size: { width: rect.width, height: rect.height },
        tracked: trackedTextareas.has(t)
      });
    });
    
    const forms = document.querySelectorAll('form');
    console.log('Found forms:', forms.length);
    forms.forEach((f, i) => {
      console.log(`Form ${i}:`, {
        id: f.id,
        action: f.action,
        fields: f.querySelectorAll('input, textarea, select').length,
        tracked: trackedForms.has(f)
      });
    });
  };

  // Listen for messages from side panel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'restoreFormFromCard') {
      // Find and restore the form on this page
      (async () => {
        try {
          const formUrl = request.formUrl;
          const currentUrl = window.location.href;

          // Check if we're on the correct page
          if (!currentUrl.includes(new URL(formUrl).pathname)) {
            sendResponse({ success: false, error: 'Not on the form page' });
            return;
          }

          // Find the form that matches the saved data
          const forms = document.querySelectorAll('form');
          let restoredForm = null;

          for (const form of forms) {
            const storageKey = getFormStorageKey(form);
            const result = await chrome.storage.local.get('formData');
            const allFormData = result.formData || {};

            if (allFormData[storageKey] &&
                JSON.stringify(allFormData[storageKey]) === JSON.stringify(request.formData)) {
              // Found matching form, restore it
              const success = await restoreFormData(form);
              if (success) {
                restoredForm = form;
                break;
              }
            }
          }

          // If no exact match, try to restore to the first form
          if (!restoredForm && forms.length > 0) {
            const success = await restoreFormData(forms[0]);
            if (success) {
              restoredForm = forms[0];
            }
          }

          sendResponse({ success: !!restoredForm });
        } catch (error) {
          console.error('Error restoring form from card:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true; // Keep the message channel open for async response
    }
  });
})();

