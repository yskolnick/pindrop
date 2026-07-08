import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { boot, src } from './helpers.mjs';

test('keyFor composes pathname + hash', () => {
  const w = boot({ url: 'https://example.test/lab/demo/#b' });
  assert.equal(w.PINDROP.keyFor(), 'pd:/lab/demo/#b');
});

test('LOCK: v1 pin formats byte-identically to v1 output', () => {
  const w = boot();
  const v1 = { xr: 0.42, y: 830, near: 'Alex Example', note: 'Make the headline bigger', w: 390, state: 'Viewport: Mobile' };
  assert.equal(w.PINDROP.fmtPin(v1, 0),
    '1. [42% across, 830px down, viewport 390px, near "Alex Example"] {Viewport: Mobile} Make the headline bigger');
});

test('allBuckets: matches base + variant hashes only, sorted, tolerant of bad JSON', () => {
  const P = 'pd:';
  const w = boot({ seed: {
    [P + '/lab/demo/']: JSON.stringify([{ xr: .1, y: 1, w: 390, note: 'base' }]),
    [P + '/lab/demo/#b']: JSON.stringify([{ xr: .2, y: 2, w: 390, note: 'b' }]),
    [P + '/lab/demo/#a']: JSON.stringify([{ xr: .3, y: 3, w: 390, note: 'a' }]),
    [P + '/lab/other/#a']: JSON.stringify([{ xr: .4, y: 4, w: 390, note: 'other page' }]),
    [P + '/lab/demo/#c']: '{not json',
  } });
  assert.deepEqual(Array.from(w.PINDROP.allBuckets(), b => b.variant), ['(page)', '#a', '#b']);
});

test('migrateLegacy: moves all zp-fb* keys to pd*, never clobbers, removes old', () => {
  const w = boot({ seed: {
    'zp-fb:/lab/demo/#a': JSON.stringify([{ xr: .1, y: 1, w: 390, note: 'old pin' }]),
    'zp-fb-v:/lab/demo/': JSON.stringify({ '#a': 'winner' }),
    'zp-fb-q:/lab/demo/#a': JSON.stringify([{ id: 'q1', q: 'x?' }]),
    'zp-fb-who': 'Yosef',
    'pd:/lab/demo/#b': JSON.stringify([{ xr: .2, y: 2, w: 390, note: 'already new' }]),
  } });
  assert.equal(w.localStorage.getItem('zp-fb:/lab/demo/#a'), null);
  assert.equal(JSON.parse(w.localStorage.getItem('pd:/lab/demo/#a'))[0].note, 'old pin');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('pd-v:/lab/demo/')), { '#a': 'winner' });
  assert.equal(w.localStorage.getItem('pd-who'), 'Yosef');
  assert.equal(JSON.parse(w.localStorage.getItem('pd:/lab/demo/#b'))[0].note, 'already new');
});

test('lifecycle: dormant when unarmed; mount() arms and builds once; double-eval no-op', () => {
  const w = boot({ armed: false });
  assert.equal(w.pindrop.mounted, false);
  assert.equal(w.document.querySelector('.pd-bar'), null);
  w.pindrop.mount();
  assert.equal(w.pindrop.mounted, true);
  assert.equal(w.document.querySelectorAll('.pd-bar').length, 1);
  w.eval(src);
  assert.equal(w.document.querySelectorAll('.pd-bar').length, 1);
});

test('lifecycle: auto-mounts when pins exist for the current key, even unarmed', () => {
  const w = boot({ armed: false, seed: { 'pd:/lab/demo/#a': JSON.stringify([{ xr: .1, y: 1, w: 390, note: 'n' }]) } });
  assert.equal(w.pindrop.mounted, true);
});

test('lifecycle: storage-blocked pages still expose API and mount from query', () => {
  const dom = new JSDOM('<!doctype html><html><body><main><h1>Demo</h1></main></body></html>',
    { url: 'https://example.test/lab/demo/?pd=1#a', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new window.DOMException('blocked', 'SecurityError'); },
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() { throw new window.DOMException('blocked', 'SecurityError'); },
  });
  window.__PINDROP_TEST__ = 1;

  assert.doesNotThrow(() => window.eval(src));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  assert.ok(window.pindrop);
  assert.equal(window.pindrop.mounted, true);
  assert.equal(window.document.querySelectorAll('.pd-bar').length, 1);
});

