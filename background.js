// Kayko Background Service Worker

// Track side panel state per window
let sidePanelOpenWindows = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  //console.log('Kayko installed');
  
  // Set default settings
  const result = await chrome.storage.local.get('settings');
  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
        maxPrompts: 100,
        autoSaveEnabled: false,
        formAutoSaveEnabled: true
      }
    });
  } else {
    // Ensure formAutoSaveEnabled exists in existing settings
    if (result.settings.formAutoSaveEnabled === undefined) {
      result.settings.formAutoSaveEnabled = true;
      await chrome.storage.local.set({ settings: result.settings });
    }
  }
  
  // Initialize prompts array if needed
  const prompts = await chrome.storage.local.get('prompts');
  if (!prompts.prompts) {
    await chrome.storage.local.set({ prompts: [] });
  }
  
  // Initialize formData object if needed
  const formData = await chrome.storage.local.get('formData');
  if (!formData.formData) {
    await chrome.storage.local.set({ formData: {} });
  }
});

// Handle messages from content script and sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sidePanelOpenWindows.add(sender.tab.windowId);
  } else if (request.action === 'toggleSidePanel') {
    const windowId = sender.tab.windowId;
    if (sidePanelOpenWindows.has(windowId)) {
      // Panel is open, send close message to all sidepanels
      chrome.runtime.sendMessage({ action: 'closeSidePanel' }).catch(() => {});
      sidePanelOpenWindows.delete(windowId);
    } else {
      // Panel is closed, open it
      chrome.sidePanel.open({ windowId: windowId });
      sidePanelOpenWindows.add(windowId);
    }
  } else if (request.action === 'sidePanelOpened') {
    // Sidepanel reports it's open
    if (request.windowId) {
      sidePanelOpenWindows.add(request.windowId);
    }
  } else if (request.action === 'sidePanelClosed') {
    // Sidepanel reports it's closed
    if (request.windowId) {
      sidePanelOpenWindows.delete(request.windowId);
    }
  } else if (request.action === 'updateBadge') {
    updateBadgeCount();
  }
  return true;
});

// Update badge with today's prompt count (disabled - no badge numbers shown)
async function updateBadgeCount() {
  try {
    // Always clear badge text - no numbers shown
    chrome.action.setBadgeText({ text: '' });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update badge on startup
updateBadgeCount();

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.prompts) {
    updateBadgeCount();
  }
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Error opening side panel:', error);
    // Fallback: try to open in current window
    try {
      const window = await chrome.windows.get(tab.windowId);
      await chrome.sidePanel.open({ windowId: window.id });
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
  }
});

