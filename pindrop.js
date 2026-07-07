/* Prototype feedback pins.
   Activate with ?fb=1 (stays on for the session). Click "Add note", click the page,
   type, save. "Copy" produces a text block to paste back to the designer. */
(function () {
  'use strict';
  // Key pins by path + hash, so tabbed prototypes (e.g. #a / #b) keep separate,
  // labeled feedback per variant instead of piling everything onto one bucket.
  function keyFor() { return 'zp-fb:' + location.pathname + location.hash; }
  var KEY = keyFor();
  var qs = new URLSearchParams(location.search);
  // ?fb=1 turns feedback on and makes it STICKY (localStorage) — it survives refreshes,
  // plain URLs without the query, and new tabs, until the ✕ dismisses it. Per-browser,
  // so reviewers keep the bar while other viewers of the same page never see it.
  if (qs.has('fb')) { sessionStorage.setItem('zp-fb-on', '1'); localStorage.setItem('zp-fb-sticky', '1'); }
  if (!sessionStorage.getItem('zp-fb-on') && !localStorage.getItem('zp-fb-sticky') && !localStorage.getItem(KEY)) return;

  var pins = [];
  function loadPins() { try { pins = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { pins = []; } }
  loadPins();
  // hashchange fires async, so re-resolve the key on every read/write — a pin added
  // right after switching variants must land in the variant that's showing now.
  function syncKey() { var k = keyFor(); if (k !== KEY) { KEY = k; loadPins(); } }
  var adding = false;

  var css = document.createElement('style');
  css.textContent =
    '.zpfb-bar{position:fixed;right:16px;bottom:16px;z-index:99990;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;' +
    'max-width:calc(100vw - 32px);background:#221F1B;color:#FCFAF7;border-radius:22px;padding:8px 10px 8px 16px;font:600 13px/1 ui-sans-serif,system-ui,sans-serif;' +
    'box-shadow:0 12px 40px -12px rgba(0,0,0,.5)}' +
    '.zpfb-bar button{font:700 12px/1 ui-sans-serif,system-ui,sans-serif;border:0;border-radius:999px;padding:8px 12px;cursor:pointer;' +
    'background:#3a352f;color:#FCFAF7}' +
    '.zpfb-bar button.zpfb-add{background:#A82D46;color:#fff}' +
    '.zpfb-bar button.zpfb-add[data-on="1"]{outline:2px solid #fff}' +
    '.zpfb-bar button:focus-visible{outline:2.5px solid #E5798C;outline-offset:2px}' +
    'body.zpfb-aim{cursor:crosshair}' +
    '.zpfb-pin{position:absolute;z-index:99980;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;' +
    'background:#A82D46;color:#fff;border:2px solid #fff;display:grid;place-items:center;' +
    'font:800 11px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 14px -4px rgba(0,0,0,.5);cursor:pointer}' +
    '.zpfb-form{position:absolute;z-index:99991;width:min(260px,80vw);background:#FCFAF7;color:#221F1B;border:1px solid #E7E0D6;' +
    'border-radius:12px;padding:10px;box-shadow:0 18px 50px -18px rgba(0,0,0,.45);font:400 13px/1.4 ui-sans-serif,system-ui,sans-serif}' +
    '.zpfb-form textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid #E7E0D6;border-radius:8px;padding:7px;' +
    'font:inherit;resize:vertical;background:#fff;color:#221F1B}' +
    '.zpfb-form .r{display:flex;gap:6px;justify-content:flex-end;margin-top:7px}' +
    '.zpfb-form button{font:700 12px/1 ui-sans-serif,system-ui,sans-serif;border:0;border-radius:8px;padding:7px 11px;cursor:pointer;background:#F1EBE2;color:#221F1B}' +
    '.zpfb-form button.p{background:#A82D46;color:#fff}';
  document.head.appendChild(css);

  var layer = document.createElement('div');
  layer.setAttribute('data-zpfb', '');
  document.body.appendChild(layer);

  var bar = document.createElement('div');
  bar.className = 'zpfb-bar';
  bar.innerHTML = '<span class="zpfb-n"></span>' +
    '<button type="button" class="zpfb-add">+ Add note</button>' +
    '<button type="button" class="zpfb-copy">Copy</button>' +
    '<button type="button" class="zpfb-copyall">Copy all</button>' +
    '<button type="button" class="zpfb-clear">Clear</button>' +
    '<button type="button" class="zpfb-x" aria-label="Hide feedback bar">✕</button>';
  document.body.appendChild(bar);
  var nEl = bar.querySelector('.zpfb-n'), addBtn = bar.querySelector('.zpfb-add');
  var copyAllBtn = bar.querySelector('.zpfb-copyall');

  function save() { localStorage.setItem(KEY, JSON.stringify(pins)); }

  function nearText(x, y) {
    var el = document.elementFromPoint(x - window.scrollX, y - window.scrollY);
    while (el && el !== document.body) {
      var t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (t && t.length >= 3) return t.slice(0, 48);
      el = el.parentElement;
    }
    return '';
  }

  // Snapshot the page's active UI state at pin time. Any element the page marks
  // with data-fb-state="Label" contributes "Label: <active option>", where the
  // active option is its aria-pressed / aria-selected / data-active child. Only
  // currently-visible groups count, so a hidden variant's controls are ignored.
  function captureState() {
    var parts = [];
    var groups = document.querySelectorAll('[data-fb-state]');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.getClientRects().length) continue;
      var active = g.querySelector('[aria-pressed="true"],[aria-selected="true"],[data-active="true"]');
      if (!active) continue;
      var val = (active.getAttribute('aria-label') || active.textContent || '').trim().replace(/\s+/g, ' ');
      if (val) parts.push(g.getAttribute('data-fb-state') + ': ' + val);
    }
    return parts.join(' · ');
  }

  function render() {
    layer.innerHTML = '';
    pins.forEach(function (p, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'zpfb-pin';
      d.textContent = i + 1;
      d.title = p.note + (p.state ? ' — [' + p.state + ']' : '') + ' (click to remove)';
      d.style.left = (p.xr * 100) + '%';
      d.style.top = p.y + 'px';
      d.addEventListener('click', function () {
        if (confirm('Remove note ' + (i + 1) + '? — ' + p.note)) { pins.splice(i, 1); save(); render(); }
      });
      layer.appendChild(d);
    });
    nEl.textContent = pins.length + (pins.length === 1 ? ' note' : ' notes');
    if (copyAllBtn) { var tot = allBuckets().reduce(function (n, b) { return n + b.pins.length; }, 0); copyAllBtn.style.display = tot > 0 ? '' : 'none'; }
  }

  function form(x, y) {
    var f = document.createElement('div');
    f.className = 'zpfb-form';
    f.style.left = Math.min(x, window.scrollX + window.innerWidth - 290) + 'px';
    f.style.top = (y + 10) + 'px';
    f.innerHTML = '<textarea placeholder="What should change here?"></textarea>' +
      '<div class="r"><button type="button" class="c">Cancel</button><button type="button" class="p">Save note</button></div>';
    document.body.appendChild(f);
    var ta = f.querySelector('textarea');
    ta.focus();
    f.querySelector('.c').addEventListener('click', function () { f.remove(); });
    f.querySelector('.p').addEventListener('click', function () {
      var note = ta.value.trim();
      if (note) {
        syncKey();
        pins.push({ xr: x / document.documentElement.scrollWidth, y: y, near: nearText(x, y), note: note, w: window.innerWidth, state: captureState() });
        save(); render();
      }
      f.remove();
    });
  }

  addBtn.addEventListener('click', function () {
    adding = !adding;
    addBtn.dataset.on = adding ? '1' : '';
    document.body.classList.toggle('zpfb-aim', adding);
  });

  document.addEventListener('click', function (e) {
    if (!adding) return;
    if (bar.contains(e.target) || e.target.closest('.zpfb-form,.zpfb-pin')) return;
    e.preventDefault(); e.stopPropagation();
    adding = false; addBtn.dataset.on = ''; document.body.classList.remove('zpfb-aim');
    form(e.pageX, e.pageY);
  }, true);

  function fmtPin(p, i) {
    return (i + 1) + '. [' + Math.round(p.xr * 100) + '% across, ' + p.y + 'px down, viewport ' + p.w + 'px' +
      (p.near ? ', near "' + p.near + '"' : '') + ']' + (p.state ? ' {' + p.state + '}' : '') + ' ' + p.note;
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function writeOut(out, okLabel) {
    (navigator.clipboard ? navigator.clipboard.writeText(out) : Promise.reject()).then(
      function () { nEl.textContent = okLabel; setTimeout(render, 1200); },
      function () { prompt('Copy your feedback:', out); }
    );
  }
  // every feedback bucket for this page (base + each variant hash), non-empty only
  function allBuckets() {
    var base = 'zp-fb:' + location.pathname, out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k === base || k.indexOf(base + '#') === 0) {
        var arr; try { arr = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { arr = []; }
        if (arr && arr.length) out.push({ variant: k.slice(base.length) || '(page)', pins: arr });
      }
    }
    out.sort(function (a, b) { return a.variant < b.variant ? -1 : (a.variant > b.variant ? 1 : 0); });
    return out;
  }

  bar.querySelector('.zpfb-copy').addEventListener('click', function () {
    syncKey();
    var out = 'Design feedback · ' + location.pathname + location.hash + ' · ' + today() + '\n' +
      pins.map(fmtPin).join('\n');
    writeOut(out, 'Copied!');
  });

  bar.querySelector('.zpfb-copyall').addEventListener('click', function () {
    var buckets = allBuckets();
    var total = buckets.reduce(function (n, b) { return n + b.pins.length; }, 0);
    if (!total) { nEl.textContent = 'No notes yet'; setTimeout(render, 1400); return; }
    var out = 'Design feedback (all variants) · ' + location.pathname + ' · ' + today() +
      buckets.map(function (b) { return '\n\n== ' + b.variant + ' ==\n' + b.pins.map(fmtPin).join('\n'); }).join('');
    writeOut(out, 'Copied all ' + total + '!');
  });

  bar.querySelector('.zpfb-clear').addEventListener('click', function () {
    if (pins.length && confirm('Clear all ' + pins.length + ' notes on this page?')) { pins = []; save(); render(); }
  });

  bar.querySelector('.zpfb-x').addEventListener('click', function () {
    sessionStorage.removeItem('zp-fb-on');
    localStorage.removeItem('zp-fb-sticky');
    bar.remove(); layer.remove(); document.body.classList.remove('zpfb-aim');
  });

  // switching variant tabs (#a / #b) re-keys to that variant's own notes
  window.addEventListener('hashchange', function () { KEY = keyFor(); loadPins(); render(); });

  render();
})();