test('normPin: legacy pin gets v:1, ver:0, generated id; fields preserved', () => {
  const w = boot();
  const p = w.PINDROP.normPin({ xr: .1, y: 5, w: 390, note: 'n', extra: 'kept' });
  assert.equal(p.v, 1);
  assert.equal(p.ver, 0);
  assert.match(p.id, /^p[a-z0-9]+$/);
  assert.equal(p.extra, 'kept');
});

test('normPin: idempotent on v2 pins; drops non-objects', () => {
  const w = boot();
  const v2 = { v: 2, id: 'pfixed', xr: .1, y: 5, w: 390, note: 'n', ver: 4 };
  assert.deepEqual(w.PINDROP.normPin({ ...v2 }), v2);
  assert.equal(w.PINDROP.normPin(null), null);
  assert.equal(w.PINDROP.normPin('str'), null);
});

test('pageVer: meta wins, stamp fallback, else 0', () => {
  assert.equal(boot({ html: '<meta name="pd-version" content="7"><div class="stamp">Demo - v4 - 2026-07-07</div>' })
    .PINDROP.pageVer(), 7);
  assert.equal(boot({ html: '<div class="stamp">Lab - profile-redesign - v4 - 2026-07-07</div>' })
    .PINDROP.pageVer(), 4);
  assert.equal(boot().PINDROP.pageVer(), 0);
});

test('stateCatalog exports every option and keeps duplicate labels scoped', () => {
  const w = boot({ url: 'https://example.test/lab/demo/?fb=1#a', html: `
    <section id="s-a">
      <div data-pd-state="Example">
        <button data-pd-value="rivka" aria-pressed="true">Rivka - 24</button>
        <button data-pd-value="dovid" aria-pressed="false">Dovid - 27</button>
        <button data-pd-value="miriam" aria-pressed="false">Miriam - 34</button>
      </div>
    </section>
    <section id="s-b"><div data-pd-state="Example">
      <button data-pd-value="other" aria-pressed="true">Other</button>
    </div></section>` });
  const groups = Array.from(w.PINDROP.stateCatalog());
  assert.equal(groups.length, 2);
  assert.deepEqual(Array.from(groups[0].options, o => o.id), ['rivka', 'dovid', 'miriam']);
  assert.deepEqual(Array.from(groups[0].options, o => o.selectedAtExport), [true, false, false]);
  assert.equal(groups[0].scope, '#s-a');
  assert.equal(groups[1].scope, '#s-b');
  assert.notEqual(groups[0].selector, groups[1].selector);
});

test('stateCatalog uses associated labels and checked state for radio options', () => {
  const w = boot({ html: `
    <fieldset id="layout" data-pd-state="Layout">
      <input id="compact" type="radio" name="layout" value="compact" checked>
      <label for="compact">Compact</label>
      <input id="roomy" type="radio" name="layout" value="roomy">
      <label for="roomy">Roomy</label>
    </fieldset>` });
  const options = Array.from(w.PINDROP.stateCatalog()[0].options);
  assert.deepEqual(options.map(option => option.label), ['Compact', 'Roomy']);
  assert.deepEqual(options.map(option => option.id), ['compact', 'roomy']);
  assert.deepEqual(options.map(option => option.selectedAtExport), [true, false]);
});

