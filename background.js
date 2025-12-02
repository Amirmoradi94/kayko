// Kayko Background Service Worker

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  //console.log('Kayko installed');
  
  // Set default settings
  const result = await chrome.storage.local.get('settings');
  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
        maxPrompts: 100,
        autoSaveEnabled: false
      }
    });
  }
  
  // Initialize prompts array if needed
  const prompts = await chrome.storage.local.get('prompts');
  if (!prompts.prompts) {
    await chrome.storage.local.set({ prompts: [] });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
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

