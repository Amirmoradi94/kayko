# Custom Icons Guide for Kayko

## Current Setup

Kayko now uses different icons for different states:

1. **Idle State** (nothing typed): `icons/icon128.png`
2. **Saving State** (user typing, saving in progress): `icons/icon32.png`
3. **Saved State** (successfully saved): `icons/icon128.png` (with green CSS tint)

## How to Use Your Own Custom Icons

### Step 1: Prepare Your Icons

Create two PNG images:
- **idle-icon.png** - Icon shown when nothing is typed (e.g., 128x128px)
- **saving-icon.png** - Icon shown when saving (e.g., 32x32px)

### Step 2: Add Icons to Project

Place your icons in the `icons/` folder:
```
icons/
├── idle-icon.png      ← Your custom idle icon
├── saving-icon.png    ← Your custom saving icon
└── ... (other icons)
```

### Step 3: Update content.js

Edit `content.js` and find the `setIconState` function (around line 60-82):

```javascript
// Update icon state
function setIconState(icon, state) {
  icon.classList.remove('idle', 'saving', 'saved');
  icon.classList.add(state);
  
  const img = icon.querySelector('.kayko-icon-img');
  if (!img) return;
  
  // Change icon image based on state
  if (state === 'idle') {
    img.src = chrome.runtime.getURL('icons/idle-icon.png');  // ← Your custom idle icon
  } else if (state === 'saving') {
    img.src = chrome.runtime.getURL('icons/saving-icon.png'); // ← Your custom saving icon
  } else if (state === 'saved') {
    img.src = chrome.runtime.getURL('icons/idle-icon.png');   // ← Back to idle icon
  }
}
```

### Step 4: Update manifest.json

Add your custom icons to `web_accessible_resources`:

```json
"web_accessible_resources": [
  {
    "resources": [
      "icons/icon128.png",
      "icons/icon32.png",
      "icons/idle-icon.png",
      "icons/saving-icon.png"
    ],
    "matches": ["<all_urls>"]
  }
]
```

### Step 5: Reload Extension

1. Go to `chrome://extensions/`
2. Click refresh icon on Kayko
3. Test on any LLM site!

## Icon Recommendations

### Idle Icon
- Should be subtle and unobtrusive
- Gray or muted colors work well
- Size: 128x128px (will be scaled to 24x24px)

### Saving Icon
- Should indicate activity/progress
- Could be animated-looking or have motion lines
- Blue or active color
- Size: 32x32px (will be scaled to 24x24px)

## Example Icon Ideas

**Idle:**
- Shield icon (gray)
- Bookmark icon (gray)
- Save icon outline (gray)

**Saving:**
- Spinning disk icon
- Loading spinner
- Pulsing circle
- Animated checkmark

## Notes

- Icons are automatically scaled to 24x24px in the UI
- Use PNG format for best quality
- Keep file sizes small (<50KB each) for performance
- Icons will smoothly transition between states

