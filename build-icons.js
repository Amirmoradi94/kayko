// Icon builder script - converts SVG to PNG in multiple sizes
// Run: npm install sharp && node build-icons.js

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
try {
  const sharp = require('sharp');
  
  const sizes = [16, 32, 48, 128];
  const svgPath = path.join(__dirname, 'icons', 'icon.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error('Error: icons/icon.svg not found');
    process.exit(1);
  }
  
  //console.log('Building icon files...');
  
  Promise.all(
    sizes.map(size => {
      const outputPath = path.join(__dirname, 'icons', `icon${size}.png`);
      return sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath)
        .then(() => //console.log(`✓ Created icon${size}.png`));
    })
  )
  .then(() => {
    //console.log('\n✓ All icons built successfully!');
  })
  .catch(err => {
    //console.error('Error building icons:', err);
    process.exit(1);
  });
  
} catch (error) {
  //console.log('\n⚠️  Sharp package not found. You can either:');
  //console.log('  1. Install sharp: npm install');
  //console.log('  2. Manually create PNG icons from icons/icon.svg at sizes: 16x16, 32x32, 48x48, 128x128');
  //console.log('  3. Use online SVG to PNG converter tools\n');
  
  // Create placeholder PNG files with instructions
  const sizes = [16, 32, 48, 128];
  sizes.forEach(size => {
    const placeholderPath = path.join(__dirname, 'icons', `icon${size}.png.placeholder`);
    fs.writeFileSync(placeholderPath, 
      `Placeholder: Convert icons/icon.svg to ${size}x${size} PNG and save as icon${size}.png`
    );
  });
  
  //console.log('Created placeholder files in icons/ directory');
}

