# pindrop - specification (v2.1)

pindrop is one dependency-free file. It never auto-deletes user data: deletion authority belongs to
the reviewer through dismiss/clear or to an agent during pickup/write-back. Every reader tolerates
every schema version. There is no server, no analytics, and no external network call.

## 1 - Pin Schema v2

```jsonc
{
  "v": 2,
  "id": "pmb3k9x2a",
  "t": 1751900000000,
  "xr": 0.42,
  "y": 830,
  "w": 390,
  "near": "Alex Example",
  "note": "Make this bigger",
  "state": "Viewport: Mobile",
  "ver": 4,
  "who": "Yosef",
  "anchor": {
    "sel": "#s-a > .card:nth-of-type(2) > h3",
    "ox": 0.31,
    "oy": 0.55
  },
  "resolved": { "ver": 5, "note": "Headline enlarged to 24px" }
}
```

Tolerant read (`normPin`): non-object values are dropped; missing `v` becomes `v:1`, `ver:0`, and a
generated `id`; unknown fields are preserved verbatim; nothing is eagerly rewritten to storage.
The pickup snippet can persist normalized arrays so ids are stable before any write-back.

Staleness: `stale = p.ver > 0 && pageVer() > 0 && p.ver < pageVer()`. `pageVer()` reads
`<meta name="pd-version" content="N">`, then parses `vN` from `.stamp` text, then returns `0`.

## 2 - Storage Key Map

| Key | Store | Value | Written by |
|---|---|---|---|
| `pd-on` | sessionStorage | `"1"` from `?pd=1`; `?fb=1` accepted as alias | `pindrop.js` |
| `pd:<pathname><hash>` | localStorage | JSON array of pins | `pindrop.js`; `resolved` by agent |
| `pd-who` | localStorage | plain string; `""` means asked-and-declined | `pindrop.js`, once |
| `pd-v:<pathname>` | localStorage | `{"#a":"winner","#b":"kill"}` | `pindrop.js` |
| `pd-q:<pathname><hash>` | localStorage | array of question objects | agent plants; `pindrop.js` fills answers |

Question object:

```json
{
  "id": "q1",
  "q": "Should the CTA sit above the fold?",
  "xr": 0.5,
  "y": 420,
  "sel": "#s-a .cta-row",
  "near": "See the full profile",
  "ver": 5,
  "answer": "",
  "answeredT": 0
}
```

Prefix discipline: `allBuckets()` matches only `base` (`pd:` plus pathname) or `base + "#..."`.
`pd-who`, `pd-v:`, and `pd-q:` cannot leak into pin buckets.

Legacy migration is one-time and idempotent on every load: `zp-fb:*` to `pd:*`,
`zp-fb-v:*` to `pd-v:*`, `zp-fb-q:*` to `pd-q:*`, and `zp-fb-who` to `pd-who`. The tool copies only
when the new key is absent, then removes the old key.

Activation: show when `?pd=1` or `?fb=1` was seen this session, pins exist for the current key, or
planted questions exist for the current key.

## 3 - UI Behavior

Toolbar: `[n notes] [Win][Kill][Meh] + Add note | Copy | Copy all | Send | Clear | x`.

Verdict chips act on the current variant only, are visible only when the hash matches
`/^#[a-z0-9]{1,8}$/i`, and toggle off on a second tap.

Send opens `https://wa.me/?text=<encoded Copy-all block>` and truncates whole lines to keep the URL
at or under 6000 characters, appending a truncation marker.

Pin popover replaces confirm-delete:

- Normal pin: meta line, note, Edit, Delete, Close.
- Resolved pin: note, resolved line, Dismiss, Close.
- Question pin: question, answer textarea, Save answer, Close.

One popover is open at a time; Escape and outside click close it.

Pin visuals keep numbers: normal solid `#A82D46`; stale grey hollow; resolved green `#2E7D4F`;
questions blue `#2C5FA8`, with answered questions outlined.

