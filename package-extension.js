// Package extension for distribution
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, 'dist');
const zipName = 'kayko-extension.zip';

// Files to include in the package
const filesToInclude = [
  'manifest.json',
  'content.js',
  'content.css',
  'background.js',
  'sidepanel.html',
  'sidepanel.css',
  'sidepanel.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons/',
  'README.md',
  'LICENSE'
];

//console.log('Packaging Kayko extension...\n');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Check if all required files exist
const missingFiles = [];
filesToInclude.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('⚠️  Missing required files:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  console.error('\nPlease ensure all files are present before packaging.');
  process.exit(1);
}

// Create zip archive (cross-platform)
try {
  // Use PowerShell on Windows, zip on Unix
  const isWindows = process.platform === 'win32';
  const zipPath = path.join(distDir, zipName);
  
  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  if (isWindows) {
    const files = filesToInclude.map(f => `"${f}"`).join(', ');
    execSync(`powershell Compress-Archive -Path ${files} -DestinationPath "${zipPath}"`, {
      cwd: __dirname
    });
  } else {
    const files = filesToInclude.join(' ');
    execSync(`zip -r "${zipPath}" ${files}`, { cwd: __dirname });
  }
  
  //console.log('✓ Extension packaged successfully!');
  //console.log(`\nPackage location: ${zipPath}`);
  //console.log('\nTo install:');
  //console.log('1. Open Chrome/Edge and go to chrome://extensions/');
  //console.log('2. Enable "Developer mode"');
  //console.log('3. Click "Load unpacked" and select the kayko directory');
  //console.log('   OR upload the zip file to Chrome Web Store for distribution\n');
  
} catch (error) {
  console.error('Error creating package:', error.message);
  //console.log('\nManual packaging instructions:');
  //console.log('1. Create a zip file containing all extension files');
  //console.log('2. Upload to Chrome Web Store or distribute directly\n');
}

