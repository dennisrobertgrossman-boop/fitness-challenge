// Turns the Expo web export (dist/) into one self-contained HTML file:
// the JS bundle is inlined and image assets become data: URIs.
// Usage: npx expo export --platform web && node scripts/build-preview.mjs <out.html> [--split]
// --split writes the bundle next to the page as app.js instead of inlining it.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const out = process.argv[2] ?? path.join(dist, 'preview.html');
const split = process.argv.includes('--split');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const src = /<script src="([^"]+)" defer><\/script>/.exec(html)?.[1];
if (!src) throw new Error('Bundle script tag not found in dist/index.html');

let js = fs.readFileSync(path.join(dist, src), 'utf8');
js = js.replace(/"(\/assets\/[^"]+\.(png|jpg|jpeg|gif|svg))"/g, (m, p, ext) => {
  const file = path.join(dist, p);
  if (!fs.existsSync(file)) return m;
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return `"data:${mime};base64,${fs.readFileSync(file).toString('base64')}"`;
});
// Keep the HTML parser from ending or re-entering the inline script early.
// \u escapes are valid in strings, template literals and regex literals alike.
js = js.replace(/<\/script/gi, '<\\/script').replace(/<script/gi, '<\\u0073cript').replace(/<!--/g, '<\\u0021--');

const page = `<title>Brothers Challenge</title>
<style>
  :root { --bg: #000000; --fg: #ffffff; color-scheme: dark; }
  html, body { height: 100%; }
  body { margin: 0; overflow: hidden; background: var(--bg); color: var(--fg); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>This preview needs JavaScript.</noscript>
<div id="root"></div>
${split ? '<script src="app.js" defer></script>' : `<script>${js}</script>`}
`;
fs.writeFileSync(out, page);
if (split) fs.writeFileSync(path.join(path.dirname(out), 'app.js'), js);
console.log(`Wrote ${out} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
