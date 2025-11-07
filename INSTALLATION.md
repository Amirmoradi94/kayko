# Kayko Installation Guide

## Quick Start (3 Minutes)

### 1. Download or Clone

**Option A: Download ZIP**
- Click the green "Code" button on GitHub
- Select "Download ZIP"
- Extract the ZIP file to a location like `C:\Programs\kayko` or `~/kayko`

**Option B: Clone with Git**
```bash
git clone https://github.com/yourusername/kayko.git
cd kayko
```

### 2. Install in Chrome/Edge/Brave

1. Open your browser and navigate to the extensions page:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`

2. Enable **Developer Mode**:
   - Look for a toggle switch in the top-right corner
   - Turn it ON

3. Click **"Load unpacked"**:
   - Navigate to and select the `kayko` folder
   - The extension should now appear in your extensions list

4. **Verify Installation**:
   - You should see "Kayko" with a blue shield icon
   - The extension is now active! 🎉

### 3. Test It Out

1. Visit ChatGPT, Claude, or any LLM chat
2. Start typing in the chat input
3. Look for the small Kayko icon on the right side of the textarea
4. Click the icon to see your saved prompts!

## Detailed Installation

### Prerequisites

- **Browsers**: Chrome 88+, Edge 88+, Brave, Opera, or any Chromium-based browser
- **Operating Systems**: Windows 10/11, macOS 10.13+, Linux
- **Disk Space**: ~5-10 MB

### Browser-Specific Instructions

#### Google Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top-right
3. Click "Load unpacked" button
4. Select the `kayko` directory
5. Pin the extension to toolbar (click puzzle icon → pin)

#### Microsoft Edge

1. Open Edge and go to `edge://extensions/`
2. Enable "Developer mode" in the left sidebar
3. Click "Load unpacked" button
4. Select the `kayko` directory
5. Pin to toolbar from the extensions menu

#### Brave Browser

1. Open Brave and go to `brave://extensions/`
2. Enable "Developer mode" in the top-right
3. Click "Load unpacked"
4. Select the `kayko` directory
5. Grant necessary permissions if prompted

#### Firefox (WebExtensions)

*Note: Firefox version coming soon. Currently optimized for Chromium browsers.*

### Building Production Icons (Optional)

For the best experience with high-quality icons:

```bash
# Install dependencies
npm install

# Generate PNG icons from SVG
npm run build-icons
```

This creates proper PNG files at 16x16, 32x32, 48x48, and 128x128 pixels from the SVG source.

**Alternative**: Use an online SVG to PNG converter:
1. Open `icons/icon.svg` in a browser
2. Visit [CloudConvert](https://cloudconvert.com/svg-to-png) or similar
3. Convert to PNG at sizes: 16, 32, 48, 128
4. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in the `icons/` folder

## Troubleshooting

### Extension Not Loading

**Problem**: "Manifest file is missing or unreadable"

**Solution**: Ensure you selected the correct folder containing `manifest.json`

---

**Problem**: "Could not load icon"

**Solution**: Run `node generate-placeholder-icons.js` to create placeholder icons

---

### Icon Not Appearing on Textareas

**Problem**: Kayko icon doesn't show up on LLM websites

**Solutions**:
1. Refresh the page (Ctrl/Cmd + R)
2. Check if the extension is enabled at `chrome://extensions/`
3. Verify the site is in the supported list (ChatGPT, Claude, etc.)
4. Clear browser cache and reload
5. Check browser console for errors (F12 → Console)

---

### Prompts Not Saving

**Problem**: Typing but nothing appears in history

**Solutions**:
1. Check if auto-save is enabled in Settings
2. Ensure text is more than 3 characters
3. Wait 3 seconds after typing (debounce delay)
4. Verify browser storage is not full
5. Check if site is in excluded sites list

---

### Side Panel Won't Open

**Problem**: Clicking icon does nothing

**Solutions**:
1. Try clicking the extension icon in toolbar instead
2. Right-click extension icon → "View saved prompts"
3. Reload the extension at `chrome://extensions/`
4. Restart browser

---

### Storage Issues

**Problem**: "Storage quota exceeded"

**Solution**: 
1. Open side panel → Click "Clear All" (with caution)
2. Export prompts first (backup)
3. Reduce max prompts in Settings

---

### Performance Issues

**Problem**: Browser feels slow

**Solutions**:
1. Reduce max prompts in Settings (try 50 instead of 100)
2. Clear old prompts periodically
3. Export and clear history monthly
4. Exclude heavy websites from auto-save

## Permissions Explained

Kayko requests these permissions:

- ✅ **storage**: Save prompts to browser local storage
  - *Why needed*: Store your prompts locally
  - *Privacy*: Data never leaves your computer

- ✅ **activeTab**: Access the current tab's content
  - *Why needed*: Detect textareas and inject save icon
  - *Privacy*: Only active when you're on an LLM site

- ✅ **sidePanel**: Display the history side panel
  - *Why needed*: Show your saved prompts in a panel
  - *Privacy*: All data is local

Kayko does **NOT** request:
- ❌ Network access (works 100% offline)
- ❌ All websites permission (only LLM sites)
- ❌ Tab history or browsing data
- ❌ Personal information

## Verifying Installation

### Check Extension Status

1. Go to `chrome://extensions/`
2. Find "Kayko" in the list
3. Verify:
   - Toggle is ON (blue)
   - No error messages
   - Version shows "1.0.0"

### Check Storage

```javascript
// Open browser console (F12)
chrome.storage.local.get(null, (data) => console.log(data));
```

You should see:
- `prompts`: Array of saved prompts
- `settings`: Your configuration

### Check Content Script

1. Visit ChatGPT or Claude
2. Open DevTools (F12) → Console
3. Should NOT see Kayko errors
4. Type in chat textarea
5. Kayko icon should appear within 2 seconds

## Updating the Extension

### Auto-Update (Chrome Web Store)
*Coming soon when published to store*

### Manual Update

1. Download the latest version
2. Extract to the same location (overwrite files)
3. Go to `chrome://extensions/`
4. Click the refresh icon on Kayko
5. Your data is preserved (stored separately)

## Uninstallation

### Remove Extension Only

1. Go to `chrome://extensions/`
2. Find "Kayko"
3. Click "Remove"
4. Confirm removal

⚠️ **Warning**: This deletes all saved prompts!

### Backup Before Uninstalling

1. Open Kayko side panel
2. Click "Export" button
3. Save the JSON file
4. Now safely uninstall
5. To restore later: Reinstall → Import the JSON file

## Next Steps

After installation:

1. 📖 Read the [User Guide](README.md#how-to-use)
2. ⚙️ Configure [Settings](README.md#managing-settings)
3. 🌟 Star the [GitHub repo](https://github.com/yourusername/kayko)
4. 🐛 [Report issues](https://github.com/yourusername/kayko/issues)
5. 💡 [Request features](https://github.com/yourusername/kayko/issues)

## Getting Help

- 📖 Full Documentation: [README.md](README.md)
- 💬 Community: [GitHub Discussions](https://github.com/yourusername/kayko/discussions)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/yourusername/kayko/issues)
- 📧 Email: support@kayko.example.com *(update with real email)*

---

**Congratulations! 🎉 You're now protected from losing prompts!**

Happy prompting! 🚀

