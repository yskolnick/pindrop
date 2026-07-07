import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pindrop.js'), 'utf8');

export function boot({ url = 'https://example.test/lab/demo/#a', html = '', seed = {} } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`,
    { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.sessionStorage.setItem('zp-fb-on', '1');
  for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
  window.__PINDROP_TEST__ = 1;
  window.eval(src);
  return window;
}
