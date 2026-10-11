/*!
 * Lumen v1.0.0 - a small, elegant, dependency-free alert / modal / toast library.
 *
 * - Plain ES5 (no transpiler needed). Works in IE10/11, Edge 12+, Chrome 30+,
 *   Firefox 25+, Safari 7+, Android 4.4+ and every modern browser.
 * - CSS is injected automatically and vendor-prefixed at runtime.
 * - Returns a native Promise when available, otherwise a tiny `.then()` thenable.
 * - Safe by default: `title` / `text` are inserted as text. `html` and `footer`
 *   are inserted as HTML, so never pass untrusted strings to them.
 *
 * MIT License
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Lumen = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

  /* ------------------------------------------------------------------ *
   * Defaults
   * ------------------------------------------------------------------ */

  var INITIAL = {
    // content
    title: '',
    text: '',
    html: null,              // string | Element (trusted markup)
    footer: null,            // string | Element (trusted markup)
    icon: null,              // 'success' | 'error' | 'warning' | 'danger' | 'info' | 'question'
    iconHtml: null,          // custom icon markup (replaces the built-in icon)
    imageUrl: null,
    imageAlt: '',
    imageWidth: null,

    // input
    input: null,             // text|email|password|number|tel|url|search|textarea|select|checkbox|radio|range|date|time|color
    inputLabel: '',
    inputPlaceholder: '',
    inputValue: '',
    inputOptions: null,      // {value: label} | ['a','b'] | [['value','Label'], ...]
    inputAttributes: null,   // {maxlength: 20, autocomplete: 'off', ...}
    inputValidator: null,    // function (value) -> string | falsy | thenable

    // buttons
    showConfirmButton: true,
    showCancelButton: false,
    showDenyButton: false,
    showCloseButton: true,   // modals only; toasts show one only if you ask for it
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    denyButtonText: 'No',
    confirmButtonColor: null,
    cancelButtonColor: null,
    denyButtonColor: null,
    reverseButtons: false,
    focus: 'auto',           // 'auto' | 'confirm' | 'cancel' | 'deny' | 'input' | 'popup' | 'none'

    // behaviour
    allowOutsideClick: true, // boolean | function
    allowEscapeKey: true,    // boolean | function
    allowEnterKey: true,
    timer: null,             // ms
    timerProgressBar: false,
    preConfirm: null,        // function (value) -> any | false | thenable
    scrollLock: true,

    // look
    theme: 'light',          // 'light' | 'dark' | 'auto'
    position: 'center',      // center|top|bottom (modal); top|top-start|top-end|bottom|bottom-start|bottom-end (toast)
    width: null,             // number (px) | css string
    padding: null,
    radius: null,
    background: null,
    color: null,
    backdrop: true,          // true | false | css color string
    animation: true,
    zIndex: null,
    customClass: {},         // container, popup, icon, image, title, text, html, label, input,
                             // actions, confirmButton, denyButton, cancelButton, closeButton,
                             // footer, validation, timerBar

    // toast
    toast: false,
    closeOnClick: true,      // toasts only

    // hooks
    didOpen: null,           // function (popup)
    willClose: null,
    didClose: null,

    // internal
    loading: false
  };

  var DEFAULTS = extend({}, INITIAL);

  var TONES = {
    none:     { c: '#1c2333', b: '#1c2333' },
    success:  { c: '#17986a', b: '#117a55' },
    error:    { c: '#d64550', b: '#c0313c' },
    warning:  { c: '#e58a17', b: '#b45f06' },
    danger:   { c: '#d64550', b: '#c0313c' },
    info:     { c: '#2c7be5', b: '#1d63c4' },
    question: { c: '#7459d9', b: '#5b41c0' }
  };

  /* ------------------------------------------------------------------ *
   * Small utilities (ES5 only)
   * ------------------------------------------------------------------ */

  function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) { continue; }
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) { target[k] = src[k]; }
      }
    }
    return target;
  }

  // Shallow merge, but `customClass` is merged key by key.
  function merge() {
    var out = {}, cc = {};
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (!a) { continue; }
      extend(out, a);
      extend(cc, a.customClass);
    }
    out.customClass = cc;
    return out;
  }

  function isEl(v) { return !!v && typeof v === 'object' && v.nodeType === 1; }
  function isFn(v) { return typeof v === 'function'; }
  function isThenable(v) { return !!v && isFn(v.then); }
  function allow(v) { return isFn(v) ? !!v() : v !== false; }

  function hasClass(n, c) { return (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
  function addClass(n, c) {
    if (!c) { return; }
    var parts = String(c).split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && !hasClass(n, parts[i])) { n.className += (n.className ? ' ' : '') + parts[i]; }
    }
  }
  function removeClass(n, c) {
    n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls.replace(/\s+$/, ''); }
    if (parent) { parent.appendChild(n); }
    return n;
  }

  function on(n, ev, fn) { n.addEventListener(ev, fn, false); }

  function cssSet(n, prop, val) {
    n.style[prop] = val;
    n.style['Webkit' + prop.charAt(0).toUpperCase() + prop.slice(1)] = val;
  }

  function px(v) { return typeof v === 'number' ? v + 'px' : v; }

  function hook(fn, arg) {
    if (!isFn(fn)) { return; }
    try { fn(arg); } catch (e) { if (typeof console !== 'undefined' && console.error) { console.error(e); } }
  }

  function matches(q) {
    return !!(hasDOM && window.matchMedia && window.matchMedia(q).matches);
  }
  function prefersReduced() { return matches('(prefers-reduced-motion: reduce)'); }
  function resolveTheme(t) {
    if (t === 'auto') { return matches('(prefers-color-scheme: dark)') ? 'dark' : 'light'; }
    return t === 'dark' ? 'dark' : 'light';
  }

  function ready(fn) {
    if (document.body) { fn(); } else { document.addEventListener('DOMContentLoaded', fn, false); }
  }

  function cc(o, key) { return (o.customClass && o.customClass[key]) || ''; }

  // Promise when available, otherwise a minimal thenable.
  function defer() {
    var d = {};
    if (typeof Promise === 'function') {
      d.promise = new Promise(function (resolve) { d.resolve = resolve; });
      return d;
    }
    var cbs = [], done = false, val;
    d.promise = {
      then: function (cb) {
        if (isFn(cb)) {
          if (done) { setTimeout(function () { cb(val); }, 0); } else { cbs.push(cb); }
        }
        return d.promise;
      },
      'catch': function () { return d.promise; }
    };
    d.resolve = function (v) {
      if (done) { return; }
      done = true; val = v;
      for (var i = 0; i < cbs.length; i++) { cbs[i](v); }
    };
    return d;
  }

  function whenDone(v, ok, fail) {
    if (isThenable(v)) { v.then(ok, fail); } else { ok(v); }
  }

  function makeResult(r) {
    return extend({
      isConfirmed: false, isDenied: false, isDismissed: false,
      value: undefined, dismiss: undefined
    }, r);
  }

  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ------------------------------------------------------------------ *
   * Styles (written unprefixed, prefixed at runtime for 2015-era engines)
   * ------------------------------------------------------------------ */

  function buildCss() {
    var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
    var SHADOW = '0 0 0 1px rgba(20,28,45,.06),0 2px 4px rgba(20,28,45,.04),0 18px 48px -10px rgba(20,28,45,.30)';
    var c = [];

    c.push(
      '.lm-container,.lm-container *,.lm-toasts,.lm-toasts *{box-sizing:border-box}',

      /* overlay + table-cell centring (works without flexbox) */
      '.lm-container{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:rgba(14,18,28,.5);-webkit-tap-highlight-color:transparent}',
      '.lm-container.lm-blur{backdrop-filter:blur(3px)}',
      '.lm-container.lm-nobackdrop{background:transparent}',
      '.lm-cell{display:table;width:100%;height:100%;table-layout:fixed}',
      '.lm-cellin{display:table-cell;vertical-align:middle;text-align:center;padding:20px 14px}',
      '.lm-v-top .lm-cellin{vertical-align:top}',
      '.lm-v-bottom .lm-cellin{vertical-align:bottom}',
      '.lm-h-start .lm-cellin{text-align:left}',
      '.lm-h-end .lm-cellin{text-align:right}',

      /* surfaces */
      '.lm-popup,.lm-toast{font:400 16px/1.5 ' + FONT + ';color:#1c2333;background:#fff;border-radius:16px;box-shadow:' + SHADOW + ';-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-align:center}',
      '.lm-popup{position:relative;display:inline-block;vertical-align:middle;width:27em;max-width:100%;margin:0;padding:32px 28px 24px;outline:0;overflow:hidden}',
      '.lm-dark{background:#161b29;color:#e9edf5;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 22px 56px -10px rgba(0,0,0,.65)}',

      /* content */
      '.lm-icon{display:block;width:72px;height:72px;margin:0 auto 18px}',
      '.lm-icon svg{display:block;width:100%;height:100%}',
      '.lm-image{display:block;max-width:100%;height:auto;margin:0 auto 18px;border-radius:10px}',
      '.lm-title{margin:0 0 6px;padding:0;font-size:1.32em;font-weight:600;line-height:1.3;letter-spacing:-.01em;word-wrap:break-word;overflow-wrap:break-word}',
      '.lm-text,.lm-html{margin:0;font-size:.95em;line-height:1.55;opacity:.74;word-wrap:break-word;overflow-wrap:break-word}',
      '.lm-title+.lm-text,.lm-title+.lm-html{margin-top:0}',

      /* inputs */
      '.lm-field{margin:20px 0 0;text-align:left}',
      '.lm-label{display:block;margin:0 0 6px;font-size:.85em;font-weight:600}',
      '.lm-input{display:block;width:100%;margin:0;padding:11px 13px;font:inherit;font-size:.95em;color:inherit;background:#fff;border:1px solid #cdd3e0;border-radius:10px;transition:border-color .15s,box-shadow .15s}',
      '.lm-input::-webkit-input-placeholder{color:#8f97aa}',
      '.lm-input::-moz-placeholder{color:#8f97aa;opacity:1}',
      '.lm-input:-ms-input-placeholder{color:#8f97aa}',
      '.lm-input:focus{outline:0}',
      'textarea.lm-input{min-height:96px;resize:vertical}',
      '.lm-input[type=range]{padding:6px 0;border:0;background:transparent}',
      '.lm-input[type=color]{height:44px;padding:4px}',
      '.lm-check{display:block;margin:8px 0 0;font-size:.95em;cursor:pointer}',
      '.lm-check input{margin:0 8px 0 0;vertical-align:-1px}',
      '.lm-validation{display:none;margin:10px 0 0;padding:8px 12px;border-radius:8px;background:rgba(214,69,80,.1);color:#b3262f;font-size:.85em;text-align:left}',
      '.lm-dark .lm-input{background:#0f1320;border-color:#2c3449;color:#e9edf5}',
      '.lm-dark .lm-validation{background:rgba(255,107,117,.14);color:#ff9097}',

      /* buttons */
      '.lm-actions{margin:24px 0 0;font-size:0;line-height:0}',
      '.lm-btn{display:inline-block;min-width:96px;margin:4px 5px 0;padding:10px 20px;font:inherit;font-size:15px;font-weight:600;line-height:1.3;color:#fff;border:0;border-radius:10px;cursor:pointer;position:relative;transition:background-color .15s,box-shadow .15s,opacity .15s;-webkit-appearance:none}',
      '.lm-btn:active{transform:translateY(1px)}',
      '.lm-btn:focus{outline:2px solid #1c2333;outline-offset:2px}',
      '.lm-btn[disabled]{opacity:.55;cursor:default}',
      '.lm-cancel,.lm-deny{background:transparent;color:inherit;box-shadow:inset 0 0 0 1px rgba(28,35,51,.22)}',
      '.lm-cancel:hover{background:rgba(28,35,51,.06)}',
      '.lm-deny{color:#c0313c;box-shadow:inset 0 0 0 1px rgba(192,49,60,.38)}',
      '.lm-deny:hover{background:rgba(192,49,60,.08)}',
      '.lm-confirm:hover{opacity:.92}',
      '.lm-dark .lm-cancel,.lm-dark .lm-deny{box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}',
      '.lm-dark .lm-cancel:hover{background:rgba(255,255,255,.07)}',
      '.lm-dark .lm-deny{color:#ff8e96;box-shadow:inset 0 0 0 1px rgba(255,142,150,.4)}',
      '.lm-dark .lm-deny:hover{background:rgba(255,142,150,.1)}',
      '.lm-loading{color:transparent!important;pointer-events:none}',
      '.lm-loading:after{content:"";position:absolute;top:50%;left:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:lm-spin .7s linear infinite}',
      '.lm-close{position:absolute;top:10px;right:10px;width:32px;height:32px;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:22px;line-height:32px;text-align:center;opacity:.5;cursor:pointer;transition:opacity .15s,background-color .15s}',
      '.lm-close:hover{opacity:1;background:rgba(128,136,156,.16)}',
      '.lm-close:focus{outline:2px solid #1c2333;outline-offset:0;opacity:1}',
      '.lm-dark .lm-close:focus,.lm-dark .lm-btn:focus{outline-color:#e9edf5}',

      /* footer, timer, spinner */
      '.lm-footer{margin:22px -28px -24px;padding:14px 28px;font-size:.85em;background:rgba(28,35,51,.04);border-top:1px solid rgba(28,35,51,.08)}',
      '.lm-dark .lm-footer{background:rgba(255,255,255,.04);border-top-color:rgba(255,255,255,.08)}',
      '.lm-timer{position:absolute;left:0;bottom:0;width:100%;height:3px;opacity:.6;background:#1c2333}',
      '.lm-spinner{display:block;width:44px;height:44px;margin:0 auto 16px;border:3px solid rgba(28,35,51,.12);border-top-color:#1c2333;border-radius:50%;animation:lm-spin .7s linear infinite}',
      '.lm-dark .lm-spinner{border-color:rgba(255,255,255,.14);border-top-color:#e9edf5}',

      /* toasts */
      '.lm-toasts{position:fixed;z-index:10001;padding:12px;max-width:100%;pointer-events:none}',
      '.lm-toasts-top{top:0;left:0;right:0}',
      '.lm-toasts-bottom{bottom:0;left:0;right:0}',
      '.lm-toasts-top-start{top:0;left:0}',
      '.lm-toasts-top-end{top:0;right:0}',
      '.lm-toasts-bottom-start{bottom:0;left:0}',
      '.lm-toasts-bottom-end{bottom:0;right:0}',
      '.lm-toast{position:relative;display:block;width:22em;max-width:100%;margin:0 0 8px;padding:18px 38px 18px 56px;text-align:left;pointer-events:auto;overflow:hidden;border-radius:14px}',
      '.lm-toasts-top .lm-toast,.lm-toasts-bottom .lm-toast{margin-left:auto;margin-right:auto}',
      '.lm-toast .lm-icon{position:absolute;left:14px;top:50%;width:30px;height:30px;margin:-15px 0 0}',
      '.lm-toast .lm-title{margin:0;font-size:.95em;line-height:1.35}',
      '.lm-toast .lm-text,.lm-toast .lm-html{font-size:.85em}',
      '.lm-toast .lm-title+.lm-text,.lm-toast .lm-title+.lm-html{margin-top:2px}',
      '.lm-toast .lm-close{top:50%;right:6px;margin-top:-16px;width:28px;height:28px;font-size:20px;line-height:28px}',
      '.lm-toast-noicon{padding-left:18px}',
      '.lm-toast-click{cursor:pointer}',

      /* motion */
      '@keyframes lm-fade-in{from{opacity:0}to{opacity:1}}',
      '@keyframes lm-fade-out{from{opacity:1}to{opacity:0}}',
      '@keyframes lm-in{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}',
      '@keyframes lm-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(6px) scale(.97)}}',
      '@keyframes lm-toast-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}',
      '@keyframes lm-draw{from{stroke-dashoffset:183}to{stroke-dashoffset:0}}',
      '@keyframes lm-draw-g{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}',
      '@keyframes lm-spin{to{transform:rotate(360deg)}}',
      '.lm-container.lm-show{animation:lm-fade-in .18s ease-out}',
      '.lm-container.lm-hide{animation:lm-fade-out .16s ease-in both}',
      '.lm-popup.lm-show{animation:lm-in .28s cubic-bezier(.2,.9,.3,1.08)}',
      '.lm-popup.lm-hide{animation:lm-out .16s ease-in both}',
      '.lm-toast.lm-show{animation:lm-toast-in .24s ease-out}',
      '.lm-toast.lm-hide{animation:lm-fade-out .16s ease-in both}',
      '.lm-ring{stroke-dasharray:183;stroke-dashoffset:0;animation:lm-draw .55s cubic-bezier(.4,0,.2,1) both}',
      '.lm-glyph{stroke-dasharray:60;stroke-dashoffset:0;animation:lm-draw-g .4s .4s ease-out both}',
      '@media (prefers-reduced-motion:reduce){.lm-container,.lm-popup,.lm-toast,.lm-ring,.lm-glyph{animation:none!important;transition:none!important}}',

      /* small screens: stack the buttons */
      '@media (max-width:480px){',
      '.lm-popup{padding:26px 20px 20px}',
      '.lm-footer{margin:20px -20px -20px;padding:12px 20px}',
      '.lm-actions .lm-btn{display:block;width:100%;margin:8px 0 0}',
      '}'
    );

    // Per-tone accent colours (icon, primary button, focus ring, timer bar)
    for (var name in TONES) {
      if (!Object.prototype.hasOwnProperty.call(TONES, name)) { continue; }
      var t = TONES[name], s = '.lm-tone-' + name;
      c.push(
        s + ' .lm-icon{color:' + t.c + '}',
        s + ' .lm-confirm{background:' + t.b + ';color:#fff}',
        s + ' .lm-btn:focus{outline-color:' + t.c + '}',
        s + ' .lm-input:focus{border-color:' + t.c + ';box-shadow:0 0 0 3px ' + hexToRgba(t.c, 0.2) + '}',
        s + ' .lm-timer{background:' + t.c + '}'
      );
    }
    c.push(
      '.lm-dark.lm-tone-none .lm-confirm{background:#eef1f7;color:#111827}',
      '.lm-dark.lm-tone-none .lm-btn:focus,.lm-dark.lm-tone-none .lm-input:focus{outline-color:#e9edf5;border-color:#aab3c8}',
      '.lm-dark.lm-tone-none .lm-input:focus{box-shadow:0 0 0 3px rgba(233,237,245,.18)}',
      '.lm-dark.lm-tone-none .lm-timer{background:#e9edf5}'
    );

    return c.join('\n');
  }

  // Adds -webkit- twins for the handful of properties old engines need.
  function prefix(css) {
    css = css.replace(/([{;]\s*)(animation|transform|transition|backdrop-filter)\s*:\s*([^;}]+)/g,
      function (m, lead, prop, val) {
        var wv = val.replace(/\btransform\b/g, '-webkit-transform');
        return lead + '-webkit-' + prop + ':' + wv + ';' + prop + ':' + val;
      });
    css = css.replace(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g,
      function (m, name, body) {
        return m + '@-webkit-keyframes ' + name + '{' + body + '}';
      });
    return css;
  }

  var styleEl = null;
  function injectStyles() {
    if (styleEl || !hasDOM) { return; }
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-lumen', '');
    var css = prefix(buildCss());
    if (styleEl.styleSheet) { styleEl.styleSheet.cssText = css; }
    else { styleEl.appendChild(document.createTextNode(css)); }
    var head = document.head || document.getElementsByTagName('head')[0];
    head.insertBefore(styleEl, head.firstChild); // first, so your own CSS can override it
  }

  /* ------------------------------------------------------------------ *
   * Icons (inline SVG, self-drawing; the final state is the static fallback)
   * ------------------------------------------------------------------ */

  var RING = '<circle cx="32" cy="32" r="29" fill="currentColor" fill-opacity=".09"/>' +
    '<circle class="lm-ring" cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-90 32 32)"/>';
  function glyph(d) {
    return '<path class="lm-glyph" d="' + d + '" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function svg(inner) {
    return '<svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false" aria-hidden="true">' + RING + inner + '</svg>';
  }
  var ICONS = {
    success:  svg(glyph('M20 33.5l8.5 8.5L45 23')),
    error:    svg(glyph('M23 23L41 41') + glyph('M41 23L23 41')),
    warning:  svg(glyph('M32 18.5v17') + glyph('M32 44.5v.1')),
    danger:   svg(glyph('M32 18.5v17') + glyph('M32 44.5v.1')),
    info:     svg(glyph('M32 20v.1') + glyph('M32 29v17')),
    question: svg(glyph('M25 26c0-5 3.5-8.5 7.5-8.5s7.5 3 7.5 7.5c0 7-8 7-8 14') + glyph('M32 46.5v.1'))
  };

  /* ------------------------------------------------------------------ *
   * Scroll lock
   * ------------------------------------------------------------------ */

  var lockState = null;
  function lockScroll() {
    if (lockState) { return; }
    var b = document.body, de = document.documentElement;
    var sw = (window.innerWidth || 0) - de.clientWidth;
    lockState = { ov: b.style.overflow, pr: b.style.paddingRight };
    if (sw > 0) {
      var cur = 0;
      if (window.getComputedStyle) { cur = parseInt(window.getComputedStyle(b).paddingRight, 10) || 0; }
      b.style.paddingRight = (cur + sw) + 'px';
    }
    b.style.overflow = 'hidden';
  }
  function unlockScroll() {
    if (!lockState) { return; }
    document.body.style.overflow = lockState.ov;
    document.body.style.paddingRight = lockState.pr;
    lockState = null;
  }

  /* ------------------------------------------------------------------ *
   * Modal
   * ------------------------------------------------------------------ */

  var current = null;
  var uid = 0;

  function normalizeOptions(list) {
    var out = [], i, k;
    if (!list) { return out; }
    if (Object.prototype.toString.call(list) === '[object Array]') {
      for (i = 0; i < list.length; i++) {
        if (Object.prototype.toString.call(list[i]) === '[object Array]') { out.push({ v: list[i][0], l: list[i][1] }); }
        else { out.push({ v: list[i], l: list[i] }); }
      }
    } else {
      for (k in list) { if (Object.prototype.hasOwnProperty.call(list, k)) { out.push({ v: k, l: list[k] }); } }
    }
    return out;
  }

  function focusables(popup) {
    var nodes = popup.querySelectorAll('button,input,select,textarea,a[href],[tabindex]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.disabled || n.getAttribute('tabindex') === '-1' || n.type === 'hidden') { continue; }
      if (n.offsetWidth || n.offsetHeight) { out.push(n); }
    }
    return out;
  }

  function buildInput(o, parent, id) {
    var type = o.input, field = el('div', 'lm-field', parent), inp, i, opts, row;
    var api = { field: field };

    if (o.inputLabel && type !== 'checkbox') {
      var lab = el('label', 'lm-label ' + cc(o, 'label'), field);
      lab.setAttribute('for', id + '-in');
      lab.appendChild(document.createTextNode(o.inputLabel));
    }

    if (type === 'select') {
      inp = el('select', 'lm-input ' + cc(o, 'input'), field);
      if (o.inputPlaceholder) {
        var ph = el('option', '', inp); ph.value = ''; ph.disabled = true;
        ph.appendChild(document.createTextNode(o.inputPlaceholder));
      }
      opts = normalizeOptions(o.inputOptions);
      for (i = 0; i < opts.length; i++) {
        var op = el('option', '', inp); op.value = opts[i].v;
        op.appendChild(document.createTextNode(opts[i].l));
      }
      if (o.inputPlaceholder && !o.inputValue) { inp.value = ''; }
      else if (o.inputValue !== '' && o.inputValue != null) { inp.value = o.inputValue; }
      api.get = function () { return inp.value; };
    } else if (type === 'textarea') {
      inp = el('textarea', 'lm-input ' + cc(o, 'input'), field);
      inp.value = o.inputValue || '';
      if (o.inputPlaceholder) { inp.setAttribute('placeholder', o.inputPlaceholder); }
      api.get = function () { return inp.value; };
    } else if (type === 'checkbox') {
      var l = el('label', 'lm-check ' + cc(o, 'label'), field);
      inp = el('input', '', l);
      inp.type = 'checkbox';
      inp.checked = !!o.inputValue && o.inputValue !== '0';
      l.appendChild(document.createTextNode(o.inputLabel || ''));
      api.get = function () { return inp.checked; };
    } else if (type === 'radio') {
      opts = normalizeOptions(o.inputOptions);
      var radios = [];
      for (i = 0; i < opts.length; i++) {
        row = el('label', 'lm-check ' + cc(o, 'label'), field);
        var r = el('input', '', row);
        r.type = 'radio'; r.name = id + '-radio'; r.value = opts[i].v;
        if (String(opts[i].v) === String(o.inputValue)) { r.checked = true; }
        row.appendChild(document.createTextNode(opts[i].l));
        radios.push(r);
      }
      inp = radios[0] || null;
      api.get = function () {
        for (var j = 0; j < radios.length; j++) { if (radios[j].checked) { return radios[j].value; } }
        return null;
      };
    } else {
      inp = el('input', 'lm-input ' + cc(o, 'input'), field);
      try { inp.type = type; } catch (e) { inp.type = 'text'; }
      inp.value = o.inputValue == null ? '' : o.inputValue;
      if (o.inputPlaceholder) { inp.setAttribute('placeholder', o.inputPlaceholder); }
      api.get = function () { return inp.value; };
    }

    if (inp) {
      if (type !== 'radio') { inp.id = id + '-in'; }
      if (o.inputAttributes) {
        for (var a in o.inputAttributes) {
          if (Object.prototype.hasOwnProperty.call(o.inputAttributes, a)) { inp.setAttribute(a, o.inputAttributes[a]); }
        }
      }
    }
    api.el = inp;
    return api;
  }

  function showModal(o) {
    var d = defer();
    if (!hasDOM) { d.resolve(makeResult({ isDismissed: true, dismiss: 'no-dom' })); return d.promise; }
    ready(function () { openModal(o, d); });
    return d.promise;
  }

  function openModal(o, d) {
    injectStyles();
    if (current) { current.close(makeResult({ isDismissed: true, dismiss: 'replaced' }), true); }

    var inst = { o: o, closed: false, busy: false, timerId: null };
    var id = 'lm-' + (++uid);
    var theme = resolveTheme(o.theme);
    var tone = (o.icon && TONES[o.icon]) ? o.icon : 'none';
    var pos = String(o.position || 'center');
    var vpos = /top/.test(pos) ? 'top' : (/bottom/.test(pos) ? 'bottom' : 'center');
    var hpos = /start/.test(pos) ? ' lm-h-start' : (/end/.test(pos) ? ' lm-h-end' : '');
    var prevFocus = document.activeElement;
    var animate = o.animation !== false && !prefersReduced();

    /* structure */
    var container = el('div', 'lm-container lm-v-' + vpos + hpos +
      (o.backdrop === false ? ' lm-nobackdrop' : ' lm-blur') + (animate ? ' lm-show ' : ' ') + cc(o, 'container'));
    if (typeof o.backdrop === 'string') { container.style.background = o.backdrop; }
    if (o.zIndex) { container.style.zIndex = o.zIndex; }
    var cell = el('div', 'lm-cell', container);
    var cellin = el('div', 'lm-cellin', cell);
    var popup = el('div', 'lm-popup lm-tone-' + tone + (theme === 'dark' ? ' lm-dark' : '') +
      (animate ? ' lm-show ' : ' ') + cc(o, 'popup'), cellin);
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('tabindex', '-1');
    if (o.width != null) { popup.style.width = px(o.width); }
    if (o.padding != null) { popup.style.padding = px(o.padding); }
    if (o.radius != null) { popup.style.borderRadius = px(o.radius); }
    if (o.background) { popup.style.background = o.background; }
    if (o.color) { popup.style.color = o.color; }

    var closeBtn, image, iconEl, spinner;
    if (o.showCloseButton) {
      closeBtn = el('button', 'lm-close ' + cc(o, 'closeButton'), popup);
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.appendChild(document.createTextNode('\u00d7'));
      on(closeBtn, 'click', function () { finish(makeResult({ isDismissed: true, dismiss: 'close' })); });
    }
    if (o.imageUrl) {
      image = el('img', 'lm-image ' + cc(o, 'image'), popup);
      image.src = o.imageUrl;
      image.alt = o.imageAlt || '';
      if (o.imageWidth) { image.style.width = px(o.imageWidth); }
    }
    if (o.loading) {
      spinner = el('div', 'lm-spinner', popup);
      spinner.setAttribute('role', 'progressbar');
      spinner.setAttribute('aria-label', 'Loading');
    } else if (o.iconHtml || (o.icon && ICONS[o.icon])) {
      iconEl = el('div', 'lm-icon ' + cc(o, 'icon'), popup);
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.innerHTML = o.iconHtml || ICONS[o.icon];
    }

    var titleEl = el('h2', 'lm-title ' + cc(o, 'title'), popup);
    titleEl.id = id + '-title';
    var textEl = el('p', 'lm-text ' + cc(o, 'text'), popup);
    textEl.id = id + '-text';
    var htmlEl = el('div', 'lm-html ' + cc(o, 'html'), popup);
    htmlEl.id = id + '-html';

    function setContent() {
      titleEl.textContent = o.title == null ? '' : o.title;
      titleEl.style.display = o.title ? '' : 'none';
      textEl.textContent = o.text == null ? '' : o.text;
      textEl.style.display = o.text ? '' : 'none';
      htmlEl.innerHTML = '';
      if (isEl(o.html)) { htmlEl.appendChild(o.html); } else if (o.html) { htmlEl.innerHTML = o.html; }
      htmlEl.style.display = o.html ? '' : 'none';
    }
    setContent();
    popup.setAttribute('aria-labelledby', id + '-title');
    popup.setAttribute('aria-describedby', (o.html ? id + '-html' : id + '-text'));

    /* input */
    var input = null, validation;
    if (o.input) { input = buildInput(o, popup, id); }
    validation = el('div', 'lm-validation ' + cc(o, 'validation'), popup);
    validation.setAttribute('role', 'alert');
    function showValidation(msg) {
      validation.textContent = msg;
      validation.style.display = 'block';
      if (input && input.el) { input.el.setAttribute('aria-invalid', 'true'); }
    }
    function resetValidation() {
      validation.style.display = 'none';
      if (input && input.el) { input.el.removeAttribute('aria-invalid'); }
    }
    if (input) {
      on(input.field, 'input', resetValidation);
      on(input.field, 'change', resetValidation);
    }

    /* buttons */
    var btn = {};
    var actions = el('div', 'lm-actions ' + cc(o, 'actions'), popup);
    function makeButton(kind, text, color, show) {
      if (!show) { return; }
      var b = el('button', 'lm-btn lm-' + kind + ' ' + cc(o, kind + 'Button'), actions);
      b.type = 'button';
      b.appendChild(document.createTextNode(text));
      if (color) { b.style.background = color; b.style.color = '#fff'; b.style.boxShadow = 'none'; }
      btn[kind] = b;
    }
    var order = [
      ['confirm', o.confirmButtonText, o.confirmButtonColor, o.showConfirmButton],
      ['deny', o.denyButtonText, o.denyButtonColor, o.showDenyButton],
      ['cancel', o.cancelButtonText, o.cancelButtonColor, o.showCancelButton]
    ];
    if (o.reverseButtons) { order.reverse(); }
    for (var i = 0; i < order.length; i++) { makeButton(order[i][0], order[i][1], order[i][2], order[i][3]); }
    if (!actions.firstChild) { actions.style.display = 'none'; }

    if (o.footer) {
      var footer = el('div', 'lm-footer ' + cc(o, 'footer'), popup);
      if (isEl(o.footer)) { footer.appendChild(o.footer); } else { footer.innerHTML = o.footer; }
    }

    var timerBar;
    if (o.timer > 0 && o.timerProgressBar) {
      timerBar = el('div', 'lm-timer ' + cc(o, 'timerBar'), popup);
    }

    /* behaviour */
    function setBusy(b) {
      inst.busy = b;
      for (var k in btn) {
        if (Object.prototype.hasOwnProperty.call(btn, k)) { btn[k].disabled = b; }
      }
      if (btn.confirm) { if (b) { addClass(btn.confirm, 'lm-loading'); } else { removeClass(btn.confirm, 'lm-loading'); } }
    }

    function readValue() { return input && input.get ? input.get() : undefined; }

    function confirmAction() {
      if (inst.busy || inst.closed) { return; }
      var value = readValue();
      resetValidation();

      function proceed() {
        if (!isFn(o.preConfirm)) { finish(makeResult({ isConfirmed: true, value: value })); return; }
        setBusy(true);
        var out;
        try { out = o.preConfirm(value); } catch (e) { setBusy(false); showValidation(e && e.message ? e.message : String(e)); return; }
        whenDone(out, function (res) {
          if (inst.closed) { return; }
          setBusy(false);
          if (res === false) { return; }
          finish(makeResult({ isConfirmed: true, value: res === undefined ? value : res }));
        }, function (err) {
          if (inst.closed) { return; }
          setBusy(false);
          showValidation(err && err.message ? err.message : String(err));
        });
      }

      if (input && isFn(o.inputValidator)) {
        setBusy(true);
        whenDone(o.inputValidator(value), function (msg) {
          setBusy(false);
          if (msg) { showValidation(msg); if (input.el) { input.el.focus(); } return; }
          proceed();
        }, function (err) {
          setBusy(false);
          showValidation(err && err.message ? err.message : String(err));
        });
      } else {
        proceed();
      }
    }

    if (btn.confirm) { on(btn.confirm, 'click', confirmAction); }
    if (btn.deny) {
      on(btn.deny, 'click', function () {
        if (inst.busy) { return; }
        finish(makeResult({ isDenied: true, value: readValue() }));
      });
    }
    if (btn.cancel) {
      on(btn.cancel, 'click', function () {
        if (inst.busy) { return; }
        finish(makeResult({ isDismissed: true, dismiss: 'cancel' }));
      });
    }

    // Close when the backdrop is clicked (but not when a text selection drag ends there)
    var downTarget = null;
    on(container, 'mousedown', function (e) { downTarget = e.target; });
    on(container, 'click', function (e) {
      var t = e.target;
      var onBackdrop = t === container || t === cell || t === cellin;
      if (onBackdrop && (downTarget === null || downTarget === t) && !inst.busy && allow(o.allowOutsideClick)) {
        finish(makeResult({ isDismissed: true, dismiss: 'backdrop' }));
      }
      downTarget = null;
    });

    function onKey(e) {
      if (inst.closed) { return; }
      var code = e.which || e.keyCode;
      var target = e.target || document.activeElement;
      var tag = target && target.tagName;

      if (code === 27) {                                   // Escape
        if (!inst.busy && allow(o.allowEscapeKey)) {
          if (e.preventDefault) { e.preventDefault(); }
          finish(makeResult({ isDismissed: true, dismiss: 'esc' }));
        }
        return;
      }
      if (code === 13) {                                   // Enter
        if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') { return; }
        if (o.allowEnterKey !== false && btn.confirm && popup.contains(target)) {
          e.preventDefault();
          confirmAction();
        }
        return;
      }
      if (code === 9) {                                    // Tab: keep focus inside the dialog
        var list = focusables(popup);
        if (!list.length) { e.preventDefault(); popup.focus(); return; }
        var first = list[0], last = list[list.length - 1], active = document.activeElement;
        if (e.shiftKey && (active === first || active === popup || !popup.contains(active))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (active === last || !popup.contains(active))) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey, true);

    function finish(result, immediate) {
      if (inst.closed) { return; }
      inst.closed = true;
      clearTimeout(inst.timerId);
      if (current === inst) { current = null; }
      hook(o.willClose, popup);
      document.removeEventListener('keydown', onKey, true);

      function teardown() {
        if (container.parentNode) { container.parentNode.removeChild(container); }
        if (!current) {
          unlockScroll();
          if (prevFocus && prevFocus !== document.body && isFn(prevFocus.focus)) {
            try { prevFocus.focus(); } catch (e) { /* element is gone */ }
          }
        }
        hook(o.didClose);
        d.resolve(result);
      }

      if (animate && !immediate) {
        removeClass(container, 'lm-show'); removeClass(popup, 'lm-show');
        addClass(container, 'lm-hide'); addClass(popup, 'lm-hide');
        setTimeout(teardown, 170);
      } else {
        teardown();
      }
    }
    inst.close = finish;
    inst.api = {
      popup: popup,
      input: input && input.el,
      showValidation: showValidation,
      resetValidation: resetValidation,
      setBusy: setBusy,
      update: function (u) {
        if (!u) { return; }
        if ('title' in u) { o.title = u.title; }
        if ('text' in u) { o.text = u.text; }
        if ('html' in u) { o.html = u.html; }
        setContent();
      }
    };
    current = inst;

    /* mount */
    document.body.appendChild(container);
    if (o.scrollLock !== false) { lockScroll(); }

    // focus
    var f = o.focus, target = popup;
    if (f === 'auto') { f = input && input.el ? 'input' : (btn.confirm ? 'confirm' : 'popup'); }
    if (f === 'input' && input && input.el) { target = input.el; }
    else if (btn[f]) { target = btn[f]; }
    if (f !== 'none') { try { target.focus(); } catch (e) { popup.focus(); } }
    if (input && input.el && (o.input === 'text' || o.input === 'textarea') && input.el.select && o.inputValue) {
      try { input.el.select(); } catch (e2) { /* not selectable */ }
    }

    // timer
    if (o.timer > 0) {
      inst.timerId = setTimeout(function () {
        finish(makeResult({ isDismissed: true, dismiss: 'timer' }));
      }, o.timer);
      if (timerBar) {
        timerBar.style.width = '100%';
        void timerBar.offsetWidth; // force reflow so the transition starts from 100%
        setTimeout(function () {
          cssSet(timerBar, 'transition', 'width ' + o.timer + 'ms linear');
          timerBar.style.width = '0%';
        }, 20);
      }
    }

    hook(o.didOpen, popup);
  }

  function closeCurrent(result) {
    if (!current) { return; }
    current.close(result ? makeResult(result) : makeResult({ isDismissed: true, dismiss: 'close' }));
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */

  var toastBoxes = {};
  var liveToasts = [];

  function getToastBox(pos, z) {
    var box = toastBoxes[pos];
    if (!box || !box.parentNode) {
      box = el('div', 'lm-toasts lm-toasts-' + pos, document.body);
      toastBoxes[pos] = box;
    }
    if (z) { box.style.zIndex = z; }
    return box;
  }

  function showToast(o) {
    var d = defer();
    if (!hasDOM) { d.resolve(makeResult({ isDismissed: true, dismiss: 'no-dom' })); return d.promise; }
    ready(function () {
      injectStyles();
      var pos = (!o.position || o.position === 'center') ? 'top-end' : o.position;
      var theme = resolveTheme(o.theme);
      var tone = (o.icon && TONES[o.icon]) ? o.icon : 'none';
      var animate = o.animation !== false && !prefersReduced();
      var box = getToastBox(pos, o.zIndex);
      var onTop = /^top/.test(pos);

      var t = el('div', 'lm-toast lm-tone-' + tone + (theme === 'dark' ? ' lm-dark' : '') +
        (animate ? ' lm-show ' : ' ') + (o.closeOnClick !== false ? 'lm-toast-click ' : '') +
        ((o.iconHtml || (o.icon && ICONS[o.icon])) ? '' : 'lm-toast-noicon ') + cc(o, 'popup'));
      t.setAttribute('role', o.icon === 'error' || o.icon === 'warning' || o.icon === 'danger' ? 'alert' : 'status');
      if (o.width != null) { t.style.width = px(o.width); }
      if (o.background) { t.style.background = o.background; }
      if (o.color) { t.style.color = o.color; }
      if (o.radius != null) { t.style.borderRadius = px(o.radius); }

      if (o.iconHtml || (o.icon && ICONS[o.icon])) {
        var ic = el('div', 'lm-icon ' + cc(o, 'icon'), t);
        ic.setAttribute('aria-hidden', 'true');
        ic.innerHTML = o.iconHtml || ICONS[o.icon];
      }
      if (o.title) { el('div', 'lm-title ' + cc(o, 'title'), t).appendChild(document.createTextNode(o.title)); }
      if (o.text) { el('div', 'lm-text ' + cc(o, 'text'), t).appendChild(document.createTextNode(o.text)); }
      if (o.html) {
        var h = el('div', 'lm-html ' + cc(o, 'html'), t);
        if (isEl(o.html)) { h.appendChild(o.html); } else { h.innerHTML = o.html; }
      }

      var ms = o.timer == null ? 3000 : o.timer;
      var timerId = null, remaining = ms, startedAt = 0, closed = false;

      function close(reason) {
        if (closed) { return; }
        closed = true;
        clearTimeout(timerId);
        for (var i = 0; i < liveToasts.length; i++) { if (liveToasts[i].el === t) { liveToasts.splice(i, 1); break; } }
        hook(o.willClose, t);
        function done() {
          if (t.parentNode) { t.parentNode.removeChild(t); }
          if (box.parentNode && !box.firstChild) { box.parentNode.removeChild(box); delete toastBoxes[pos]; }
          hook(o.didClose);
          d.resolve(makeResult({ isDismissed: true, dismiss: reason }));
        }
        if (animate) { removeClass(t, 'lm-show'); addClass(t, 'lm-hide'); setTimeout(done, 170); } else { done(); }
      }
      function start() {
        if (!(ms > 0)) { return; }
        startedAt = new Date().getTime();
        timerId = setTimeout(function () { close('timer'); }, remaining);
      }
      function pause() {
        if (!(ms > 0) || closed) { return; }
        clearTimeout(timerId);
        remaining -= new Date().getTime() - startedAt;
        if (remaining < 400) { remaining = 400; }
      }

      if (o.showCloseButton) {
        var cb = el('button', 'lm-close ' + cc(o, 'closeButton'), t);
        cb.type = 'button';
        cb.setAttribute('aria-label', 'Close');
        cb.appendChild(document.createTextNode('\u00d7'));
        on(cb, 'click', function (e) { e.stopPropagation(); close('close'); });
      }
      if (o.closeOnClick !== false) { on(t, 'click', function () { close('click'); }); }
      on(t, 'mouseenter', pause);
      on(t, 'mouseleave', function () { if (!closed) { start(); } });

      if (onTop && box.firstChild) { box.insertBefore(t, box.firstChild); } else { box.appendChild(t); }
      liveToasts.push({ el: t, close: close });
      start();
      hook(o.didOpen, t);
    });
    return d.promise;
  }

  function closeToasts() {
    var list = liveToasts.slice(0);
    for (var i = 0; i < list.length; i++) { list[i].close('close'); }
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  // Flexible argument parsing shared by fire(), the icon shortcuts and toast():
  //   (title)  (title, text)  (title, {options})  (title, text, {options})  ({options})
  //   fire() also accepts (title, text, icon[, {options}]); toast() does not: use toast.success() etc.
  // Strings fill title, text, icon in that order; objects are options (and win over the strings).
  function parseArgs(args, forcedIcon, noIconString, fourthKey) {
    var strs = [], opts = {}, cls = {}, i, v;
    for (i = 0; i < args.length; i++) {
      v = args[i];
      if (v == null) { continue; }
      if (typeof v === 'string' || typeof v === 'number') { strs.push(String(v)); }
      else if (typeof v === 'object') { extend(opts, v); extend(cls, v.customClass); }
    }
    var out = {};
    if (strs.length > 0) { out.title = strs[0]; }
    if (strs.length > 1) { out.text = strs[1]; }
    if (strs.length > 2 && !noIconString) { out.icon = strs[2]; }
    if (strs.length > 3 && fourthKey) { out[fourthKey] = strs[3]; }
    extend(out, opts);
    if (opts.customClass) { out.customClass = cls; }
    if (forcedIcon) { out.icon = forcedIcon; }
    return out;
  }

  function createApi(base) {
    var api = {};

    api.fire = function () {
      var user = parseArgs(arguments);
      var o = merge(DEFAULTS, base, user);
      // Toasts dismiss on click, so they only get a close button when explicitly requested
      if (o.toast && !('showCloseButton' in user)) { o.showCloseButton = false; }
      return o.toast ? showToast(o) : showModal(o);
    };

    // Lumen.toast(...) plus Lumen.toast.success(...) / .error / .warning / .danger / .info / .question
    api.toast = function () {
      var o = parseArgs(arguments, null, true); o.toast = true;
      return api.fire(o);
    };

    // Lumen.success(...) etc. for dialogs, same flexible arguments
    var icons = ['success', 'error', 'warning', 'danger', 'info', 'question'];
    for (var i = 0; i < icons.length; i++) {
      (function (name) {
        api[name] = function () { return api.fire(parseArgs(arguments, name)); };
        api.toast[name] = function () {
          var o = parseArgs(arguments, name, true); o.toast = true;
          return api.fire(o);
        };
      }(icons[i]));
    }

    // confirm(title, text, icon, confirmButtonText, {options}) - every part is optional, and an
    // options object can go anywhere after the title (or be the only argument).
    //   confirm('Delete?')                          confirm({ title: 'Delete?', icon: 'danger' })
    //   confirm('Delete?', 'No undo.')              confirm('Delete?', { icon: 'danger' })
    //   confirm('Delete?', 'No undo.', 'danger')    confirm('Delete?', 'No undo.', { icon: 'danger' })
    //   confirm('Delete?', 'No undo.', 'danger', 'Delete')
    //   confirm('Delete?', 'No undo.', 'danger', 'Delete', { cancelButtonText: 'Keep' })
    api.confirm = function () {
      var o = merge({ icon: 'question', showCancelButton: true, confirmButtonText: 'Confirm' },
        parseArgs(arguments, null, false, 'confirmButtonText'));
      return api.fire(o);
    };

    // prompt(title), prompt(title, text), prompt(title, text, {options}), prompt(title, {options})
    api.prompt = function () {
      var o = merge({ input: 'text', showCancelButton: true }, parseArgs(arguments, null, true));
      return api.fire(o);
    };

    // loading(title), loading(title, text), loading(title, text, {options}), loading({options})
    api.loading = function () {
      var o = merge({ loading: true, showConfirmButton: false, showCloseButton: false, allowOutsideClick: false, allowEscapeKey: false },
        parseArgs(arguments, null, true));
      return api.fire(o);
    };

    // Run dialogs one after another; stops at the first one that isn't confirmed.
    api.queue = function (steps) {
      var d = defer(), results = [], idx = 0;
      (function next() {
        if (idx >= steps.length) { d.resolve(results); return; }
        api.fire(steps[idx]).then(function (r) {
          results.push(r);
          if (r.isConfirmed) { idx++; next(); } else { d.resolve(results); }
        });
      }());
      return d.promise;
    };

    api.mixin = function (defaults) { return createApi(merge(base, defaults)); };

    api.close = closeCurrent;
    api.closeToasts = closeToasts;
    api.isOpen = function () { return !!current; };
    api.getPopup = function () { return current ? current.api.popup : null; };
    api.getInput = function () { return current ? current.api.input : null; };
    api.update = function (u) { if (current) { current.api.update(u); } };
    api.showValidationMessage = function (m) { if (current) { current.api.showValidation(m); } };
    api.resetValidationMessage = function () { if (current) { current.api.resetValidation(); } };
    api.showLoading = function () { if (current) { current.api.setBusy(true); } };
    api.hideLoading = function () { if (current) { current.api.setBusy(false); } };

    api.setDefaults = function (o) { DEFAULTS = merge(DEFAULTS, o); };
    api.resetDefaults = function () { DEFAULTS = extend({}, INITIAL); };

    api.version = VERSION;
    api.isSupported = hasDOM && !!document.addEventListener && !!document.querySelectorAll;
    return api;
  }

  return createApi({});
}));