test('capturePinContext records full URL, viewport, and only visible selected states', () => {
  const w = boot({ url: 'https://example.test/lab/demo/?fb=1#a', html: `
    <div id="shown" data-pd-state="Example">
      <button data-pd-value="rivka" aria-pressed="true">Rivka - 24</button>
      <button data-pd-value="dovid" aria-pressed="false">Dovid - 27</button>
    </div>
    <div id="hidden" data-pd-state="Photo">
      <button aria-pressed="true">With</button>
    </div>` });
  w.document.querySelector('#shown').getClientRects = () => [{ width: 10, height: 10 }];
  const context = w.PINDROP.capturePinContext();
  assert.equal(context.url, 'https://example.test/lab/demo/?fb=1#a');
  assert.equal(context.viewport.width, w.innerWidth);
  assert.equal(context.viewport.height, w.innerHeight);
  assert.deepEqual(Array.from(context.states, s => s.label), ['Example']);
  assert.equal(context.states[0].selected[0].id, 'rivka');
});

test('captureEnvironment reports viewport, screen, browser, display, system, and touch context', () => {
  const w = boot();
  Object.defineProperty(w, 'devicePixelRatio', { configurable: true, value: 2 });
  Object.defineProperty(w.navigator, 'maxTouchPoints', { configurable: true, value: 5 });
  const env = w.PINDROP.captureEnvironment();
  assert.equal(env.viewport.width, w.innerWidth);
  assert.equal(env.viewport.height, w.innerHeight);
  assert.equal(env.display.devicePixelRatio, 2);
  assert.equal(env.system.maxTouchPoints, 5);
  assert.equal(env.system.touch, true);
  assert.equal(env.browser.userAgent, w.navigator.userAgent);
  assert.ok('width' in env.screen);
  assert.ok('name' in env.browser);
  assert.ok('version' in env.browser);
});

test('buildReviewPacket preserves full URL and feedback without mutating storage', () => {
  const pinsJson = JSON.stringify([{ v: 2, id: 'p1', xr: .2, y: 100, w: 390, note: 'Move this', ver: 5 }]);
  const w = boot({
    url: 'https://example.test/lab/demo/?fb=1#a',
    html: '<title>Profile redesign</title><meta name="pd-version" content="5">',
    seed: {
      'pd:/lab/demo/#a': pinsJson,
      'pd-v:/lab/demo/': JSON.stringify({ '#a': 'winner' }),
      'pd-q:/lab/demo/#a': JSON.stringify([{ id: 'q1', q: 'Keep this?', answer: '' }]),
      'pd-who': 'Yosef',
    },
  });
  const packet = w.PINDROP.buildReviewPacket();
  assert.equal(packet.format, 'pindrop-review');
  assert.equal(packet.formatVersion, 1);
  assert.equal(packet.page.url, 'https://example.test/lab/demo/?fb=1#a');
  assert.equal(packet.page.title, 'Profile redesign');
  assert.equal(packet.page.version, 5);
  assert.equal(packet.page.query, '?fb=1');
  assert.equal(packet.page.hash, '#a');
  assert.match(packet.reviewId, /^r[a-z0-9]+$/);
  assert.equal(packet.reviewer, 'Yosef');
  assert.equal(packet.pins['#a'][0].note, 'Move this');
  assert.equal(packet.verdicts['#a'], 'winner');
  assert.equal(packet.questions['#a'][0].q, 'Keep this?');
  assert.match(packet.summary, /Move this/);
  assert.equal(w.localStorage.getItem('pd:/lab/demo/#a'), pinsJson);
});

test('cssPath: id short-circuit + nth-of-type only when needed; round-trips', () => {
  const w = boot({ html: '<div id="root"><ul><li>a</li><li>b</li><li>c</li></ul><p>solo</p></div>' });
  const li2 = w.document.querySelectorAll('li')[1];
  const sel = w.PINDROP.cssPath(li2);
  assert.equal(sel, '#root > ul > li:nth-of-type(2)');
  assert.equal(w.document.querySelector(sel), li2);
  assert.equal(w.PINDROP.cssPath(w.document.querySelector('p')), '#root > p');
});

test('pinXY: falls back to xr/y when selector missing or unresolvable', () => {
  const w = boot();
  assert.deepEqual({ ...w.PINDROP.pinXY({ xr: .5, y: 200 }) }, { x: null, y: 200, anchored: false });
  assert.deepEqual({ ...w.PINDROP.pinXY({ xr: .5, y: 200, anchor: { sel: '#nope', ox: .5, oy: .5 } }) },
    { x: null, y: 200, anchored: false });
});

