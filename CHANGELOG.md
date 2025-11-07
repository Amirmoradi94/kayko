# Changelog

All notable changes to Kayko will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-07

### Initial Release 🎉

#### Added
- **Auto-save functionality**: Automatically saves prompts every 3 seconds while typing
- **Smart textarea detection**: Works on all major LLM platforms
- **Visual save indicator**: Icon shows save status (idle, saving, saved)
- **Side panel UI**: Beautiful history panel with search and filters
- **Search functionality**: Find prompts by keywords
- **Platform filter**: Filter by ChatGPT, Claude, Gemini, Grok, or Perplexity
- **Date filter**: Show prompts from today, this week, or this month
- **Favorites system**: Star important prompts for quick access
- **Export/Import**: Backup and restore prompts as JSON files
- **Settings management**: Configure max prompts and excluded sites
- **Storage management**: Automatic cleanup of old prompts
- **Badge counter**: Shows number of prompts saved today
- **Complete privacy**: All data stored locally, no server communication
- **Offline support**: Works completely offline
- **Browser popup**: Quick stats and shortcuts

#### Supported Platforms
- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Grok (x.ai)
- Perplexity (perplexity.ai)
- Universal support for any website with textareas

#### Technical
- Manifest V3 compliance
- Chrome/Edge/Brave compatibility
- Debounced saving for performance
- MutationObserver for dynamic content
- Local storage with Chrome Storage API
- Side Panel API integration
- Service Worker architecture

#### Documentation
- Comprehensive README
- Installation guide
- Contributing guidelines
- Privacy policy details
- Troubleshooting guide

---

## [Unreleased]

### Planned Features
- Firefox WebExtensions support
- Dark mode UI
- Prompt templates
- Tags and categories
- Cloud sync (optional, end-to-end encrypted)
- Keyboard shortcuts
- Export to other formats (TXT, Markdown)
- Prompt statistics and analytics
- Multi-language support
- Custom save triggers

### Under Consideration
- Mobile browser support
- Prompt versioning (track edits)
- Collaborative prompts (team features)
- AI-powered prompt suggestions
- Integration with note-taking apps

---

## Version History

| Version | Date       | Highlights |
|---------|------------|------------|
| 1.0.0   | 2025-11-07 | Initial release with core functionality |

---

## Migration Guide

### Upgrading to v1.0.0
*First release - no migration needed*

---

## Support

For issues, feature requests, or questions:
- 🐛 [Report bugs](https://github.com/yourusername/kayko/issues)
- 💡 [Request features](https://github.com/yourusername/kayko/issues)
- 💬 [Discussions](https://github.com/yourusername/kayko/discussions)

---

**Legend**
- `Added`: New features
- `Changed`: Changes in existing functionality
- `Deprecated`: Soon-to-be removed features
- `Removed`: Removed features
- `Fixed`: Bug fixes
- `Security`: Security improvements

