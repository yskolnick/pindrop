# pindrop

pindrop is a drop-a-pin feedback overlay for static prototypes. Reviewers add numbered notes
directly on the page, the notes stay in that reviewer's browser storage, and an AI agent or human can
collect the feedback without a backend.

## Add It To A Page

The recommended path for any project is to copy `pindrop.js` into the project. It is one
dependency-free file, so vendoring keeps the reviewed page self-contained and avoids supply-chain
surprises.

Sites hosted under `yskolnick.github.io` may hotlink the canonical copy once this repo is published:

```html
<script src="https://yskolnick.github.io/pindrop/pindrop.js?v=2" defer></script>
```

Third-party hotlinks should pin an exact tag and use Subresource Integrity:

```html
<script src="https://cdn.jsdelivr.net/gh/yskolnick/pindrop@v2.1.0/pindrop.js"
        integrity="sha384-<hash>" crossorigin="anonymous" defer></script>
```

The release notes will publish the `sha384` hash. Do not use an unpinned CDN path.

## Use It

Open the page with `?pd=1`, choose **Add note**, click the page, and write the note. Pins persist in
that browser for the reviewed page and variant.

Choose **Finish review** to create both a readable summary and a structured `.pindrop.json` Review
Packet. Where the browser supports sharing files, the native share sheet receives both. Otherwise
Pindrop downloads the packet and opens the WhatsApp summary so the file can be attached manually.
Exporting never clears the review.

## Review Packets

A Review Packet is a backend-free handoff for an AI agent or human implementer. It includes:

- The complete page URL, including query parameters and hash.
- Page title and version.
- Browser identity and raw user-agent data.
- Operating-system/platform, language, touch capability, and device pixel ratio.
- Viewport, physical screen, orientation, and display preferences.
- Pins, verdicts, planted questions, answers, and reviewer identity.
- Every option in each declared page-state control.
- The exact visible state selections captured when each new pin was created.

The packet deliberately excludes cookies, unrelated localStorage, IP address, geolocation, form
values, console logs, and network logs.

## Use On Any Page

Bookmarklet: drag the `pindrop` bookmarklet from the demo page to your bookmarks bar. Click it on any
page to start pinning. Sites with a strict Content-Security-Policy can block bookmarklet script
injection.

Agent route: see [SPEC section 7](SPEC.md#7---injection-modes-and-mount-lifecycle). A Playwright
agent can use `PLAYWRIGHT_MCP_INIT_SCRIPT` or `browser_run_code_unsafe` with
`page.context().addInitScript({ path })`; the overlay stays dormant until `pindrop.mount()` is called.

## Page Contract

Pages can optionally provide:

- `<meta name="pd-version" content="N">` to mark page versions.
- A visible `.stamp` containing `vN` as a fallback version source.
- `data-pd-state="Label"` on state groups whose complete option list should be exported and whose
  active visible choice should be captured with each pin.
- Optional `data-pd-value="stable-id"` on each state option. Without it, Pindrop uses native
  `value`, element `id`, or normalized visible text.

## Agent Pickup

The pickup contract is open: any browser automation agent can collect and write back pins on a site
it reviews. Agents may read same-browser storage or consume an uploaded `.pindrop.json` packet. See
[SPEC.md](SPEC.md#6--agent-pickup-contract-public--any-agent-with-a-browser-can-implement-it) for
the storage keys, packet validation, and write-back lifecycle.

## Status And Rights

Early single-file tool, evolving into something larger.

Copyright (c) Yosef Skolnick. All rights reserved for now. Contact me about using it in your project.
