/**
 * Deterministic OG Image Generator
 * 
 * Renders public/og/og-render.html at exactly 1200×630 and exports to PNG.
 * This ensures typography is always perfect (no AI, no manual screenshots).
 * 
 * Usage:
 *   npx playwright install chromium  # one-time setup
 *   node scripts/generate-og-image.js
 * 
 * Or add to package.json scripts:
 *   "generate-og": "node scripts/generate-og-image.js"
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const INPUT_HTML = path.join(__dirname, '../public/og/og-render.html');
const OUTPUT_PNG = path.join(__dirname, '../public/og/aac-og-2026-01-22.png');

async function generateOGImage() {
  console.log('🖼️  Generating OG image...');
  console.log(`   Source: ${INPUT_HTML}`);
  console.log(`   Output: ${OUTPUT_PNG}`);
  console.log(`   Size: ${OG_WIDTH}×${OG_HEIGHT}`);

  // Verify input exists
  if (!fs.existsSync(INPUT_HTML)) {
    console.error('❌ Error: og-render.html not found at', INPUT_HTML);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 1, // 1:1 pixel ratio for crisp output
  });
  
  const page = await context.newPage();
  
  // Load the HTML file
  await page.goto(`file://${INPUT_HTML}`, { waitUntil: 'networkidle' });
  
  // Wait for fonts to load
  await page.waitForFunction(() => document.fonts.ready);
  
  // Small delay to ensure everything is rendered
  await page.waitForTimeout(500);
  
  // Screenshot the page
  await page.screenshot({
    path: OUTPUT_PNG,
    type: 'png',
    clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
  });

  await browser.close();

  console.log('✅ OG image generated successfully!');
  console.log(`   File: ${OUTPUT_PNG}`);
  
  // Show file size
  const stats = fs.statSync(OUTPUT_PNG);
  console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generateOGImage().catch((err) => {
  console.error('❌ Failed to generate OG image:', err);
  process.exit(1);
});
