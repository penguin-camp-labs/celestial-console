import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const html = await readFile('dist/client/index.html', 'utf8');
assert.match(html, /lang="ja"/);
assert.match(html, /CELESTIAL/);
assert.match(html, /Content-Security-Policy/);
const csp = html.match(
  /http-equiv="Content-Security-Policy" content="([^"]+)"/,
)[1];
assert.ok(!csp.match(/script-src[^;]*unsafe-/));
assert.match(csp, /form-action 'none'/);
assert.match(csp, /connect-src 'self'/);
for (const m of html.matchAll(
  /<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g,
)) {
  assert.ok(m[1].startsWith('/'));
  await stat('dist/client' + m[1]);
}
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
  if (!m[1].includes('src=') && m[2].trim())
    assert.ok(csp.includes(createHash('sha256').update(m[2]).digest('base64')));
const headers = await readFile('dist/client/_headers', 'utf8');
assert.match(headers, /frame-ancestors 'none'/);
assert.match(headers, /X-Content-Type-Options: nosniff/);
assert.match(headers, /geolocation=\(self\)/);
console.log('Static assets and CSP verified; no external startup assets.');
