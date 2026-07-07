import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './helpers.mjs';

const ctx = { path: '/lab/demo/', hash: '#a', date: '2026-07-08', pageVer: 5, who: 'Yosef' };
const pin1 = { v: 2, id: 'p1', xr: .42, y: 830, w: 390, near: 'Alex Example', note: 'Make the headline bigger', state: 'Viewport: Mobile', ver: 5 };
const pin2 = { v: 2, id: 'p2', xr: .10, y: 120, w: 390, note: 'Crop tighter', ver: 3, who: 'Sam' };

test('fmtPin: version token, STALE, who-differs suffix', () => {
  const w = boot();
  assert.equal(w.PINDROP.fmtPin(pin1, 0, ctx),
    '1. [42% across, 830px down, viewport 390px, near "Alex Example", v5] {Viewport: Mobile} Make the headline bigger');
  assert.equal(w.PINDROP.fmtPin(pin2, 1, ctx),
    '2. [10% across, 120px down, viewport 390px, v3 — STALE] Crop tighter (who: Sam)');
});

test('buildCopyAll: full snapshot incl. verdicts, questions, question-only variants', () => {
  const w = boot();
  const out = w.PINDROP.buildCopyAll(
    [{ variant: '#a', pins: [pin1, pin2] }],
    { '#a': 'winner', '#b': 'kill' },
    { '#a': [{ id: 'q1', q: 'CTA above the fold?', near: 'See the full profile', answer: 'Yes' },
             { id: 'q2', q: 'Too many variants?', answer: '' }],
      '#b': [{ id: 'q3', q: 'Keep this at all?', answer: '' }] },
    ctx);
  assert.equal(out,
`Design feedback (all variants) · /lab/demo/ · 2026-07-08 · page v5
Reviewer: Yosef
Verdicts: #a Winner · #b Kill

== #a ==
1. [42% across, 830px down, viewport 390px, near "Alex Example", v5] {Viewport: Mobile} Make the headline bigger
2. [10% across, 120px down, viewport 390px, v3 — STALE] Crop tighter (who: Sam)
Q1. [near "See the full profile"] CTA above the fold? → A: Yes
Q2. Too many variants? → (unanswered)

== #b ==
Q1. Keep this at all? → (unanswered)`);
});

test('buildCopy (single variant): v1-identical when no v2 context applies', () => {
  const w = boot();
  const v1 = { xr: .42, y: 830, near: 'Alex Example', note: 'Make the headline bigger', w: 390, state: 'Viewport: Mobile' };
  assert.equal(w.PINDROP.buildCopy([v1], [], { path: '/lab/demo/', hash: '#a', date: '2026-07-08', pageVer: 0, who: '' }),
    'Design feedback · /lab/demo/#a · 2026-07-08\n1. [42% across, 830px down, viewport 390px, near "Alex Example"] {Viewport: Mobile} Make the headline bigger');
});

test('waUrl: encodes; truncates whole lines over budget with marker', () => {
  const w = boot();
  assert.equal(w.PINDROP.waUrl('a b\nc'), 'https://wa.me/?text=' + encodeURIComponent('a b\nc'));
  const big = Array.from({ length: 400 }, (_, i) => `line ${i} with some padding text`).join('\n');
  const url = w.PINDROP.waUrl(big);
  assert.ok(url.length <= 6000);
  assert.ok(decodeURIComponent(url.slice('https://wa.me/?text='.length)).endsWith('…(truncated — use Copy all)'));
});
