import test from 'node:test';
import assert from 'node:assert/strict';
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
