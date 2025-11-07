# Contributing to Kayko

First off, thank you for considering contributing to Kayko! 🎉

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates.

**When filing a bug report, include:**
- Browser name and version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Console errors (F12 → Console)

### Suggesting Features

Feature requests are welcome! Please:
- Check if it's already been suggested
- Provide a clear description of the feature
- Explain why it would be useful
- Consider privacy implications (Kayko is privacy-first)

### Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- Chrome/Edge/Brave browser
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/yourusername/kayko.git
cd kayko

# Install dependencies
npm install

# Generate icons
npm run build-icons

# Load extension in browser
# Go to chrome://extensions/ → Load unpacked → select kayko folder
```

### Project Structure

```
kayko/
├── manifest.json          # Extension manifest (Manifest V3)
├── content.js            # Content script - textarea detection
├── content.css           # Content script styles
├── background.js         # Service worker - storage management
├── sidepanel.html        # History panel markup
├── sidepanel.css         # History panel styles
├── sidepanel.js          # History panel logic
├── popup.html            # Extension popup markup
├── popup.css             # Extension popup styles
├── popup.js              # Extension popup logic
├── icons/                # Extension icons
├── build-icons.js        # Icon build script
└── package.json          # npm configuration
```

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Use meaningful variable names
- Comment complex logic
- Keep functions focused and small

### Testing Checklist

Before submitting a PR, verify:

- [ ] Extension loads without errors
- [ ] Icons appear on textareas
- [ ] Auto-save works (wait 3 seconds)
- [ ] Side panel opens and displays prompts
- [ ] Search and filters work
- [ ] Export/import functions correctly
- [ ] Settings save and apply
- [ ] No console errors
- [ ] Tested on ChatGPT, Claude, and Gemini
- [ ] Works in Chrome and Edge

### Testing Manually

1. **Load Extension**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked → select kayko folder

2. **Test Auto-Save**
   - Visit chat.openai.com
   - Type in textarea
   - Verify icon appears
   - Wait 3 seconds
   - Check icon turns green

3. **Test Side Panel**
   - Click Kayko icon
   - Verify prompt appears in list
   - Test search
   - Test filters
   - Test favorite/delete

4. **Test Settings**
   - Click settings icon
   - Change max prompts
   - Add excluded site
   - Verify changes persist

### Debugging Tips

**View Console Logs:**
```javascript
// In content.js (shown in page console)
console.log('Kayko: textarea detected');

// In background.js or popup.js (shown in extension console)
console.log('Kayko: storage updated');
```

**Inspect Storage:**
```javascript
// Open extension console (F12 on popup or side panel)
chrome.storage.local.get(null, (data) => console.log(data));
```

**Reload Extension:**
- After code changes, go to `chrome://extensions/`
- Click refresh icon on Kayko
- Reload the web page you're testing on

## Architecture

### Content Script (`content.js`)

- Runs on every LLM webpage
- Detects textareas using MutationObserver
- Injects Kayko icon next to textareas
- Handles input events with debouncing
- Saves prompts to storage via Chrome API

### Background Service Worker (`background.js`)

- Persistent service worker
- Manages storage operations
- Updates badge count
- Handles side panel opening
- No UI, runs in background

### Side Panel (`sidepanel.js`)

- Displays prompt history
- Implements search and filtering
- Handles export/import
- Manages settings
- Communicates with storage

### Popup (`popup.js`)

- Quick stats display
- Shortcuts to side panel
- Settings access

## Privacy Guidelines

Kayko is **privacy-first**. All contributions must:

- ✅ Keep all data local (no server communication)
- ✅ No analytics or tracking
- ✅ No external API calls
- ✅ No user identification
- ✅ Document any new permissions

## Performance Guidelines

Keep Kayko lightweight:

- Minimize CPU usage
- Use debouncing for frequent events
- Avoid memory leaks
- Clean up event listeners
- Test with 1000+ prompts

## Adding New Features

### Adding a New LLM Platform

1. Add domain to `host_permissions` in `manifest.json`
2. Add domain to `matches` in `content_scripts`
3. Update `detectPlatform()` in `content.js`
4. Add platform badge color in `sidepanel.css`
5. Test on that platform
6. Update README with new platform

### Adding New Storage Fields

1. Update prompt object structure in `content.js`
2. Update display logic in `sidepanel.js`
3. Update export format documentation
4. Consider backward compatibility
5. Update README

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add search functionality to side panel
fix: Prevent duplicate prompts from being saved
docs: Update installation instructions
style: Format code according to style guide
refactor: Simplify textarea detection logic
test: Add test for export functionality
chore: Update dependencies
```

## Release Process

1. Update version in `manifest.json`
2. Update version in `package.json`
3. Update CHANGELOG.md
4. Create git tag
5. Build release package
6. Test thoroughly
7. Create GitHub release
8. Submit to Chrome Web Store (maintainers only)

## Questions?

- 💬 [GitHub Discussions](https://github.com/yourusername/kayko/discussions)
- 📧 Email: dev@kayko.example.com *(update with real email)*
- 🐛 [Open an issue](https://github.com/yourusername/kayko/issues)

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to make Kayko better!

---

**Thank you for contributing to Kayko! 🚀**

