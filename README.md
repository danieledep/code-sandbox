# code-sandbox web component

This is a fork of [code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07) web component from [Chris Ferdinandi](https://gomakethings.com) for displaying an interactive code sandbox for HTML, CSS and javascript, similar to what **CodePen** does.

Having a code sandbox web component can be useful for showing code snippets in a more interactive way, and it doesn't require any external third-party services like **CodePen** or **JSFiddle**.

Also being a web component, it means it can be used in any framework or vanilla JavaScript and it will always work, since it doesn't depend on any framework. It has no hard dependencies: syntax highlighting is optional and pluggable — drop in [PrismJS](https://prismjs.com/) and it's used automatically, or wire up another highlighter such as [Shiki](https://shiki.style/) (see [Syntax highlighting](#syntax-highlighting)). Without one, the editors simply show plain text. This fork adds a few useful features to the original code too.

## Installation

The component is a single self-registering custom element with no build step and no required dependencies (syntax highlighting is optional — see [Syntax highlighting](#syntax-highlighting)). Use it via npm or straight from a CDN.

### npm

```bash
npm install @danieledep/code-sandbox
```

Import it once to register the `<code-sandbox>` element, and include the stylesheet:

```js
import "@danieledep/code-sandbox";
import "@danieledep/code-sandbox/code-sandbox.css";
```

If your bundler doesn't handle CSS imports, link the stylesheet in your HTML instead (as in the CDN snippet below, pointed at your local copy).

### CDN

No install, no build — drop two tags into the page. Pin a version (`@1`) so it can't shift under you:

```html
<link
	rel="stylesheet"
	href="https://cdn.jsdelivr.net/npm/@danieledep/code-sandbox@1/src/code-sandbox.css"
/>
<script
	type="module"
	src="https://cdn.jsdelivr.net/npm/@danieledep/code-sandbox@1/src/code-sandbox.js"
></script>
```

unpkg works the same way — swap the host for `https://unpkg.com/`.

### Usage

Either way, author a sandbox declaratively, with one `<textarea>` per language:

```html
<code-sandbox>
	<textarea for="html"><!-- markup --></textarea>
	<textarea for="css">/* styles */</textarea>
	<textarea for="js">// script</textarea>
</code-sandbox>
```

## Attributes

| Attribute | Description                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `console`    | If present displays the console (Optional) |
| `hidden`     | Used to prevent flashes of unstyled content      |
| `name`    | The name attribute to be attached to the `<details>` elements, which makes only one open at the time (Optional) |
| `result`     | Controls what is displayed on the right side panel, can either be `iframe` or `console`. Defaults to `iframe`     |
| `src`     | The URL of the file to fetch and run in the sandbox. Can be on the same origin or a remote file (Optional)      |
| `title`   | The title of the code block, defaults to `Code sandbox`. (Optional)                                             |

## Syntax highlighting

Highlighting is optional and pluggable. Each editor is a transparent `<textarea>` layered over a highlighted mirror, so a highlighter only has to colour the mirror's text — the component keeps it aligned with the textarea.

- **Prism (zero config)** — include PrismJS and a Prism theme on the page and the component detects `window.Prism` and uses it automatically.
- **None** — with no highlighter present, the editors show readable plain text (coloured via `--csb-editor-bg` / `--csb-editor-color`).
- **Custom (e.g. Shiki)** — assign a function to the element's static `highlight` property:

```js
customElements.get("code-sandbox").highlight = (code, lang, element) => {
	/* ... */
};
```

| Argument  | Description                                                          |
| --------- | ------------------------------------------------------------------- |
| `code`    | The editor's current source text                                    |
| `lang`    | The language — `"html"`, `"css"` or `"js"`                          |
| `element` | The mirror `<code>` element, already holding the plain text         |

The function may be `async` and may return an HTML string, which the component sets as the mirror's markup (and discards if the editor changed while an async highlighter was still running). Return nothing if you mutate `element` yourself, as Prism does.

### Example: Shiki

```js
import { createHighlighter } from "https://esm.sh/shiki";

const highlighter = await createHighlighter({
	langs: ["html", "css", "js"],
	themes: ["github-dark"],
});

customElements.get("code-sandbox").highlight = (code, lang) =>
	highlighter.codeToHtml(code, {
		lang: lang || "txt",
		theme: "github-dark",
		structure: "inline", // colour spans only — keeps the component's own <pre>/<code> and metrics
	});

// editors that rendered while Shiki was loading need a nudge
document.querySelectorAll("code-sandbox").forEach((el) => el.rehighlight());
```

Use `structure: "inline"` so Shiki emits only the coloured token spans; the component's own element and CSS keep the mirror aligned with the textarea.

## Theming

The component exposes a set of CSS custom properties so you can match it to your own design without overriding selectors. Set them on `code-sandbox` (or any ancestor, e.g. `:root`):

```css
code-sandbox {
	--csb-radius: 0;
	--csb-min-height: 24em;
	--csb-preview-bg: #faf8f5;
}
```

| Property              | Description                                  | Default                              |
| --------------------- | -------------------------------------------- | ------------------------------------ |
| `--csb-color`         | Text colour of the chrome (labels, summaries) | `light-dark(#272727, #f7f7f7)`       |
| `--csb-bg-color`      | Background of the frame (header and chrome)   | `Canvas`                             |
| `--csb-border-color`  | Borders and dividers                          | `light-dark(#ddd, #6b6b6b)`          |
| `--csb-radius`        | Corner radius of the frame, buttons and panels | `0.25em`                            |
| `--csb-min-height`    | Minimum height of the editors, preview and console panels | `15em`                  |
| `--csb-resize`        | How the frame can be drag-resized (`vertical`, `horizontal`, `both`, `none`) | `both`        |
| `--csb-layout-mobile` | Mobile (<768px) layout as a `grid-template` of named areas — see [Layout](#layout) | stacked          |
| `--csb-layout`        | Desktop (≥768px) layout as a `grid-template` of named areas — see [Layout](#layout) | editors left, result right |
| `--csb-preview-bg`    | Background of the iframe preview              | `#ffffff`                            |
| `--csb-font-family`   | Font for the code editors and console         | `ui-monospace, Menlo, Monaco, "Courier New", monospace` |
| `--csb-font-size`     | Font size for the code editors and console    | `0.875em`                            |
| `--csb-tab-size`      | Tab width in the editors and console          | `2`                                  |
| `--csb-editor-bg`     | Editor background (base colour, also used when Prism isn't loaded) | `#282c34` |
| `--csb-editor-color`  | Editor base text colour (un-highlighted text) | `#abb2bf`                   |
| `--csb-console-bg`    | Console panel background                      | `#282c34`                   |
| `--csb-console-color` | Console base text colour                      | `#abb2bf`                   |
| `--csb-warning-color` | Colour of `console.warn` output               | `#f9d767`                            |
| `--csb-error-color`   | Colour of `console.error` output              | `#f9c8c8`                            |

## Layout

The whole sandbox is a single CSS grid, so each arrangement is controlled with one property, written as a `grid-template` of named areas: `--csb-layout-mobile` below the 768px breakpoint and `--csb-layout` at or above it. The areas are:

- `header` — the title bar and controls
- `html`, `css`, `js` — the three editors
- `result` — the preview iframe (or the console, when `result="console"`)
- `console` — the console drawer, when the `console` attribute is used

By default mobile is a vertical stack and desktop puts the editors on the left with the result on the right. To get a CodePen-style desktop layout — editors across the top, preview below — redefine the desktop areas:

```css
code-sandbox {
	--csb-layout:
		"header header header"    auto
		"html   css    js"        1fr
		"result result result"    1fr
		"console console console" auto / 1fr 1fr 1fr;
}
```

Any area you omit simply isn't rendered into. Because the editors are collapsible, prefer `auto` rows where you want a pane to shrink to its summary when closed, and `1fr` where it should fill.

### Resources

- [cferdinandi/code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07)
- [PrismJS](https://prismjs.com/)
- [Shiki](https://shiki.style/)
