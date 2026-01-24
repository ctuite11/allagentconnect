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
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const INPUT_HTML = path.join(__dirname, '../public/og/og-render.html');

// Dynamic date-based versioning
const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const OUTPUT_PNG = path.join(__dirname, `../public/og/aac-og-${stamp}.png`);
const OUTPUT_JPG = OUTPUT_PNG.replace('.png', '.jpg');

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

  console.log('✅ PNG generated successfully!');
  console.log(`   File: ${OUTPUT_PNG}`);
  
  // Show PNG file size
  const pngStats = fs.statSync(OUTPUT_PNG);
  console.log(`   Size: ${(pngStats.size / 1024).toFixed(1)} KB`);

  // Auto-convert to JPEG for Facebook/social compatibility
  console.log('\n🔄 Converting to JPEG...');
  execSync(`sips -s format jpeg "${OUTPUT_PNG}" --out "${OUTPUT_JPG}"`, { stdio: 'inherit' });
  
  const jpgStats = fs.statSync(OUTPUT_JPG);
  console.log(`✅ JPEG created: ${OUTPUT_JPG}`);
  console.log(`   Size: ${(jpgStats.size / 1024).toFixed(1)} KB`);
  
  console.log('\n📋 Next steps:');
  console.log(`   1. Verify: open ${OUTPUT_JPG}`);
  console.log(`   2. Update index.html og:image to: /og/aac-og-${stamp}.jpg`);
  console.log(`   3. Update netlify.toml header path`);
  console.log(`   4. Commit, push, and Publish in Lovable`);
}

generateOGImage().catch((err) => {
  console.error('❌ Failed to generate OG image:', err);
  process.exit(1);
});
