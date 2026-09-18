import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const dir = 'dist/client';
await stat(join(dir, 'index.html'));
const scripts = new Set();
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.html'))) {
  let html = await readFile(join(dir, file), 'utf8');
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc\s*=/.test(m[1]) && m[2].trim())
    .map(
      (m) =>
        "'sha256-" + createHash('sha256').update(m[2]).digest('base64') + "'",
    );
  hashes.forEach((h) => scripts.add(h));
  const csp =
    "default-src 'self'; script-src 'self' " +
    [...new Set(hashes)].join(' ') +
    "; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'";
  html = html.replace(
    /<head>/i,
    '<head><meta http-equiv="Content-Security-Policy" content="' +
      csp +
      '"><meta name="referrer" content="no-referrer">',
  );
  await writeFile(join(dir, file), html);
}
const csp =
  "default-src 'self'; script-src 'self' " +
  [...scripts].join(' ') +
  "; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'";
await writeFile(
  join(dir, '_headers'),
  '/*\n  Content-Security-Policy: ' +
    csp +
    '\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(), usb=()\n  Strict-Transport-Security: max-age=31536000\n',
);
const packages = [
  'react',
  'react-dom',
  'react-server-dom-webpack',
  'three',
  'astronomy-engine',
  '@base-ui/react',
  'lucide-react',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  '@floating-ui/react',
  '@floating-ui/dom',
  '@floating-ui/core',
  '@floating-ui/utils',
  '@floating-ui/react-dom',
  'tabbable',
  'use-sync-external-store',
];
let notices = 'CELESTIAL — Third-party notices\n';
for (const pkg of packages) {
  const path = join('node_modules', pkg);
  let files;
  try {
    files = await readdir(path);
  } catch {
    continue;
  }
  const license = files.find((f) => /^licen[cs]e(\.|$)/i.test(f));
  if (license)
    notices +=
      '\n\n--- ' +
      pkg +
      ' ---\n' +
      (await readFile(join(path, license), 'utf8'));
}
notices +=
  '\n\n--- GeoNames city data ---\n' +
  (await readFile('public/data/NOTICE.txt', 'utf8'));
notices +=
  '\n\n--- NASA/JPL Horizons ---\nhttps://ssd.jpl.nasa.gov/horizons/\nApparent geocentric ICRF vectors (LT+S, UT), sampled every 8 days, adapted to Float32 and cubic Hermite interpolation. Retrieval metadata: /ephemeris/manifest.json.\n';
notices +=
  '\n\n--- Hipparcos bright stars ---\nESA 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200. Catalogue I/239/hip_main via CDS/VizieR (DOI: 10.26093/cds/vizier).\nhttps://cdsarc.cds.unistra.fr/viz-bin/cat/I/239\n22 entries with Vmag <= 1.5, excluding unresolved Alpha Centauri B (HIP 71681). ICRS coordinates at J1991.25 and proper motions, adapted for this display.\n';
notices +=
  '\n\n--- BIZ UDPGothic (Google Fonts) ---\n' +
  (await readFile('public/fonts/OFL.txt', 'utf8'));
for (const [name, file] of [
  ['Source Code Pro', 'SourceCodePro-OFL.txt'],
  ['Noto Sans Symbols (zodiac subset)', 'ZodiacSymbols-OFL.txt'],
])
  notices +=
    '\n\n--- ' +
    name +
    ' (Google Fonts) ---\n' +
    (await readFile('public/fonts/' + file, 'utf8'));
await writeFile(join(dir, 'third-party-notices.txt'), notices);
console.log(
  'Static index verified. CSP script hashes, privacy headers and license notices generated.',
);
