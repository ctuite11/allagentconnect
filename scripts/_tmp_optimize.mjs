import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = '/tmp/homepage-imgs';
const OUT = '/tmp/homepage-imgs/out';
fs.mkdirSync(OUT, { recursive: true });

// Hero: full-bleed background. Generate 640, 1024, 1600, 2000 widths in AVIF + WebP.
const hero = 'group-1707484446.png';
const heroWidths = [640, 1024, 1600, 2000];
for (const w of heroWidths) {
  await sharp(path.join(SRC, hero)).resize({ width: w }).avif({ quality: 50, effort: 4 }).toFile(`${OUT}/hero-${w}.avif`);
  await sharp(path.join(SRC, hero)).resize({ width: w }).webp({ quality: 72 }).toFile(`${OUT}/hero-${w}.webp`);
}

// GCI globe background: 1200 and 1800 widths, decorative dark globe, aggressive
for (const w of [1200, 1800]) {
  await sharp(path.join(SRC, 'mask-group.png')).resize({ width: w }).webp({ quality: 65 }).toFile(`${OUT}/gci-globe-${w}.webp`);
  await sharp(path.join(SRC, 'mask-group.png')).resize({ width: w }).avif({ quality: 45, effort: 4 }).toFile(`${OUT}/gci-globe-${w}.avif`);
}

// Scale/Network property tiles: render at max ~800px width, WebP
const tiles = ['mask-group-1.png','mask-group-2.png','mask-group-3.png','mask-group-4.png','mask-group-5.png','mask-group-7.png','mask-group-8.png','mask-group-9.png','mask-group-10.png'];
for (const t of tiles) {
  const base = t.replace('.png','');
  await sharp(path.join(SRC, t)).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${OUT}/${base}.webp`);
  await sharp(path.join(SRC, t)).resize({ width: 800, withoutEnlargement: true }).avif({ quality: 50, effort: 4 }).toFile(`${OUT}/${base}.avif`);
  // small variant for mobile
  await sharp(path.join(SRC, t)).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 70 }).toFile(`${OUT}/${base}-480.webp`);
}

// Get metadata for hero (dimensions)
const meta = await sharp(path.join(SRC, hero)).metadata();
console.log('HERO_META', meta.width, meta.height);

const list = fs.readdirSync(OUT).map(f => {
  const s = fs.statSync(path.join(OUT, f));
  return `${(s.size/1024).toFixed(0).padStart(6)} KB  ${f}`;
}).sort();
console.log(list.join('\n'));
