/**
 * Social Media Screenshot Generator
 * 
 * Captures the Early Access landing page at optimal dimensions for:
 * - LinkedIn (1200×627)
 * - Instagram Feed (1080×1350)
 * - Instagram Stories (1080×1920)
 * 
 * Usage:
 *   npx playwright install chromium  # one-time setup
 *   node scripts/generate-social-screenshots.cjs
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = [
  { name: 'landing-linkedin', width: 1200, height: 627 },
  { name: 'landing-instagram', width: 1080, height: 1350 },
  { name: 'landing-stories', width: 1080, height: 1920 },
];

const OUTPUT_DIR = path.join(__dirname, '../public/social');
const TARGET_URL = 'https://allagentconnect.lovable.app/';

async function generateScreenshots() {
  console.log('📸 Generating social media screenshots...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}\n`);
  }

  const browser = await chromium.launch();

  for (const { name, width, height } of SCREENSHOTS) {
    console.log(`🖼️  Capturing ${name} (${width}×${height})...`);

    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2, // Retina quality
    });

    const page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Wait for fonts to load
    await page.waitForFunction(() => document.fonts.ready);

    // Wait for animations to settle
    await page.waitForTimeout(1000);

    const outputPath = path.join(OUTPUT_DIR, `${name}.png`);

    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false, // Viewport only
    });

    const stats = fs.statSync(outputPath);
    console.log(`   ✅ Saved: ${outputPath}`);
    console.log(`   📦 Size: ${(stats.size / 1024).toFixed(1)} KB\n`);

    await context.close();
  }

  await browser.close();

  console.log('🎉 All screenshots generated successfully!');
  console.log(`\nFiles saved to: ${OUTPUT_DIR}/`);
}

generateScreenshots().catch((err) => {
  console.error('❌ Failed to generate screenshots:', err);
  process.exit(1);
});
