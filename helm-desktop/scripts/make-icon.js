'use strict';

/**
 * Rasterize assets/icon.svg → the icons each platform needs:
 *   icon.png            512  — window + Windows tray
 *   icon.ico            multi-size — Windows build
 *   icon.icns           multi-size — macOS build (generated via png2icons, works on any OS)
 *   trayTemplate.png    16  — macOS menubar (monochrome black-on-transparent template)
 *   trayTemplate@2x.png 32  — retina menubar
 * Run with: pnpm run icon
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const png2icons = require('png2icons');

const ASSETS = path.join(__dirname, '..', 'assets');
const svg = path.join(ASSETS, 'icon.svg');

// Monochrome menubar template: just the "TW" glyph in black on a transparent
// canvas. macOS recolors template images automatically for light/dark menubars.
const TRAY_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
  '<text x="256" y="360" fill="#000000" font-family="Helvetica, Arial, sans-serif" ' +
  'font-size="300" font-weight="800" letter-spacing="-12" text-anchor="middle">TW</text>' +
  '</svg>', 'utf8'
);

async function main() {
  const svgBuf = fs.readFileSync(svg);

  // main PNG used by window + Windows tray
  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(ASSETS, 'icon.png'));

  // sizes for the .ico
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBufs = [];
  for (const s of sizes) {
    pngBufs.push(await sharp(svgBuf).resize(s, s).png().toBuffer());
  }
  const ico = await pngToIco(pngBufs);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);

  // .icns for macOS — png2icons builds all required sizes from one big PNG.
  const big = await sharp(svgBuf).resize(1024, 1024).png().toBuffer();
  const icns = png2icons.createICNS(big, png2icons.BICUBIC, 0);
  if (!icns) throw new Error('png2icons.createICNS returned null');
  fs.writeFileSync(path.join(ASSETS, 'icon.icns'), icns);

  // macOS menubar template (transparent, black glyph) + @2x.
  await sharp(TRAY_SVG).resize(16, 16).png().toFile(path.join(ASSETS, 'trayTemplate.png'));
  await sharp(TRAY_SVG).resize(32, 32).png().toFile(path.join(ASSETS, 'trayTemplate@2x.png'));

  console.log('icon.png + icon.ico + icon.icns + trayTemplate(.png/@2x) written to assets/');
}

main().catch((e) => { console.error(e); process.exit(1); });