Reviewer name: the note form shows "Your name (optional)" while `pd-who` is unset. First save stores
the value, including an empty string, and non-empty names are stamped on new pins.

Positioning: `pinXY(p)` uses `anchor.sel` plus `ox`/`oy` when the selector resolves to a visible
element; otherwise it falls back to v1 `xr`/`y`.

Resolved lifecycle: pindrop never auto-deletes. Resolved pins persist until the reviewer dismisses
them or the next agent pickup removes them.

Page contract: pages may declare `pd-version`, a visible `.stamp` with `vN`, and `data-pd-state`
groups whose active child is captured into pins.

## 4 - Copy-Block Format v2

```text
Design feedback (all variants) · /demo/profile-redesign/ · 2026-07-08 · page v5
Reviewer: Yosef
Verdicts: #a Winner · #b Kill

== #a ==
1. [42% across, 830px down, viewport 390px, near "Alex Example", v5] {Viewport: Mobile} Make the headline bigger
2. [10% across, 120px down, viewport 390px, v3 — STALE] Crop tighter (who: Sam)
3. ✓ RESOLVED in v5 (Headline enlarged to 24px) — [42% across, 830px down, viewport 390px, near "Alex Example"] Make the headline bigger
Q1. [near "See the full profile"] Should the CTA sit above the fold? → A: Yes, definitely
Q2. Is three variants too many? → (unanswered)
```

Header `page vN` appears only when `pageVer() > 0`. `Reviewer:` appears only when `pd-who` is
non-empty. `Verdicts:` appears only when non-empty. Per-pin `vN` appears only when `p.ver > 0`.
Stale pins add `— STALE`. Resolved pins get the resolved prefix and skip the version token.
`(who: X)` appears only when `p.who` differs from the header reviewer. Questions follow pins per
section. Sections are the union of pin buckets and question variants. A v1 pin formats
byte-identically to the v1 output.

## 5 - Element-Anchor Algorithm

`cssPath(el)` walks up at most 6 segments. An id matching `/^[A-Za-z][\w-]*$/` emits `#id` and
stops. Otherwise it emits `tag` plus `:nth-of-type(n)` only when the parent has more than one child
of that tag. It never uses classes.

Capture guards: set the pin layer to `pointer-events:none` around `elementFromPoint`, reject
pindrop UI, reject zero-size rects, and verify `document.querySelector(sel) === el` before storing.

## 6 - Agent Pickup Contract

Collect in one browser `evaluate` on the reviewed origin:

- All `pd:*` pin buckets, normalized per section 1 and persisted back for stable ids.
- All `pd-v:*` verdict stores.
- All `pd-q:*` question stores.
- `pd-who`.

Then echo the data into the conversation, screenshot each pin location, apply the requested changes,
and redeploy.

Write-back is by pin `id`: set `resolved:{ver,note}` per addressed pin, remove pins already resolved
at pickup time, remove applied question keys, and clear a verdict entry only when its variant was
killed. Pasted Copy-all blocks are always accepted as a fallback.

## 7 - Injection Modes And Mount Lifecycle

The file is safe to load on any page, any number of times, by any of three routes. The overlay only
appears when armed.

Load guard: first line of the IIFE exits when `window.pindrop` already exists.

Public API:

```js
window.pindrop = {
  version: '2.1.0',
  mounted: false,
  mount: mount,
  buildReviewPacket: buildReviewPacket
};
```

`mount()` forces the overlay, sets session `pd-on`, and builds the UI once. All DOM construction is
deferred until the DOM is ready.

Auto-mount when session `pd-on` is set, pins exist for the current key, or planted questions exist.
Otherwise the script stays dormant.

Mode 1 - embed:

```html
<script src=".../pindrop.js?v=N" defer></script>
```

Mode 2 - agent-inject: use Playwright MCP init scripts, `PLAYWRIGHT_MCP_INIT_SCRIPT`, or
`browser_run_code_unsafe` with `page.context().addInitScript({ path })`, then arm with
`pindrop.mount()`. Pins land in the reviewed origin's localStorage.

