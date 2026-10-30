// Headless screenshot helper for builders: node dev/shot.mjs <url> <out.png> [waitMs] [WxH]
// Prints console errors from the page. Uses the Playwright install from ~/context/playwright-parallel-browsers.
import { createRequire } from 'module';
const require = createRequire('/Users/nahrahellouis/context/playwright-parallel-browsers/package.json');
const { chromium } = require('playwright');
const [url, out = 'shot.png', waitMs = '4000', size = '1440x900', evalJs = ''] = process.argv.slice(2);
// Optional 5th arg: JS run in the page after load (e.g. drive window.__gaga), then waitMs before the screenshot.
const [width, height] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
if (evalJs) { await page.waitForFunction(() => window.__gaga, null, { timeout: 20000 }).catch(() => {}); try { console.log('eval:', JSON.stringify(await page.evaluate(evalJs))); } catch (e) { errs.push('[eval] ' + e.message); } }
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
const gl = await page.evaluate(() => { try { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2 ok'; } catch (e) { return 'no webgl2: ' + e.message; } });
console.log('renderer:', gl);
console.log(errs.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
