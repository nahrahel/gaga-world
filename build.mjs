// build.mjs: bundle src/ into dist/gaga-world.html (artifact body format) and dist/preview.html (full document).
// Usage: node build.mjs   (needs npx esbuild; three stays external and loads from the import map CDN)
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src'), dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

execFileSync('npx', ['--no-install', 'esbuild', join(src, 'main.js'), '--bundle', '--format=esm', '--minify', '--target=es2022',
  '--external:three', '--external:three/addons/*', '--outfile=' + join(dist, 'app.js'), '--log-level=warning'], { stdio: 'inherit' });

let js = readFileSync(join(dist, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
let html = readFileSync(join(src, 'index.html'), 'utf8');
const css = readFileSync(join(src, 'styles.css'), 'utf8');

const link = /<link rel="stylesheet" href="styles\.css"\s*\/?>/;
const tag = /<script type="module" src="main\.js"><\/script>/;
if (!link.test(html)) throw new Error('index.html must contain <link rel="stylesheet" href="styles.css">');
if (!tag.test(html)) throw new Error('index.html must contain <script type="module" src="main.js"></script>');
html = html.replace(link, () => '<style>\n' + css + '\n</style>').replace(tag, () => '<script type="module">\n' + js + '\n</script>');

writeFileSync(join(dist, 'preview.html'), html);
// GitHub Pages serves the full document from the repository root.
writeFileSync(join(root, 'index.html'), html);

// Artifact body format: the host wraps the file in its own doctype/html/head/body skeleton.
const body = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head[^>]*>/gi, '')
  .replace(/<\/?body[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();
writeFileSync(join(dist, 'gaga-world.html'), body + '\n');
console.log('built dist/gaga-world.html', Math.round(Buffer.byteLength(body) / 1024), 'KB');
