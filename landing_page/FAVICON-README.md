# Favicon Setup Guide

## Current Files

- ✅ `favicon.svg` - Modern SVG favicon (works in all modern browsers)
- ⚠️ PNG files need to be generated (see below)

## Browser Support

Modern browsers (Chrome, Firefox, Edge, Safari) support SVG favicons. However, for maximum compatibility, you should also generate PNG versions.

## Generating PNG Files

You need to create these PNG files from `favicon.svg`:

1. **favicon-16x16.png** - 16×16 pixels (standard favicon)
2. **favicon-32x32.png** - 32×32 pixels (standard favicon)
3. **apple-touch-icon.png** - 180×180 pixels (iOS home screen)
4. **favicon-192x192.png** - 192×192 pixels (Android/Chrome)
5. **favicon-512x512.png** - 512×512 pixels (Android/Chrome)

## How to Generate PNG Files

### Option 1: Online Tools (Easiest)
1. Go to [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload `favicon.svg`
3. Configure settings
4. Download the generated files
5. Place them in the `landing_page/` folder

### Option 2: ImageMagick (Command Line)
```bash
# Install ImageMagick first, then:
convert -background none favicon.svg -resize 16x16 favicon-16x16.png
convert -background none favicon.svg -resize 32x32 favicon-32x32.png
convert -background none favicon.svg -resize 180x180 apple-touch-icon.png
convert -background none favicon.svg -resize 192x192 favicon-192x192.png
convert -background none favicon.svg -resize 512x512 favicon-512x512.png
```

### Option 3: Inkscape (GUI)
1. Open `favicon.svg` in Inkscape
2. File → Export PNG Image
3. Set width/height for each size
4. Export each size

### Option 4: Use Existing Extension Icons
If you already have PNG icons in `../icons/`, you can copy them:
- `icon16.png` → `favicon-16x16.png`
- `icon32.png` → `favicon-32x32.png`
- `icon128.png` → `apple-touch-icon.png` (resize to 180×180 if needed)

## Testing

After adding PNG files, test the favicon:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Visit `https://kayko.live`
3. Check browser tab - should show cat face icon
4. Check bookmarks - icon should appear
5. Test on mobile devices

## Quick Setup (Using Existing Extension Icons)

Since you already have extension icons, you can quickly set up the favicon:

1. **Copy these files** from `../icons/` to `landing_page/`:
   - `icon16.png` → Copy to `landing_page/icon16.png`
   - `icon32.png` → Copy to `landing_page/icon32.png`
   - `icon128.png` → Copy to `landing_page/icon128.png`

2. The HTML is already configured to use these files!

## Current Status

✅ SVG favicon created (`favicon.svg`)
✅ HTML updated with favicon links
✅ Web manifest created
⏳ Need to copy icon PNG files to `landing_page/` folder

**Action Required:** Copy `icon16.png`, `icon32.png`, and `icon128.png` from the `icons/` folder to the `landing_page/` folder for the favicon to work when deployed.