Mode 3 - bookmarklet: inject the script tag and call `mount()`. This can be blocked on sites with a
strict Content-Security-Policy.

Known limitation: if CSP restricts `style-src`, injected style may be refused. Execution still works,
but UI may render unstyled. Extension and userscript builds are future options.

## 8 - Considered, Not Planned

- Server-backed sync: real infrastructure and a public write endpoint to babysit.
- Freehand drawing overlay: annotated screenshots already cover "circle this".
- Dwell or heatmap analytics: wrong tool for a design-review loop and conflicts with no analytics.
- Pin categories: extra tap per pin for marginal signal.
- Proxy mode: infrastructure-heavy and fragile for JS-heavy or authenticated pages.
- Browser extension or userscript: useful later for human reviewers on strict-CSP sites.

## 9 - Versioning

Pages declare `pd-version` or a `.stamp`. Script tags carry `?v=N`, bumped on release. The pin schema
is versioned by the `v` field; changes must stay additive so an older cached `pindrop.js` renders
newer pins harmlessly.

## 10 - Review Packet v1

**Finish review** builds one immutable snapshot and produces a readable summary plus a structured
`.pindrop.json` file. Exporting does not clear, resolve, or otherwise mutate feedback.

Required top-level fields:

```json
{
  "format": "pindrop-review",
  "formatVersion": 1,
  "reviewId": "r...",
  "exportedAt": "2026-07-08T19:30:00.000Z",
  "reviewer": "Yosef",
  "page": {},
  "environment": {},
  "stateCatalog": [],
  "pins": {},
  "verdicts": {},
  "questions": {},
  "summary": "Design feedback ..."
}
```

Readers must reject an unknown `format`, reject unsupported major `formatVersion` values, and ignore
unknown fields.

`page.url` is exact `location.href`, including query parameters and hash. `page` also contains
title, page version, pathname, query, and hash.

`environment` contains:

- viewport width/height and document scroll width/height
- physical screen and available-screen dimensions
- screen orientation and device pixel ratio
- color scheme and reduced-motion preference
- best-effort browser name/version plus raw user agent and User-Agent Client Hints when available
- platform, language(s), touch capability, and maximum touch points

Pindrop does not collect cookies, arbitrary localStorage, IP address, geolocation, form values,
console logs, or network logs.

Every `[data-pd-state="Label"]` group appears in `stateCatalog`, including hidden declared groups.
The catalog preserves separate scopes for duplicate labels and lists every discoverable option.
Option identity uses `data-pd-value`, then native `value`, element `id`, or normalized visible text.
Selection is detected through `aria-pressed`, `aria-selected`, `data-active`, `checked`, or
`selected`.

New pins retain the legacy `state` string and add:

```json
{
  "context": {
    "url": "https://example.com/prototype/?pd=1#a",
    "viewport": { "width": 390, "height": 844 },
    "states": [
      {
        "stateId": "state-1",
        "label": "Example",
        "selected": [{ "id": "rivka", "label": "Rivka - 24" }]
      }
    ]
  }
}
```

Only visible declared groups are included in a pin snapshot. The packet-level catalog still lists
all declared groups and options. Different pins may therefore preserve different selections from
one review.

When `navigator.share` and `navigator.canShare({files})` support file sharing, Pindrop shares the
summary and JSON file together. Otherwise it downloads the JSON file and opens the WhatsApp summary.
Cancelling the native share sheet does not trigger fallback. Other native-share failures leave
explicit Download packet and Send summary actions available.

Agents consuming a packet must validate `format` and `formatVersion`, echo all packet feedback into
the conversation before changing anything, use each pin's URL/viewport/anchor/state snapshot, and
use `stateCatalog` to understand every available page-state option. Same-browser localStorage pickup
remains preferred when available because it supports resolved-pin write-back.
