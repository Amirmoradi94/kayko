// Kayko Popup JavaScript

async function init() {
  await loadStats();
  setupEventListeners();
}

// Load and display stats
async function loadStats() {
  const result = await chrome.storage.local.get('prompts');
  const prompts = result.prompts || [];
  
  // Total prompts
  document.getElementById('totalPrompts').textContent = prompts.length;
  
  // Today's prompts
  const today = new Date().setHours(0, 0, 0, 0);
  const todayCount = prompts.filter(p => {
    const promptDate = new Date(p.timestamp).setHours(0, 0, 0, 0);
    return promptDate === today;
  }).length;
  
  document.getElementById('todayPrompts').textContent = todayCount;
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('openPanelBtn').addEventListener('click', async () => {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      window.close();
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
  });
  
  document.getElementById('quickSettingsBtn').addEventListener('click', async () => {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      // Send message to open settings in side panel
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'openSettings' });
      }, 100);
      window.close();
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
  });
}

// Initialize
init();

