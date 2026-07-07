import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './helpers.mjs';

test('keyFor composes pathname + hash', () => {
  const w = boot({ url: 'https://example.test/lab/demo/#b' });
  assert.equal(w.PINDROP.keyFor(), 'zp-fb:/lab/demo/#b');
});

test('LOCK: v1 pin formats byte-identically to v1 output', () => {
  const w = boot();
  const v1 = { xr: 0.42, y: 830, near: 'Alex Example', note: 'Make the headline bigger', w: 390, state: 'Viewport: Mobile' };
  assert.equal(w.PINDROP.fmtPin(v1, 0),
    '1. [42% across, 830px down, viewport 390px, near "Alex Example"] {Viewport: Mobile} Make the headline bigger');
});

test('allBuckets: matches base + variant hashes only, sorted, tolerant of bad JSON', () => {
  const P = 'zp-fb:';
  const w = boot({ seed: {
    [P + '/lab/demo/']: JSON.stringify([{ xr: .1, y: 1, w: 390, note: 'base' }]),
    [P + '/lab/demo/#b']: JSON.stringify([{ xr: .2, y: 2, w: 390, note: 'b' }]),
    [P + '/lab/demo/#a']: JSON.stringify([{ xr: .3, y: 3, w: 390, note: 'a' }]),
    [P + '/lab/other/#a']: JSON.stringify([{ xr: .4, y: 4, w: 390, note: 'other page' }]),
    [P + '/lab/demo/#c']: '{not json',
  } });
  assert.deepEqual(Array.from(w.PINDROP.allBuckets(), b => b.variant), ['#a', '#b', '(page)']);
});
