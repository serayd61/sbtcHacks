// generate-twitter-logo.mjs
// Twitter profil logosu (400x400 PNG) olusturucu
//
// Kullanim:
//   cd frontend && node scripts/generate-twitter-logo.mjs
//
// Cikti: frontend/public/twitter-logo-400.png

import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "public", "twitter-logo-400.png");

// ============================================
// 400x400 Twitter Profile Logo SVG
// Bitcoin "B" + Vault design, orange-gold theme
// Optimized for small display: thicker lines, larger text
// ============================================

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="50%" stop-color="#0f0f1e"/>
      <stop offset="100%" stop-color="#0a0a14"/>
    </linearGradient>

    <!-- Orange gradient -->
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>

    <!-- Gold gradient -->
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>

    <!-- Glow effect -->
    <radialGradient id="glow" cx="50%" cy="45%" r="40%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
    </radialGradient>

    <!-- Inner shadow -->
    <radialGradient id="innerShadow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="transparent"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.3"/>
    </radialGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="200" cy="200" r="198" fill="url(#bg)"/>
  <circle cx="200" cy="200" r="198" fill="url(#innerShadow)"/>
  <circle cx="200" cy="200" r="196" fill="none" stroke="url(#orange)" stroke-width="4"/>

  <!-- Ambient glow behind B -->
  <circle cx="200" cy="180" r="120" fill="url(#glow)"/>

  <!-- Vault outer ring -->
  <circle cx="200" cy="200" r="150" fill="none" stroke="#f97316" stroke-opacity="0.25" stroke-width="3"/>
  <circle cx="200" cy="200" r="130" fill="none" stroke="#f97316" stroke-opacity="0.12" stroke-width="2"/>

  <!-- Vault tick marks (cardinal) -->
  <line x1="200" y1="50" x2="200" y2="80" stroke="#f97316" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>
  <line x1="200" y1="320" x2="200" y2="350" stroke="#f97316" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>
  <line x1="50" y1="200" x2="80" y2="200" stroke="#f97316" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>
  <line x1="320" y1="200" x2="350" y2="200" stroke="#f97316" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round"/>

  <!-- Vault tick marks (diagonal) -->
  <line x1="93" y1="93" x2="114" y2="114" stroke="#f97316" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="307" y1="93" x2="286" y2="114" stroke="#f97316" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="93" y1="307" x2="114" y2="286" stroke="#f97316" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="307" y1="307" x2="286" y2="286" stroke="#f97316" stroke-opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Small dot markers on outer ring -->
  <circle cx="200" cy="50" r="3" fill="#f97316" opacity="0.6"/>
  <circle cx="200" cy="350" r="3" fill="#f97316" opacity="0.6"/>
  <circle cx="50" cy="200" r="3" fill="#f97316" opacity="0.6"/>
  <circle cx="350" cy="200" r="3" fill="#f97316" opacity="0.6"/>

  <!-- Bitcoin "B" symbol — larger and bolder for 400px -->
  <g transform="translate(200, 168)">
    <!-- Vertical bar -->
    <rect x="-32" y="-62" width="10" height="124" rx="5" fill="url(#orange)"/>

    <!-- Top serif -->
    <rect x="-37" y="-68" width="20" height="8" rx="4" fill="url(#orange)"/>
    <!-- Bottom serif -->
    <rect x="-37" y="56" width="20" height="8" rx="4" fill="url(#orange)"/>

    <!-- Top B curve -->
    <path d="M-22,-56 H14 C44,-56 44,-16 14,-16 H-22"
          fill="none" stroke="url(#orange)" stroke-width="10"
          stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Bottom B curve (slightly wider) -->
    <path d="M-22,-16 H20 C52,-16 52,28 20,28 H-22"
          fill="none" stroke="url(#orange)" stroke-width="10"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Upward yield arrow -->
  <g transform="translate(200, 100)">
    <polygon points="0,-28 18,-6 10,-6 10,12 -10,12 -10,-6 -18,-6"
             fill="url(#gold)" opacity="0.9"/>
  </g>

  <!-- "OPTIONS VAULT" text -->
  <text x="200" y="278" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="20" font-weight="800" letter-spacing="5"
        fill="#f97316">OPTIONS VAULT</text>

  <!-- "sBTC" subtitle -->
  <text x="200" y="305" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="15" font-weight="600" letter-spacing="4"
        fill="#fbbf24" opacity="0.85">sBTC</text>

  <!-- Subtle bottom accent line -->
  <line x1="140" y1="325" x2="260" y2="325"
        stroke="url(#orange)" stroke-width="1.5" stroke-opacity="0.3"
        stroke-linecap="round"/>
</svg>
`;

// ============================================
// Render SVG → PNG
// ============================================

console.log("Generating Twitter profile logo (400x400)...");

const resvg = new Resvg(svgContent.trim(), {
  fitTo: {
    mode: "width",
    value: 400,
  },
  font: {
    // System fonts for text rendering
    fontDirs: ["/System/Library/Fonts", "/usr/share/fonts"],
    defaultFontFamily: "Helvetica",
  },
  dpi: 144, // 2x for retina quality
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

writeFileSync(OUTPUT_PATH, pngBuffer);

const sizeKB = (pngBuffer.length / 1024).toFixed(1);
console.log(`Done! Saved to: ${OUTPUT_PATH}`);
console.log(`Size: ${pngData.width}x${pngData.height} (${sizeKB} KB)`);
