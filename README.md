# Lumen

Lumen is a lightweight (~30kB), dependency-free library for elegant alerts, confirmations, prompts, loading screens and toasts. It is written in plain ES5, injects its own CSS, and is designed to work from legacy browsers, up to current ones.

**Version:** 1.0.0 · **License:** MIT · **Size:** one file, no dependencies

Try the demo [here](https://jhzrmx.github.io/lumen/).

---

## Contents

1. [Getting started](#1-getting-started)
2. [Core concepts](#2-core-concepts)
3. [API reference](#3-api-reference)
4. [Calling conventions (arguments)](#4-calling-conventions-arguments)
5. [Options reference](#5-options-reference)
6. [Inputs and validation](#6-inputs-and-validation)
7. [Toasts](#7-toasts)
8. [Customizing the look](#8-customizing-the-look)
9. [Accessibility and keyboard](#9-accessibility-and-keyboard)
10. [Browser support and legacy notes](#10-browser-support-and-legacy-notes)
11. [Security](#11-security)
12. [Recipes](#12-recipes)
13. [Troubleshooting](#13-troubleshooting)
14. [Changelog](#14-changelog)

---

## 1. Getting started

### Installation

Lumen is a single file. There is no build step.

**Script tag**

```html
<script src="lumen.js"></script>
<script>
  Lumen.success('Saved', 'Your changes are live.');
</script>
```

It exposes one global, `Lumen`. Put the script anywhere; it waits for `document.body` before it draws anything.

**CommonJS / bundlers**

```js
var Lumen = require('./lumen.js');
```

**AMD (RequireJS)**

```js
define(['lumen'], function (Lumen) { /* ... */ });
```

On a server (no `window`/`document`), every call is a safe no-op that resolves with `{ isDismissed: true, dismiss: 'no-dom' }`, so it is safe to import in server-rendered code.

### Your first dialogs

```js
// A simple alert
Lumen.fire('Hello', 'This is Lumen.');

// Same thing with an icon (title, text, icon)
Lumen.fire('Saved', 'Your changes are live.', 'success');

// A confirmation
Lumen.confirm('Delete file?', 'This cannot be undone.', 'danger', 'Delete')
  .then(function (result) {
    if (result.isConfirmed) { deleteFile(); }
  });

// A toast
Lumen.toast.success('Copied to clipboard');
```

---

## 2. Core concepts

### One modal at a time

Only one dialog is open at once. Opening a new one closes the current one immediately (its promise resolves with `dismiss: 'replaced'`). To show dialogs in sequence, wait for the first promise or use [`Lumen.queue()`](#lumenqueuesteps).

Toasts are separate from dialogs. Any number of toasts can be on screen together, and they never block a dialog.

### Results

Every call returns a promise that resolves **after the dialog has closed** with a result object:

| Property | Type | Meaning |
|---|---|---|
| `isConfirmed` | boolean | The confirm button was used (or Enter was pressed). |
| `isDenied` | boolean | The deny button was used. |
| `isDismissed` | boolean | Closed any other way. |
| `value` | any | The input value (if `input` was set), or the value returned by `preConfirm`. `undefined` otherwise. |
| `dismiss` | string | Why it was dismissed (only when `isDismissed` is true). |

`dismiss` is one of:

| Value | Cause |
|---|---|
| `cancel` | Cancel button |
| `close` | The × button, or `Lumen.close()` |
| `esc` | Escape key |
| `backdrop` | Click outside the dialog |
| `timer` | `timer` ran out |
| `click` | A toast was clicked |
| `replaced` | Another dialog opened on top |
| `no-dom` | Called where there is no DOM |

Exactly one of `isConfirmed`, `isDenied`, `isDismissed` is true.

```js
Lumen.fire({ title: 'Save?', showDenyButton: true, showCancelButton: true })
  .then(function (r) {
    if (r.isConfirmed)      { save(); }
    else if (r.isDenied)    { discard(); }
    else if (r.dismiss === 'esc') { /* user pressed Esc */ }
  });
```

### Promises on old browsers

If the browser has a native `Promise`, you get one (so `async`/`await` works wherever your own code supports it). If not (for example IE11), you get a small thenable that supports `.then(callback)` only. Write `.then(function (result) { ... })` and it works everywhere. See [section 10](#10-browser-support-and-legacy-notes).

---

## 3. API reference

All methods live on the `Lumen` object.

### `Lumen.fire(...)`

Open a dialog. Returns a promise for the [result](#results).

```js
Lumen.fire('Title');
Lumen.fire('Title', 'Text');
Lumen.fire('Title', 'Text', 'success');             // third string = icon
Lumen.fire('Title', { showCancelButton: true });    // options object
Lumen.fire({ title: 'Title', icon: 'info' });       // options only
```

See [Calling conventions](#4-calling-conventions-arguments). If the options contain `toast: true`, a toast is shown instead.

### Icon shortcuts

`Lumen.success()`, `Lumen.error()`, `Lumen.warning()`, `Lumen.danger()`, `Lumen.info()`, `Lumen.question()`

Same as `fire()` with the icon preset. They take `(title, text, options)` in any combination.

```js
Lumen.error('Upload failed', 'The file is larger than 10 MB.');
Lumen.success('Done', { timer: 2000, showConfirmButton: false });
```

### `Lumen.confirm(title, text, icon, confirmText, options)`

A ready-made confirmation. Defaults: icon `question`, a Cancel button, and a confirm button labelled "Confirm".

Every argument is optional, and **an options object can go anywhere after the title** (or be the only argument):

```js
Lumen.confirm('Publish?');
Lumen.confirm('Publish?', 'Everyone will see this.');
Lumen.confirm('Delete?', 'This cannot be undone.', 'danger');                 // + icon
Lumen.confirm('Delete?', 'This cannot be undone.', 'danger', 'Delete');       // + confirm button text
Lumen.confirm('Delete?', 'This cannot be undone.', 'danger', 'Delete', { cancelButtonText: 'Keep it' });

// options in place of any of the above
Lumen.confirm('Delete?', { icon: 'danger', text: 'This cannot be undone.' });
Lumen.confirm('Delete?', 'This cannot be undone.', { icon: 'danger', confirmButtonText: 'Delete' });
Lumen.confirm({ title: 'Delete?', icon: 'danger', focus: 'cancel' });
```

- Strings fill, in order: `title`, `text`, `icon`, `confirmButtonText`.
- Objects are options; they win over the strings if they conflict.

### `Lumen.prompt(title, text, options)`

A text input with a Cancel button. The typed text is in `result.value`. Like the other methods, `text` and `options` are optional and the options object can come right after the title (or be the only argument).

```js
Lumen.prompt('Your name', { inputPlaceholder: 'Jane Doe' })
  .then(function (r) { if (r.isConfirmed) { greet(r.value); } });

Lumen.prompt('Your name', 'We will use it on your invoice.', { inputLabel: 'Full name' });
```

### `Lumen.toast(...)` and `Lumen.toast.<icon>(...)`

Show a toast. See [Toasts](#7-toasts).

```js
Lumen.toast('Saved');
Lumen.toast('Saved', 'Draft synced.', { position: 'bottom' });
Lumen.toast.success('Saved', { timer: 5000 });
Lumen.toast.danger('Connection lost');
```

`toast.success`, `toast.error`, `toast.warning`, `toast.danger`, `toast.info`, `toast.question` are available.

### `Lumen.loading(title, text, options)`

Shows a spinner dialog with no buttons that cannot be dismissed by the user (no ×, no backdrop click, no Esc). Close it yourself with `Lumen.close()`.

```js
Lumen.loading('Syncing your files');
doWork().then(function () {
  Lumen.close();
  Lumen.toast.success('All files synced');
});

// with text
Lumen.loading('Processing', 'Almost done, please wait');

// with options (all arguments after the title are optional)
Lumen.loading('Processing', 'Almost done, please wait', { theme: 'dark' });
Lumen.loading({ title: 'Processing', text: 'Almost done, please wait' });
```

### `Lumen.queue(steps)`

Run an array of option objects one after another. Resolves with an array of results. It stops at the first step that is not confirmed, and that last result is included.

```js
Lumen.queue([
  { title: 'Step 1', input: 'text', inputLabel: 'Name', showCancelButton: true },
  { title: 'Step 2', input: 'radio', inputOptions: { s: 'Small', l: 'Large' }, showCancelButton: true },
  { title: 'Step 3', text: 'All set?' }
]).then(function (results) {
  var finished = results.length === 3 && results[2].isConfirmed;
});
```

### `Lumen.mixin(defaults)`

Returns a **new Lumen-like object** whose calls use `defaults` on top of the global defaults. Use it for a branded variant or a "preset".

```js
var Danger = Lumen.mixin({ icon: 'danger', confirmButtonText: 'Delete', showCancelButton: true });
Danger.fire('Delete this item?');

var Brand = Lumen.mixin({ radius: 0, customClass: { popup: 'brand-popup' } });
Brand.confirm('Print?', 'Fifty copies.');
```

The returned object has all the methods listed here (including its own `toast`, `confirm`, `mixin`, ...). `setDefaults`/`resetDefaults` on it change the **global** defaults. The "only one modal at a time" rule is shared across all mixins.

### Controlling the open dialog

These act on the dialog currently open and do nothing if none is open.

| Method | Description |
|---|---|
| `Lumen.close([result])` | Close it. With no argument it resolves as `{ isDismissed: true, dismiss: 'close' }`. You may pass a partial result, e.g. `Lumen.close({ isConfirmed: true })`. |
| `Lumen.isOpen()` | `true` if a dialog is open (toasts don't count). |
| `Lumen.getPopup()` | The dialog's DOM element, or `null`. |
| `Lumen.getInput()` | The input element (first radio for a radio group), or `null`. |
| `Lumen.update({ title, text, html })` | Change the content of the open dialog. Only those three keys are supported. |
| `Lumen.showValidationMessage(msg)` | Show an error message under the input. |
| `Lumen.resetValidationMessage()` | Hide it. |
| `Lumen.showLoading()` / `Lumen.hideLoading()` | Put the confirm button into (or out of) its busy state; all buttons are disabled while busy. |

### Toast control

| Method | Description |
|---|---|
| `Lumen.closeToasts()` | Close every visible toast (each resolves with `dismiss: 'close'`). |

### Defaults and info

| Member | Description |
|---|---|
| `Lumen.setDefaults(options)` | Change defaults for all later calls. `customClass` is merged key by key. |
| `Lumen.resetDefaults()` | Restore the built-in defaults. |
| `Lumen.version` | Version string. |
| `Lumen.isSupported` | `true` if the environment has the DOM features Lumen needs. |

---

## 4. Calling conventions (arguments)

`fire`, the icon shortcuts (`success`, `danger`, ...), `toast`, `toast.<icon>`, `confirm`, `prompt` and `loading` share one flexible argument parser.

- **Strings** fill `title`, then `text`, then `icon` (the icon string only for `fire` and `confirm`; `confirm` also takes a fourth string for the confirm button text).
- **Objects** are options, and may appear anywhere after the title.
- If an option conflicts with a string, the **option wins**.
- With an icon shortcut or `toast.<icon>`, the icon is fixed by the method name.
- `toast()` does **not** take the icon as a string; use `{ icon: '...' }` or `toast.<icon>()`.

| Call | Meaning |
|---|---|
| `Lumen.fire('T')` | title |
| `Lumen.fire('T', 'x')` | title, text |
| `Lumen.fire('T', 'x', 'success')` | title, text, icon |
| `Lumen.fire('T', {…})` | title, options |
| `Lumen.fire('T', 'x', {…})` | title, text, options |
| `Lumen.fire({…})` | options only |
| `Lumen.danger('T', 'x', {…})` | icon fixed to `danger` |
| `Lumen.toast('T', 'x', {…})` | toast, no icon unless set in options |
| `Lumen.toast.success('T', {…})` | toast with the success icon |

Numbers are accepted as the title (`Lumen.fire(404)` shows "404").

---

## 5. Options reference

All options are optional. Pass them per call, set them globally with `setDefaults()`, or bundle them with `mixin()`.

### Content

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | `''` | Heading. Inserted as text (safe). |
| `text` | string | `''` | Body text. Inserted as text (safe). |
| `html` | string \| Element | `null` | Body markup. **Inserted as HTML**, so never pass untrusted input. |
| `footer` | string \| Element | `null` | Footer area. **Inserted as HTML.** |
| `icon` | string | `null` | `success`, `error`, `warning`, `danger`, `info`, `question`. Also sets the accent color. |
| `iconHtml` | string | `null` | Custom icon markup (e.g. inline SVG). Replaces the built-in icon. Use `currentColor` to follow the accent color. |
| `imageUrl` | string | `null` | Show an image above the title. |
| `imageAlt` | string | `''` | Alt text for the image. |
| `imageWidth` | number \| string | `null` | Image width (number = px). |

### Input

See [Inputs and validation](#6-inputs-and-validation).

| Option | Type | Default | Description |
|---|---|---|---|
| `input` | string | `null` | `text`, `email`, `password`, `number`, `tel`, `url`, `search`, `date`, `time`, `color`, `range`, `textarea`, `select`, `checkbox`, `radio`. |
| `inputLabel` | string | `''` | Label above the input (checkbox: the text next to the box). |
| `inputPlaceholder` | string | `''` | Placeholder (for `select`: a disabled first option). |
| `inputValue` | any | `''` | Initial value (checkbox: truthy = checked; radio: value to preselect). |
| `inputOptions` | object \| array | `null` | Options for `select`/`radio`: `{ value: 'Label' }`, `['a', 'b']` or `[['value', 'Label']]`. |
| `inputAttributes` | object | `null` | Extra attributes set on the input, e.g. `{ maxlength: 20, autocomplete: 'off' }`. |
| `inputValidator` | function | `null` | `function (value)`. Return an error string to block confirming. May return a thenable. |

### Buttons

| Option | Type | Default | Description |
|---|---|---|---|
| `showConfirmButton` | boolean | `true` | |
| `showCancelButton` | boolean | `false` | |
| `showDenyButton` | boolean | `false` | A third button, resolves with `isDenied`. |
| `showCloseButton` | boolean | `true` | The × in the corner. On for dialogs; **off for toasts and `loading()`** unless you set it explicitly. |
| `confirmButtonText` | string | `'OK'` | |
| `cancelButtonText` | string | `'Cancel'` | |
| `denyButtonText` | string | `'No'` | |
| `confirmButtonColor` | string | `null` | CSS color for the button background (text becomes white). Default follows the icon's accent. |
| `cancelButtonColor` | string | `null` | Same for the cancel button. |
| `denyButtonColor` | string | `null` | Same for the deny button. |
| `reverseButtons` | boolean | `false` | Default order is Confirm, Deny, Cancel. `true` flips it. |
| `focus` | string | `'auto'` | Initially focused element: `auto`, `confirm`, `cancel`, `deny`, `input`, `popup`, `none`. `auto` picks the input if there is one, else the confirm button, else the dialog itself. |

### Behavior

| Option | Type | Default | Description |
|---|---|---|---|
| `allowOutsideClick` | boolean \| function | `true` | Close on backdrop click. A function is evaluated at click time. |
| `allowEscapeKey` | boolean \| function | `true` | Close on Esc. A function is evaluated at key time. |
| `allowEnterKey` | boolean | `true` | Enter confirms (see [keyboard](#9-accessibility-and-keyboard)). |
| `timer` | number | `null` | Auto-close after this many ms (`dismiss: 'timer'`). Toasts default to 3000; use `0` for a toast that stays. |
| `timerProgressBar` | boolean | `false` | Show a shrinking bar along the bottom (dialogs only). |
| `preConfirm` | function | `null` | `function (value)` run when confirming. See [below](#preconfirm). |
| `scrollLock` | boolean | `true` | Lock page scrolling while a dialog is open (scrollbar width is compensated). |

### Appearance

| Option | Type | Default | Description |
|---|---|---|---|
| `theme` | string | `'light'` | `light`, `dark`, or `auto` (follows the OS setting at the time the dialog opens). |
| `position` | string | `'center'` | Dialogs: `center`, `top`, `bottom`, with an optional `-start` / `-end` suffix to align left / right (e.g. `top-end`). Toasts: see [Toasts](#7-toasts). |
| `width` | number \| string | `null` | Number = px; or any CSS width. Default is about 27em (432px), never wider than the screen. |
| `padding` | number \| string | `null` | Overrides the inner padding. |
| `radius` | number \| string | `null` | Corner radius. |
| `background` | string | `null` | Background color of the dialog. |
| `color` | string | `null` | Text color of the dialog. |
| `backdrop` | boolean \| string | `true` | `true` = dimmed with a slight blur where supported; `false` = no dimming (the page is still blocked from clicks); a string = your own CSS background, e.g. `'rgba(0,0,0,.7)'`. |
| `animation` | boolean | `true` | Set `false` to disable open/close animation. Also skipped automatically when the user prefers reduced motion. |
| `zIndex` | number | `null` | Override stacking (default is 10000 for dialogs, 10001 for toasts). |
| `customClass` | object | `{}` | Add your own CSS classes to parts. See [section 8](#8-customizing-the-look). |

### Toast-only

| Option | Type | Default | Description |
|---|---|---|---|
| `toast` | boolean | `false` | Show as a toast (done for you by `Lumen.toast`). |
| `closeOnClick` | boolean | `true` | Clicking a toast closes it. |

### Hooks

| Option | Signature | Description |
|---|---|---|
| `didOpen` | `function (element)` | Called after it is on screen. Receives the dialog (or toast) element. |
| `willClose` | `function (element)` | Called just before it closes. |
| `didClose` | `function ()` | Called after it is removed from the page. |

Errors thrown inside hooks are logged to the console and do not break Lumen.

### `preConfirm`

Runs after the validator passes and before the dialog closes. While it works, the confirm button shows a spinner and all buttons are disabled.

- Return a value (or a thenable that resolves to one) to **close** the dialog; that value becomes `result.value`. If you return `undefined`, `result.value` is the input value.
- Return `false` to **keep the dialog open**.
- Throw, or return a thenable that rejects, to **show the error message** inside the dialog and keep it open.

```js
Lumen.fire({
  title: 'Publish?',
  showCancelButton: true,
  preConfirm: function () {
    return fetch('/api/publish', { method: 'POST' }).then(function (res) {
      if (!res.ok) { throw new Error('Server said no (' + res.status + ')'); }
      return res.json();
    });
  }
}).then(function (r) {
  if (r.isConfirmed) { console.log(r.value); }   // parsed JSON from preConfirm
});
```

(`fetch` needs its own polyfill on very old browsers; any function that returns a thenable works.)

---

## 6. Inputs and validation

### Input types and the value you get back

| `input` | `result.value` |
|---|---|
| `text`, `email`, `password`, `number`, `tel`, `url`, `search`, `date`, `time`, `color`, `range`, `textarea` | string |
| `select` | string (the selected option's value) |
| `radio` | string (checked value) or `null` if none |
| `checkbox` | boolean |

Browsers that do not support an input type (older ones with `date`, `color`, etc.) fall back to a plain text box.

### Examples

```js
// select with placeholder
Lumen.fire({
  title: 'Export format', input: 'select',
  inputOptions: { csv: 'CSV', json: 'JSON', pdf: 'PDF' },
  inputPlaceholder: 'Choose a format',
  showCancelButton: true
});

// radio
Lumen.fire({ title: 'Size', input: 'radio', inputOptions: { s: 'Small', m: 'Medium', l: 'Large' }, inputValue: 'm' });

// checkbox
Lumen.fire({ title: 'Terms', input: 'checkbox', inputLabel: 'I agree to the terms' });

// extra attributes
Lumen.prompt('Code', { inputAttributes: { maxlength: 6, inputmode: 'numeric', autocomplete: 'off' } });
```

### Validation

`inputValidator(value)` runs when the user confirms. Return a string to show it as an error and keep the dialog open; return nothing (or a falsy value) to continue. It may return a thenable for async checks. The message clears as soon as the user edits the input.

```js
Lumen.prompt('Choose a username', {
  inputValidator: function (value) {
    if (!value) { return 'Please enter a username.'; }
    if (value.length < 3) { return 'At least 3 characters.'; }
  }
});
```

Order of events on confirm: read the value → `inputValidator` → `preConfirm` → close.

You can also drive messages yourself with `Lumen.showValidationMessage('...')` / `Lumen.resetValidationMessage()`.

---

## 7. Toasts

Toasts are small, non-blocking notifications. They don't dim the page, don't take focus, and don't have buttons or inputs.

```js
Lumen.toast('Saved');
Lumen.toast('Saved', 'Draft synced just now.');
Lumen.toast.success('Saved', { position: 'bottom-end', timer: 5000 });
Lumen.toast.danger('Connection lost', { timer: 0, showCloseButton: true });  // stays until closed
```

### Behavior

- **Duration:** 3000 ms by default. `timer: 0` keeps it until the user clicks it or you call `closeToasts()`.
- **Hover:** hovering pauses the countdown; leaving resumes it.
- **Click:** clicking a toast closes it (`closeOnClick: false` disables this). Result: `dismiss: 'click'`.
- **Close button:** hidden by default; `showCloseButton: true` adds one (`dismiss: 'close'`).
- **Stacking:** toasts in the same position stack. At top positions the newest is on top; at bottom positions it is added at the bottom.
- **Result:** the promise resolves when the toast disappears, with `dismiss` of `timer`, `click` or `close`.
- **Content:** `title`, `text` (text only) and `html` (trusted HTML). `timerProgressBar` and inputs are not available for toasts.

### Positions

| Value | Place |
|---|---|
| `top-end` (default; also used when `position` is `center`) | top right |
| `top-start` | top left |
| `top` | top center |
| `bottom-end` | bottom right |
| `bottom-start` | bottom left |
| `bottom` | bottom center |

`start` is the left edge and `end` is the right edge. Lumen does not mirror these for right-to-left pages.

### Announcements

Toasts use `role="status"` (polite), except `error`, `warning` and `danger`, which use `role="alert"` so assistive technology announces them immediately.

---

## 8. Customizing the look

There are four layers, from lightest to deepest. Use whichever fits.

### Layer 1: options

Per call, globally, or via a mixin.

```js
Lumen.fire({ title: 'Wide', width: 560, radius: 6, background: '#fffbe6', color: '#222', backdrop: 'rgba(0,0,0,.6)' });

Lumen.setDefaults({ theme: 'auto', confirmButtonText: 'Got it' });
```

### Layer 2: `customClass`

Adds your classes to individual parts so you can style them from your own CSS.

| Key | Part |
|---|---|
| `container` | The full-screen overlay |
| `popup` | The dialog (for toasts: the toast) |
| `icon`, `image` | Icon / image |
| `title`, `text`, `html` | Content blocks |
| `label`, `input` | Input label / field |
| `validation` | Error message |
| `actions` | Button row |
| `confirmButton`, `denyButton`, `cancelButton` | Buttons |
| `closeButton` | The × |
| `footer` | Footer |
| `timerBar` | Progress bar |

```js
Lumen.fire({
  title: 'Styled',
  customClass: { popup: 'my-popup', confirmButton: 'my-btn' }
});
```

```css
.my-popup { border: 2px solid #111; border-radius: 0; box-shadow: 6px 6px 0 #111; }
.my-btn   { border-radius: 0; }
```

Lumen's stylesheet is inserted at the **start** of `<head>`, so your CSS wins at equal specificity. If something does not override, raise the specificity (e.g. `.lm-popup.my-popup`) or, as a last resort, use `!important`.

### Layer 3: stable class names

Every part has an `lm-` class you can target directly.

**Structure**

| Class | Element |
|---|---|
| `.lm-container` | Overlay (also `.lm-blur`, `.lm-nobackdrop`, `.lm-v-top`, `.lm-v-bottom`, `.lm-h-start`, `.lm-h-end`) |
| `.lm-cell`, `.lm-cellin` | Internal centering wrappers |
| `.lm-popup` | Dialog |
| `.lm-toasts`, `.lm-toast` | Toast container / toast |
| `.lm-icon`, `.lm-image` | Icon / image |
| `.lm-title`, `.lm-text`, `.lm-html` | Content |
| `.lm-field`, `.lm-label`, `.lm-input`, `.lm-check`, `.lm-validation` | Input area |
| `.lm-actions`, `.lm-btn` | Button row / any button |
| `.lm-confirm`, `.lm-deny`, `.lm-cancel` | Specific buttons |
| `.lm-close`, `.lm-footer`, `.lm-timer`, `.lm-spinner` | Others |

**State classes**

| Class | Meaning |
|---|---|
| `.lm-dark` | Dark theme is active (on the dialog/toast) |
| `.lm-tone-success` … `.lm-tone-question`, `.lm-tone-none` | Accent for the current icon |
| `.lm-show`, `.lm-hide` | Opening / closing animation |
| `.lm-loading` | Confirm button is busy |

### Layer 4: change the accent colors

Accent colors are driven by the `lm-tone-*` classes. Override them in your CSS:

```css
/* make "success" teal */
.lm-tone-success .lm-icon    { color: #0d9488; }
.lm-tone-success .lm-confirm { background: #0f766e; }
.lm-tone-success .lm-timer   { background: #0d9488; }
```

You can also edit the `TONES` map at the top of `lumen.js` to change them at the source.

### Themes

- `theme: 'light'` (default), `'dark'`, or `'auto'`.
- `auto` checks the OS setting when the dialog opens (browsers without `prefers-color-scheme` get light).
- To set a theme everywhere: `Lumen.setDefaults({ theme: 'auto' })`.
- Toasts accept `theme` as well.

### Custom icon

```js
Lumen.fire({
  title: 'Shipped',
  iconHtml: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 12l6 6L21 6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>'
});
```

Using `currentColor` makes the icon follow the accent color. The icon box is 72px (30px in toasts).

### Full custom skin example

```js
var Brand = Lumen.mixin({
  radius: 0,
  backdrop: 'rgba(17,17,17,.35)',
  confirmButtonColor: '#111',
  customClass: { popup: 'brand-popup', confirmButton: 'brand-btn' }
});
Brand.confirm('Print the zine?', 'Fifty copies.', { icon: null });
```

---

## 9. Accessibility and keyboard

### Built in

- Dialogs have `role="dialog"` and `aria-modal="true"`, are labelled by their title, and described by their text (or html).
- Focus moves into the dialog on open, is **trapped** while it is open (Tab and Shift+Tab cycle), and is **restored** to the previously focused element on close.
- The error message uses `role="alert"`; the input gets `aria-invalid` while an error shows.
- Icons and the loading spinner are marked appropriately for assistive technology.
- Animations are removed when the user has `prefers-reduced-motion: reduce`.
- Buttons are real `<button>` elements with visible focus outlines.

### Keys

| Key | Action |
|---|---|
| `Esc` | Closes the dialog (unless `allowEscapeKey` is false or it is busy). |
| `Enter` | Confirms, when focus is in a text-like input or on the dialog itself. It does nothing in a textarea, select or on a button (buttons keep their normal behavior). Disable with `allowEnterKey: false`. |
| `Tab` / `Shift+Tab` | Cycle through focusable elements inside the dialog. |

### Tips

- Give your `title` meaningful text; it is the dialog's accessible name.
- If you disable every way to dismiss a dialog (`allowEscapeKey`, `allowOutsideClick`, `showCloseButton`), make sure a button exists to close it.
- For a destructive action, prefer `focus: 'cancel'` so a stray Enter doesn't delete anything:

```js
Lumen.confirm('Delete everything?', 'This cannot be undone.', 'danger', { focus: 'cancel' });
```

---

## 10. Browser support and legacy notes

### Support

Lumen is written in ES5 with no transpiler, and uses only DOM features available since roughly 2015. Target range:

| Browser | Version |
|---|---|
| Internet Explorer | 10, 11 |
| Edge | 12+ |
| Chrome | 30+ |
| Firefox | 25+ |
| Safari | 7+ |
| Android browser/WebView | 4.4+ |
| iOS Safari | 7+ |

This range is what the code is designed for. Test on your own matrix before relying on it for a specific old browser.

### How legacy support is achieved

- **No modern syntax:** no arrow functions, `let`/`const`, template literals, or classes.
- **No flexbox or CSS variables:** centering uses `display: table-cell`; accent colors are generated per icon.
- **Vendor prefixes:** the stylesheet is written once and then automatically given `-webkit-` versions of `animation`, `transform`, `transition`, `backdrop-filter` and `@keyframes` at load.
- **Graceful degradation:** the backdrop blur, SVG draw-in animation and scale-in animation are enhancements. Without them you still get a correctly placed, fully working dialog. The icon's final state is also its static fallback.
- **Programmatic dismissal:** timers and the focus trap use only `addEventListener`, `querySelectorAll` and `setTimeout`.

### Promises without `Promise`

When `window.Promise` is missing, Lumen returns a minimal thenable:

- `.then(callback)` works, and the callback receives the result.
- It does **not** support chaining semantics, `.catch` handlers, or `async`/`await`.

So on legacy targets, write callbacks:

```js
Lumen.confirm('Sure?').then(function (result) {
  if (result.isConfirmed) { go(); }
});
```

If you want real promises on IE, load a Promise polyfill before Lumen; Lumen will then use it automatically.

Functions that you pass in (`preConfirm`, `inputValidator`) may return any object with a `.then(ok, fail)` method, so they also work without `Promise`.

### Content Security Policy

Lumen injects a `<style>` element, so a strict CSP needs to allow inline styles (`style-src 'unsafe-inline'`). Lumen does not currently support style nonces. Inline `style` attributes are also used for a few dynamic values (width, colors, timer bar).

---

## 11. Security

- `title`, `text` and button texts are inserted **as text**; they are safe to fill with user content.
- `html` and `footer` are inserted **as HTML**. Never put unsanitized user input in them.
- `inputAttributes` values are set as attributes; do not feed them raw user input if it could include event handlers (they are set with `setAttribute`, so `onclick=` style keys would be honored).
- `iconHtml` is HTML as well.

Safe pattern for user content with markup:

```js
var el = document.createElement('div');
el.textContent = userSuppliedString;     // text, not HTML
Lumen.fire({ title: 'Message', html: el });
```

---

## 12. Recipes

### Three-way "unsaved changes"

```js
Lumen.fire({
  title: 'Save changes before closing?',
  showDenyButton: true, showCancelButton: true,
  confirmButtonText: 'Save', denyButtonText: "Don't save"
}).then(function (r) {
  if (r.isConfirmed) { save(); close(); }
  else if (r.isDenied) { close(); }
});
```

### Destructive confirm with safe default

```js
Lumen.confirm('Delete project?', 'All 14 files will be removed.', 'danger', {
  confirmButtonText: 'Delete project', focus: 'cancel'
}).then(function (r) { if (r.isConfirmed) { remove(); } });
```

### Form-like prompt with validation

```js
Lumen.prompt('Name your workspace', {
  inputLabel: 'Workspace name',
  inputPlaceholder: 'e.g. Studio North',
  inputAttributes: { maxlength: 24 },
  confirmButtonText: 'Create',
  inputValidator: function (v) { if (!v || v.length < 3) { return 'Use at least 3 characters.'; } }
}).then(function (r) { if (r.isConfirmed) { create(r.value); } });
```

### Save with a loader and server errors

```js
Lumen.fire({
  title: 'Publish now?', icon: 'question', showCancelButton: true, confirmButtonText: 'Publish',
  preConfirm: function () {
    return publishToServer();          // return a thenable; a rejection shows its message in the dialog
  }
}).then(function (r) {
  if (r.isConfirmed) { Lumen.toast.success('Published'); }
});
```

### Block the screen while working

```js
Lumen.loading('Uploading', 'Please keep this tab open.');
upload().then(function () {
  Lumen.close();
  Lumen.toast.success('Upload complete');
}, function () {
  Lumen.close();
  Lumen.error('Upload failed', 'Please try again.');
});
```

### Session-timeout warning with countdown bar

```js
Lumen.fire({
  icon: 'warning', title: 'Still there?', text: 'You will be signed out soon.',
  timer: 15000, timerProgressBar: true,
  confirmButtonText: 'Stay signed in', allowOutsideClick: false
}).then(function (r) {
  if (r.isConfirmed) { refreshSession(); }
  else if (r.dismiss === 'timer') { signOut(); }
});
```

### Multi-step wizard

```js
Lumen.queue([
  { title: 'Step 1 of 2', input: 'text', inputLabel: 'Your name', showCancelButton: true, confirmButtonText: 'Next' },
  { title: 'Step 2 of 2', input: 'checkbox', inputLabel: 'Email me a summary', confirmButtonText: 'Finish' }
]).then(function (results) {
  if (results.length === 2 && results[1].isConfirmed) {
    submit(results[0].value, results[1].value);
  }
});
```

### Fully locked dialog

```js
Lumen.fire({
  icon: 'warning', title: 'Action required',
  showCloseButton: false, allowOutsideClick: false, allowEscapeKey: false,
  confirmButtonText: 'I understand'
});
```

### Dynamic backdrop rule

```js
Lumen.fire({
  title: 'Edit profile',
  allowOutsideClick: function () { return !formIsDirty(); }
});
```

### Update content while open

```js
Lumen.fire({ title: 'Working...', showConfirmButton: false, allowOutsideClick: false });
setTimeout(function () { Lumen.update({ title: 'Almost there...', text: 'Finishing up.' }); }, 1500);
setTimeout(function () { Lumen.close(); }, 3000);
```

### Persistent toast you close yourself

```js
Lumen.toast.warning('You are offline', { timer: 0, showCloseButton: true, position: 'bottom' });
// later, when back online:
Lumen.closeToasts();
```

### App-wide defaults and a preset

```js
Lumen.setDefaults({ theme: 'auto', confirmButtonText: 'Got it', zIndex: 20000 });

var Destructive = Lumen.mixin({ icon: 'danger', showCancelButton: true, focus: 'cancel' });
Destructive.fire('Remove this member?', 'They will lose access immediately.');
```

---

## 13. Troubleshooting

**The dialog appears behind my header or another overlay.**
Set a higher `zIndex` (global via `setDefaults({ zIndex: 99999 })`). Defaults are 10000 for dialogs and 10001 for toasts.

**My CSS does not override Lumen's.**
Lumen's styles are inserted first in `<head>`, so equal-specificity rules in your CSS win. If yours still loses, make the selector more specific (`.lm-popup.my-popup`) or load your stylesheet after the page's head styles. Use `customClass` to attach your class.

**`await`, `.catch()` or chained `.then()` calls don't work on IE.**
Without a native `Promise`, Lumen returns a minimal thenable (single-callback `.then` only). Use `.then(function (result) {...})`. For real promises, load a Promise polyfill before Lumen.

**A second dialog replaced the first one unexpectedly.**
Only one dialog is open at a time. Chain the next dialog inside the `.then` of the first, or use `Lumen.queue()`.

**My toast has no × button.**
That is the default. Add `showCloseButton: true`. Toasts also close on click and after 3 seconds.

**My toast disappears too quickly / never disappears.**
Set `timer` (ms). `timer: 0` keeps it open until clicked or `Lumen.closeToasts()`.

**Enter does not submit my textarea.**
Intentional: Enter inserts a new line in a textarea. Users can click Confirm.

**Page jumps or loses its scrollbar when the dialog opens.**
Lumen compensates for the scrollbar width. If your layout uses its own scroll container, set `scrollLock: false`.

**Strict CSP blocks the styles.**
Allow inline styles in `style-src`. See [CSP notes](#content-security-policy).

**The dialog did not appear when I called `fire()` early in the page.**
Lumen waits for `document.body`. If you call it extremely early, it queues until the DOM is ready, then opens.

**I need dialogs stacked on top of each other.**
Not supported by design; use sequences (`queue`) or toasts for non-blocking messages.

---

## 14. Changelog

### 1.0.0
- Dialogs: `fire`, icon shortcuts (`success`, `error`, `warning`, `danger`, `info`, `question`), `confirm`, `prompt`, `loading`, `queue`, `mixin`.
- Inputs: text-like types, textarea, select, radio, checkbox, range; sync/async validation; `preConfirm` with loader.
- Toasts: six positions, hover pause, click to dismiss, `toast.<icon>()` shortcuts.
- Light, dark and auto themes; `customClass`, stable `lm-*` classes, per-option styling.
- Accessibility: roles, focus trap and restore, keyboard handling, reduced-motion support.
- Plain ES5 with automatic vendor prefixing.