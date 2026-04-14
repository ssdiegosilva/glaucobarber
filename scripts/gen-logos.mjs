import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public");

/* ──────────────────────────────────────────────────────────
   SVG helpers
────────────────────────────────────────────────────────── */

// V with return arrow + wordmark "oltaki"
// dark variant: bg=#080810, V+arrow=gold, text=white
// light variant: bg=white, V+arrow=gold, text=#1a1a2e
function wordmarkSVG({ bg, textColor, width = 600, height = 180 }) {
  const gold = "#C9A84C";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 600 180">
  <rect width="600" height="180" fill="${bg}"/>

  <!-- V right arm (plain) -->
  <line x1="105" y1="148" x2="172" y2="28" stroke="${gold}" stroke-width="24" stroke-linecap="round"/>

  <!-- V left arm with return arrow integrated -->
  <!-- left arm body -->
  <line x1="105" y1="148" x2="55" y2="55" stroke="${gold}" stroke-width="24" stroke-linecap="round"/>

  <!-- curved arrow arc sitting on top-left of V -->
  <path d="M 55 55 C 48 30, 68 12, 92 16 C 116 20, 126 40, 116 58"
        fill="none" stroke="${gold}" stroke-width="20" stroke-linecap="round"/>
  <!-- arrowhead pointing down-left toward the V arm -->
  <polygon points="100,68 118,52 130,72" fill="${gold}"/>

  <!-- "oltaki" wordmark -->
  <text x="192" y="130"
        font-family="'Inter', 'Arial Rounded MT Bold', Arial, sans-serif"
        font-weight="800"
        font-size="110"
        letter-spacing="-2"
        fill="${textColor}">oltaki</text>
</svg>`;
}

// Square icon: just the V+arrow on colored bg
function iconSVG({ size, bg = "#080810" }) {
  const gold = "#C9A84C";
  const s = size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="${bg}"/>

  <!-- V right arm -->
  <line x1="256" y1="390" x2="420" y2="100" stroke="${gold}" stroke-width="52" stroke-linecap="round"/>

  <!-- V left arm -->
  <line x1="256" y1="390" x2="130" y2="148" stroke="${gold}" stroke-width="52" stroke-linecap="round"/>

  <!-- curved return arrow on top of left arm -->
  <path d="M 130 148 C 112 88, 150 48, 196 54 C 242 60, 262 104, 244 144"
        fill="none" stroke="${gold}" stroke-width="44" stroke-linecap="round"/>
  <!-- arrowhead -->
  <polygon points="218,162 248,128 278,168" fill="${gold}"/>
</svg>`;
}

/* ──────────────────────────────────────────────────────────
   Generate files
────────────────────────────────────────────────────────── */

async function svgToPng(svgStr, outPath, { width, height }) {
  const buf = Buffer.from(svgStr);
  await sharp(buf, { density: 300 })
    .resize(width, height)
    .png()
    .toFile(outPath);
  console.log("✓", outPath);
}

// logo-dark.png  (560×168 – retina-friendly, displayed at ~280×84)
await svgToPng(
  wordmarkSVG({ bg: "#080810", textColor: "#ffffff", width: 600, height: 180 }),
  path.join(OUT, "logo-dark.png"),
  { width: 560, height: 168 }
);

// logo-light.png
await svgToPng(
  wordmarkSVG({ bg: "#ffffff", textColor: "#1a1a2e", width: 600, height: 180 }),
  path.join(OUT, "logo-light.png"),
  { width: 560, height: 168 }
);

// icon-192.png
await svgToPng(
  iconSVG({ size: 512 }),
  path.join(OUT, "icon-192.png"),
  { width: 192, height: 192 }
);

// icon-512.png
await svgToPng(
  iconSVG({ size: 512 }),
  path.join(OUT, "icon-512.png"),
  { width: 512, height: 512 }
);

console.log("\nTodos os arquivos gerados em public/");
