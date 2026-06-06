# code-sandbox web component

This is a fork of [code-sandbox](https://gist.github.com/cferdinandi/df9c95ae5f5ebcddf2ab85bb2805ff07) web component from [Chris Ferdinandi](https://gomakethings.com) for displaying an interactive code sandbox for HTML, CSS and javascript, similar to what **CodePen** does.

Having a code sandbox web component can be useful for showing code snippets in a more interactive way, and it doesn't require any external third-party services like **CodePen** or **JSFiddle**.

Also being a web component, it means it can be used in any framework or vanilla JavaScript and it will always work, since it doesn't depend on any framework. The only dependency it uses is [PrismJS](https://prismjs.com/) for syntax highlighting, which can be included directly in the JavaScript file. This fork adds a few useful features to the original code too.

## Attributes

| Attribute | Description                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `console`    | If present displays the console (Optional) |
| `hidden`     | Used to prevent flashes of unstyled content      |
| `name`    | The name attribute to be attached to the `<details>` elements, which makes only one open at the time (Optional) |
| `result`     | Controls what is displayed on the right side panel, can either be `iframe` or `console`. Defaults to `iframe`     |
| `src`     | The URL of the file to fetch and run in the sandbox. Can be on the same origin or a remote file (Optional)      |
| `title`   | The title of the code block, defaults to `Code sandbox`. (Optional)                                             |

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