test('who: first note form asks once and persists optional reviewer name', () => {
  const w = boot();
  w.document.elementFromPoint = () => w.document.body;
  w.document.querySelector('.pd-add').click();
  w.document.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 12, clientY: 20 }));
  assert.ok(w.document.querySelector('.pd-who'));
  w.document.querySelector('.pd-who').value = 'Yosef';
  w.document.querySelector('.pd-form textarea').value = 'Make this bigger';
  w.document.querySelector('.pd-form .p').click();
  assert.equal(w.localStorage.getItem('pd-who'), 'Yosef');
  assert.equal(JSON.parse(w.localStorage.getItem('pd:/lab/demo/#a'))[0].who, 'Yosef');
});

test('verdicts: set/unset round-trips; key removed when empty', () => {
  const w = boot();
  w.PINDROP.setVerdict('#a', 'winner');
  assert.deepEqual({ ...w.PINDROP.getVerdicts() }, { '#a': 'winner' });
  w.PINDROP.setVerdict('#a', null);
  assert.equal(w.localStorage.getItem('pd-v:/lab/demo/'), null);
});

test('resolved pins: render done state and dismiss from popover', () => {
  const pin = { v: 2, id: 'p1', xr: .2, y: 100, w: 390, note: 'Make it bigger', ver: 4, resolved: { ver: 5, note: 'Done' } };
  const w = boot({ seed: { 'pd:/lab/demo/#a': JSON.stringify([pin]) } });
  assert.ok(w.document.querySelector('.pd-pin.pd-done'));
  w.document.querySelector('.pd-pin').click();
  assert.match(w.document.querySelector('.pd-form').textContent, /Resolved in v5/);
  w.document.querySelector('.dismiss').click();
  assert.equal(JSON.parse(w.localStorage.getItem('pd:/lab/demo/#a')).length, 0);
});

test('questions: load current-variant key; saveAnswer persists in place', () => {
  const w = boot({ seed: { 'pd-q:/lab/demo/#a': JSON.stringify([{ id: 'q1', q: 'CTA above the fold?', answer: '', answeredT: 0 }]) } });
  assert.equal(w.PINDROP.loadQuestions().length, 1);
  w.PINDROP.saveAnswer('q1', 'Yes');
  const stored = JSON.parse(w.localStorage.getItem('pd-q:/lab/demo/#a'));
  assert.equal(stored[0].answer, 'Yes');
  assert.ok(stored[0].answeredT > 0);
});

test('allQuestions: groups by variant for the current pathname only', () => {
  const w = boot({ seed: {
    'pd-q:/lab/demo/#a': JSON.stringify([{ id: 'q1', q: 'A?' }]),
    'pd-q:/lab/demo/#b': JSON.stringify([{ id: 'q2', q: 'B?' }]),
    'pd-q:/lab/other/#a': JSON.stringify([{ id: 'q3', q: 'other?' }]),
  } });
  assert.deepEqual(Object.keys(w.PINDROP.allQuestions()).sort(), ['#a', '#b']);
});

