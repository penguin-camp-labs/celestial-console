import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  collectCredits,
  renderCredits,
  renderTextNotices,
} from './credits.mjs';
const dir = 'dist/client';
const credits = await collectCredits();
await writeFile(join(dir, 'credits.html'), renderCredits(credits));
await writeFile(
  join(dir, 'third-party-notices.txt'),
  renderTextNotices(credits),
);
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
console.log(
  'Static pages, CSP, privacy headers and license notices generated.',
);
