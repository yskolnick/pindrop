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
<script src="https://yskolnick.github.io/pindrop/pindrop.js?v=1" defer></script>
```

Third-party hotlinks should pin an exact tag and use Subresource Integrity:

```html
<script src="https://cdn.jsdelivr.net/gh/yskolnick/pindrop@v2.0.0/pindrop.js"
        integrity="sha384-<hash>" crossorigin="anonymous" defer></script>
```

The release notes will publish the `sha384` hash. Do not use an unpinned CDN path.

## Use It

Open the page with `?pd=1`, choose **Add note**, click the page, write the note, then use **Copy**,
**Copy all**, or **Send**. Pins persist in that browser for the reviewed page and variant.

## Page Contract

Pages can optionally provide:

- `<meta name="pd-version" content="N">` to mark page versions.
- A visible `.stamp` containing `vN` as a fallback version source.
- `data-pd-state="Label"` on state groups whose active child should be captured with pins.

## Agent Pickup

The pickup contract is open: any browser automation agent can collect and write back pins on a site
it reviews. See [SPEC.md](SPEC.md#6--agent-pickup-contract-public--any-agent-with-a-browser-can-implement-it)
for the storage keys and write-back lifecycle.

## Status And Rights

Early single-file tool, evolving into something larger.

Copyright (c) Yosef Skolnick. All rights reserved for now. Contact me about using it in your project.
