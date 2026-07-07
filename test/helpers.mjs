import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pindrop.js'), 'utf8');

export { src };

export function boot({ url = 'https://example.test/lab/demo/#a', html = '', seed = {}, armed = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`,
    { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  if (armed) window.sessionStorage.setItem('pd-on', '1');
  for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
  window.__PINDROP_TEST__ = 1;
  window.eval(src);
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return window;
}
