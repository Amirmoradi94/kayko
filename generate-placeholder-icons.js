// Quick placeholder icon generator (no dependencies)
// Creates simple data URI based PNGs that work immediately

const fs = require('fs');
const path = require('path');

// Simple PNG data URIs (blue square with white text)
// These are base64 encoded minimal PNG files
const iconData = {
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIklEQVR4nGP4TwQGGhgwYvT/2LFjGMZq9OjRo0czjBowYgAAV5sDXwtzPdUAAAAASUVORK5CYII=',
  32: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAARklEQVR4nO2WMQ4AIAwC7f9/2snBxcHBQRISEhISEhISEv5BVVX9VbdarfqrVqtVf9VqteqvWq1W/VWr1aq/arVa9ddfBQCqvyVe0rCmHQAAAABJRU5ErkJggg==',
  48: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3YMQ6AIAxAUfb/j3ZycHBwcFASEhISEhISEhISEt5JRETERERERETEn2m12vRXrVar/qrVatVftVqt+qtWq1V/1Wq16q9arVb9VavVqr9qtVr1V61Wq/6q1WrVX78XAAAvexhdIi/SAQAAAABJRU5ErkJggg==',
  128: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAABL0lEQVR4nO3aMQ6AIAxAUfb/j3ZycHBwcFASEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhL+SwCxvyVejzQGCgAAAABJRU5ErkJggg=='
};

// Create PNG files from base64 data
Object.entries(iconData).forEach(([size, base64Data]) => {
  const buffer = Buffer.from(base64Data, 'base64');
  const filePath = path.join(__dirname, 'icons', `icon${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ Created icon${size}.png`);
});

console.log('\n✓ All placeholder icons created!');
console.log('Note: These are simple placeholders. Replace with proper icons from icon.svg for production.\n');