test('reviewFilename is safe and reviewFile contains exact packet JSON', async () => {
  const w = boot();
  const packet = { reviewId: 'r123', exportedAt: '2026-07-08T12:00:00.000Z' };
  assert.equal(w.PINDROP.reviewFilename(packet), 'pindrop-example.test-2026-07-08-r123.json');
  const file = w.PINDROP.reviewFile(packet);
  assert.equal(file.type, 'application/json');
  assert.equal(file.name, 'pindrop-example.test-2026-07-08-r123.json');
  const text = await new Promise((resolve, reject) => {
    const reader = new w.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
  assert.equal(text, JSON.stringify(packet, null, 2));
});

test('shareReview uses native file sharing when supported', async () => {
  const w = boot();
  let shared;
  Object.defineProperty(w.navigator, 'canShare', { configurable: true, value: ({ files }) => files.length === 1 });
  Object.defineProperty(w.navigator, 'share', {
    configurable: true,
    value: async payload => { shared = payload; },
  });
  const packet = { reviewId: 'r1', exportedAt: '2026-07-08T12:00:00.000Z', summary: 'Review summary' };
  const result = await w.PINDROP.shareReview(packet);
  assert.equal(result.mode, 'native');
  assert.equal(shared.text, 'Review summary');
  assert.equal(shared.files.length, 1);
  assert.equal(shared.files[0].type, 'application/json');
});

test('shareReview treats native cancellation as cancellation without fallback', async () => {
  const w = boot();
  let downloads = 0;
  Object.defineProperty(w.URL, 'createObjectURL', {
    configurable: true,
    value: () => { downloads++; return 'blob:test'; },
  });
  Object.defineProperty(w.navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(w.navigator, 'share', {
    configurable: true,
    value: async () => { throw new w.DOMException('cancelled', 'AbortError'); },
  });
  const result = await w.PINDROP.shareReview(
    { reviewId: 'r1', exportedAt: '2026-07-08T12:00:00.000Z', summary: 'Review summary' });
  assert.equal(result.mode, 'cancelled');
  assert.equal(downloads, 0);
});

test('shareReview returns native errors for explicit fallback actions', async () => {
  const w = boot();
  Object.defineProperty(w.navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(w.navigator, 'share', {
    configurable: true,
    value: async () => { throw new Error('share unavailable'); },
  });
  const result = await w.PINDROP.shareReview(
    { reviewId: 'r1', exportedAt: '2026-07-08T12:00:00.000Z', summary: 'Review summary' });
  assert.equal(result.mode, 'error');
  assert.match(result.error.message, /share unavailable/);
});

test('shareReview falls back to download plus WhatsApp when file sharing is unsupported', async () => {
  const w = boot();
  let downloads = 0;
  let opened = '';
  Object.defineProperty(w.URL, 'createObjectURL', {
    configurable: true,
    value: () => { downloads++; return 'blob:test'; },
  });
  Object.defineProperty(w.URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  w.HTMLAnchorElement.prototype.click = () => {};
  Object.defineProperty(w.navigator, 'canShare', { configurable: true, value: () => false });
  w.open = url => { opened = url; return {}; };
  const result = await w.PINDROP.shareReview(
    { reviewId: 'r1', exportedAt: '2026-07-08T12:00:00.000Z', summary: 'Review summary' });
  assert.equal(result.mode, 'fallback');
  assert.equal(downloads, 1);
  assert.match(opened, /^https:\/\/wa\.me\/\?text=/);
});

test('finish sheet summarizes the review and exposes all handoff actions', () => {
  const pin = { v: 2, id: 'p1', xr: .2, y: 100, w: 390, note: 'Move this', ver: 5 };
  const w = boot({
    url: 'https://example.test/lab/demo/?fb=1#a',
    seed: {
      'pd:/lab/demo/#a': JSON.stringify([pin]),
      'pd-q:/lab/demo/#a': JSON.stringify([{ id: 'q1', q: 'Keep this?', answer: '' }]),
    },
  });
  w.document.querySelector('.pd-finish-btn').click();
  const sheet = w.document.querySelector('.pd-finish');
  assert.ok(sheet);
  assert.match(sheet.textContent, /1 note/);
  assert.match(sheet.textContent, /1 unanswered question/);
  assert.match(sheet.textContent, /Full page URL included/);
  assert.ok(sheet.querySelector('.pd-share-review'));
  assert.ok(sheet.querySelector('.pd-download-review'));
  assert.ok(sheet.querySelector('.pd-send-summary'));
  assert.ok(sheet.querySelector('.pd-close-finish'));
  assert.equal(JSON.parse(w.localStorage.getItem('pd:/lab/demo/#a')).length, 1);
});

test('finish sheet clears a wrapped toolbar using its measured height', () => {
  const w = boot();
  const bar = w.document.querySelector('.pd-bar');
  bar.getBoundingClientRect = () => ({ height: 116 });
  w.document.querySelector('.pd-finish-btn').click();
  assert.equal(w.document.querySelector('.pd-finish').style.bottom, '140px');
});
