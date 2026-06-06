// How long to wait after the last keystroke before re-highlighting and re-rendering
const DEBOUNCE_MS = 1000;

// Fallback id counter for environments where crypto.randomUUID() is unavailable
let instanceCount = 0;

customElements.define(
	"code-sandbox",
	class extends HTMLElement {
		// Keep the constructor side-effect free, as required by the custom
		// elements spec. All DOM work happens in connectedCallback().
		constructor() {
			super();
		}

		/**
		 * Set up the sandbox once the element is in the document.
		 * Guarded so it only runs once, even across move/re-insertion.
		 */
		async connectedCallback() {
			if (this._initialised) return;
			this._initialised = true;

			// randomUUID() throws outside a secure context, so fall back gracefully
			this.uuid =
				crypto.randomUUID?.() ??
				`cs-${++instanceCount}-${Date.now().toString(36)}`;

			// Get the code elements from the light DOM
			let html = this.adoptSource(
				"html",
				"pre.language-html, pre.language-markup"
			);
			let css = this.adoptSource("css", "pre.language-css");
			let js = this.adoptSource("js", "pre.language-js, pre.language-javascript");

			// Create empty editors only if no content exists for any type
			if (!html && !css && !js) {
				html = this.makeSource("html");
				css = this.makeSource("css");
				js = this.makeSource("js");
			}

			this.console = this.hasAttribute("console");
			this.result =
				this.getAttribute("result") === "console" ? "console" : "iframe";
			this.debounce = null;
			this.dirty = new Set();

			try {
				this.html = await this.fetchContent(html, html ? html.value : false);
				this.css = await this.fetchContent(css, css ? css.value : false);
				this.js = await this.fetchContent(js, js ? js.value : false);

				// Create sandbox
				let logger = `<pre class="csb-console-log language-shell" id="csb-console-log-${this.uuid}"></pre>`;
				this.innerHTML = `
			<div class="csb">
				<div class="csb-header">
					<strong class="csb-label">${this.escapeHtml(
					this.title || "Code Sandbox"
				)}</strong>
					<span class="csb-controls">
						<button class="csb-btn" data-click="reset">Reload</button>
						<button class="csb-btn" data-click="copy">Copy</button>
						<button class="csb-btn" data-click="fullscreen">Fullscreen</button>
						${this.console || this.result === "console"
						? `<button class="csb-btn" data-click="clear">Clear Console</button>`
						: ""
					}
					</span>
				</div>
				<div class="csb-content">
					<div class="csb-code">
						${this.createEditor("html", html)}
						${this.createEditor("css", css)}
						${this.createEditor("js", js)}
					</div>
					<div class="${this.result === "iframe"
						? "csb-result"
						: "csb-console-result"
					}">
						<iframe class="csb-iframe" id="csb-iframe-${this.uuid
					}" sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-downloads" frameborder="0" ${this.result === "console" ? "hidden" : ""
					}></iframe>
						${this.result === "console"
						? `<div class="csb-label">Console</div>${logger}`
						: ""
					}
					</div>
				</div>
				${this.console && this.result !== "console"
						? `<details class="csb-console" ${this.getAttribute("console") === "open" ? "open" : ""
						}><summary>Console</summary>${logger}</details>`
						: ""
					}
			</div>`;

				// Get elements
				this.wrapperElem = this.querySelector(".csb");
				this.htmlElem = this.querySelector(`#csb-html-${this.uuid}`);
				this.cssElem = this.querySelector(`#csb-css-${this.uuid}`);
				this.jsElem = this.querySelector(`#csb-js-${this.uuid}`);
				this.iframeElem = this.querySelector(`#csb-iframe-${this.uuid}`);
				this.loggerElem = this.querySelector(
					`#csb-console-log-${this.uuid}`
				);

				// Render the initial UI
				this.render();

				// Setup event listeners
				this.addEventListener("input", this);
				this.addEventListener("keydown", this);
				this.addEventListener("click", this);

				// Keep the fullscreen button label in sync, including Esc to exit
				this._onFullscreenChange = () => this.updateFullscreenButton();
				document.addEventListener("fullscreenchange", this._onFullscreenChange);
			} finally {
				// Always reveal the element, even if setup failed partway
				this.removeAttribute("hidden");
			}
		}

		/**
		 * Clear any pending work when the element leaves the document
		 */
		disconnectedCallback() {
			clearTimeout(this.debounce);
			if (this._onFullscreenChange) {
				document.removeEventListener(
					"fullscreenchange",
					this._onFullscreenChange
				);
			}
		}

		/**
		 * Find a code source for a type, falling back to a highlighted <pre>
		 * @param  {String} type     The code type (html, css, js)
		 * @param  {String} selector The fallback <pre> selector
		 * @return {Element|null}    A textarea holding the source, or null
		 */
		adoptSource(type, selector) {
			let textarea = this.querySelector(`textarea[for="${type}"]`);
			if (textarea) return textarea;

			let pre = this.querySelector(selector);
			if (!pre) return null;

			textarea = this.makeSource(type);
			textarea.value = pre.textContent;
			return textarea;
		}

		/**
		 * Create an empty source textarea for a type
		 * @param  {String}  type The code type (html, css, js)
		 * @return {Element}      The textarea
		 */
		makeSource(type) {
			let textarea = document.createElement("textarea");
			textarea.setAttribute("for", type);
			textarea.value = "";
			return textarea;
		}

		/**
		 * Escape a string for safe interpolation into markup
		 * @param  {*}      value The value to escape
		 * @return {String}       The escaped string
		 */
		escapeHtml(value) {
			return String(value).replace(
				/[&<>"']/g,
				(char) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				}[char])
			);
		}

		/**
		 * Handle event listeners
		 * @param  {Event} event The event object
		 */
		handleEvent(event) {
			this[`on${event.type}`](event);
		}

		/**
		 * Update the rendered iframe on input events
		 * @param  {Event} event The event object
		 */
		oninput(event) {
			if (!event.target.matches(".csb-text")) return;

			// Keep the mirror text in sync immediately so the caret stays aligned,
			// but defer the (more expensive) syntax highlight and iframe render.
			this.syncMirror(event.target);
			this.dirty.add(event.target);

			clearTimeout(this.debounce);
			this.debounce = setTimeout(() => {
				for (let elem of this.dirty) this.highlightMirror(elem);
				this.dirty.clear();
				this.updateIframe();
			}, DEBOUNCE_MS);
		}

		/**
		 * Clear elements on click events
		 * @param  {Event} event The event object
		 */
		onclick(event) {
			// Get the task
			let task = event.target.getAttribute("data-click");
			if (!task) return;

			// Copy the inlined source — leaves the console untouched
			if (task === "copy") {
				this.copyCode(event.target);
				return;
			}

			// Toggle fullscreen — also leaves the console untouched
			if (task === "fullscreen") {
				this.toggleFullscreen();
				return;
			}

			// Reset and clear both wipe the console; reset also re-runs the sandbox
			if (this.loggerElem) {
				this.loggerElem.innerHTML = "";
			}

			if (task === "reset") {
				this.render();
			}
		}

		/**
		 * Override default tab and escape key behavior when sandbox has focus
		 * @param  {Event} event The event object
		 */
		onkeydown(event) {
			// Only run on specific keyboard events in the instance
			if (
				!event.target.matches(".csb-text") ||
				!this.contains(event.target)
			)
				return;
			if (event.key !== "Tab" && event.key !== "Escape") return;
			event.preventDefault();

			// If Tab key, indent
			if (event.key === "Tab") {
				event.target.setRangeText(
					"\t",
					event.target.selectionStart,
					event.target.selectionEnd,
					"end"
				);
				return false;
			}

			// If Escape key, shift focus
			if (event.key === "Escape") {
				let details = event.target.closest("details");
				if (!details) return;
				details.firstElementChild.focus();
			}
		}

		/**
		 * Create the editor element HTML
		 * Don't collapse if there's only one content type
		 * @param  {String}  type The type of code editor
		 * @param  {Element} elem The template element
		 * @return {string}       The HTML string
		 */
		createEditor(type, elem) {
			if (this[type] === false) return "";
			const contentTypes = Object.keys(this).filter(
				(key) => this[key] !== false && ["html", "css", "js"].includes(key)
			);
			const isSingleContentType = contentTypes.length === 1;

			return `
			<details ${(elem && elem.hasAttribute("open")) || isSingleContentType ? "open" : ""
				} ${this.hasAttribute("name")
					? `name="${this.escapeHtml(this.getAttribute("name"))}"`
					: ""
				}>
					<summary>${type.toUpperCase()}</summary>
					<label for="csb-${type}-${this.uuid
				}" class="sr-only">${type.toUpperCase()}</label>
					<div class="csb-editor">
							<pre class="csb-mirror"><code id="csb-${type}-mirror-${this.uuid
				}" class="lang-${type}"></code></pre>
							<textarea spellcheck="false" autocorrect="off" autocapitalize="off" translate="no" class="csb-text" id="csb-${type}-${this.uuid
				}"></textarea>
					</div>
			</details>`;
		}

		/**
		 * Get the mirror <code> element for a textarea
		 * @param  {Element} elem The textarea
		 * @return {Element}      The mirror element
		 */
		mirror(elem) {
			return elem.previousElementSibling.firstElementChild;
		}

		/**
		 * Copy a textarea's value into its mirror (cheap, keeps the caret aligned)
		 * @param  {Element} elem The textarea to mirror
		 */
		syncMirror(elem) {
			this.mirror(elem).textContent = elem.value;
		}

		/**
		 * Syntax highlight a textarea's mirror
		 * @param  {Element} elem The textarea to highlight
		 */
		highlightMirror(elem) {
			Prism.highlightElement(this.mirror(elem));
		}

		/**
		 * Mirror the content of a text area with syntax highlighting
		 * @param  {Element} elem The element to mirror
		 */
		mirrorContent(elem) {
			this.syncMirror(elem);
			this.highlightMirror(elem);
		}

		/**
		 * Build the document markup for the iframe
		 * @return {String} The iframe document source
		 */
		buildDocument() {
			let shim =
				this.console || this.result === "console" ? this.consoleShim() : "";
			return `${shim}${this.htmlElem ? this.htmlElem.value : ""}
			${this.cssElem ? `<style>${this.cssElem.value}</style>` : ""}
			${this.jsElem ? `<script type="module">${this.jsElem.value}<\/script>` : ""}`;
		}

		/**
		 * Update the iframe content. Assigning srcdoc loads a fresh document
		 * (and a fresh JS context), so no manual reset is needed.
		 */
		updateIframe() {
			if (this.console || this.result === "console") {
				// Attach the console listener once the new document has loaded
				this.iframeElem.addEventListener("load", () => this.attachConsole(), {
					once: true,
				});
			}
			this.iframeElem.srcdoc = this.buildDocument();
		}

		/**
		 * Render the element content
		 */
		render() {
			if (this.htmlElem) {
				this.htmlElem.value = this.html;
				this.mirrorContent(this.htmlElem);
			}
			if (this.cssElem) {
				this.cssElem.value = this.css;
				this.mirrorContent(this.cssElem);
			}
			if (this.jsElem) {
				this.jsElem.value = this.js;
				this.mirrorContent(this.jsElem);
			}
			clearTimeout(this.debounce);
			this.updateIframe();
		}

		/**
		 * Process console log items into a string
		 * @param  {*}        item  The item to process
		 * @param  {Integer}  depth How deep items are indented
		 * @param  {WeakSet}  seen  Objects already on the current path (cycle guard)
		 * @return {String}         A stringified version
		 */
		parseLog(item, depth = 0, seen = new WeakSet()) {
			let indent = "\t".repeat(depth);
			let indentProps = `${indent}\t`;

			if (Object.prototype.toString.call(item) === "[object Object]") {
				if (seen.has(item)) return "[Circular]";
				seen.add(item);
				let body = Object.entries(item)
					.map(
						([key, val]) =>
							`${indentProps}${key}: ${this.parseLog(val, depth + 1, seen)}`
					)
					.join(",\n");
				seen.delete(item);
				return `{\n${body}\n${indent}}`;
			}
			if (typeof item !== "string" && Symbol.iterator in Object(item)) {
				if (seen.has(item)) return "[Circular]";
				seen.add(item);
				let body = Array.from(item)
					.map((val) => `${indentProps}${this.parseLog(val, depth + 1, seen)}`)
					.join(",\n");
				seen.delete(item);
				return `[\n${body}\n${indent}]`;
			}
			return item && item.nodeType === 1
				? `${item.tagName.toLowerCase()}${item.id ? `#${item.id}` : ""}${item.className ? `.${item.className}` : ""
				}`
				: item;
		}

		/**
		 * Fetches content from a given source element. If the source element has a `src` attribute,
		 * it fetches the content from the URL specified in the `src` attribute. If the fetch fails,
		 * the response is not OK, or the `src` attribute is not present, it resolves with the
		 * provided fallback value.
		 *
		 * @param {HTMLElement} source - The source element to fetch content from.
		 * @param {string} fallback - The fallback value to use if fetching fails or `src` is not present.
		 * @returns {Promise<string>} A promise that resolves with the fetched content or the fallback value.
		 */
		async fetchContent(source, fallback) {
			let src = source && source.getAttribute("src");
			if (!src) return fallback;
			try {
				let response = await fetch(src);
				if (!response.ok) return fallback;
				return await response.text();
			} catch (error) {
				return fallback;
			}
		}

		/**
		 * Build the script that intercepts console methods inside the iframe.
		 * Early logs are buffered and flushed once the parent attaches a listener,
		 * so nothing logged during initial execution is lost.
		 * @return {String} The shim <script> markup
		 */
		consoleShim() {
			return `<script>
				let __console = Object.assign({}, console);
				let __listener = null;
				let __buffer = [];
				for (let type in console) {
					if (typeof console[type] !== "function") continue;
					console[type] = function (...msg) {
						if (__listener) { __listener({source: 'iframe', msg, type}); }
						else { __buffer.push({source: 'iframe', msg, type}); }
						__console[type](...msg);
					};
				}
				console.listen = function (callback) {
					__listener = callback;
					__buffer.forEach(callback);
					__buffer = [];
				};
			<\/script>`;
		}

		/**
		 * Attach the parent's console listener to the freshly loaded iframe
		 */
		attachConsole() {
			let win = this.iframeElem.contentWindow;
			if (!win || typeof win.console.listen !== "function") return;

			let instance = this;
			win.console.listen(function (data) {
				for (let item of data.msg) {
					let log = document.createElement("div");
					log.className = `csb-log-${data.type}`;
					log.textContent = instance.parseLog(item);
					instance.loggerElem.append(log);
				}
			});
		}

		/**
		 * Build a standalone, self-contained HTML document from the current
		 * editor contents: CSS in a <style> and JS in a <script type="module">
		 * inside <head>, the HTML in <body>. Content is inlined verbatim.
		 * @return {String} The complete HTML document
		 */
		buildStandaloneDocument() {
			let html = this.htmlElem ? this.htmlElem.value : "";
			let css = this.cssElem ? this.cssElem.value : "";
			let js = this.jsElem ? this.jsElem.value : "";

			let head = [
				`\t\t<meta charset="UTF-8" />`,
				`\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
				`\t\t<title>${this.escapeHtml(this.title || "Code Sandbox")}</title>`,
			];
			if (css) head.push(`\t\t<style>\n${css}\n\t\t</style>`);
			if (js) head.push(`\t\t<script type="module">\n${js}\n\t\t<\/script>`);

			return `<!doctype html>
<html lang="en">
	<head>
${head.join("\n")}
	</head>
	<body>
${html}
	</body>
</html>
`;
		}

		/**
		 * Copy the inlined document to the clipboard, then flash the button
		 * @param  {Element} button The button that was clicked
		 */
		async copyCode(button) {
			let ok = await this.copyToClipboard(this.buildStandaloneDocument());
			this.flashButton(button, ok ? "Copied!" : "Copy failed");
		}

		/**
		 * Write text to the clipboard, falling back to execCommand outside a
		 * secure context (where navigator.clipboard is unavailable).
		 * @param  {String}           text The text to copy
		 * @return {Promise<Boolean>}      Whether the copy succeeded
		 */
		async copyToClipboard(text) {
			if (navigator.clipboard?.writeText) {
				try {
					await navigator.clipboard.writeText(text);
					return true;
				} catch (error) {
					// Fall through to the legacy approach below
				}
			}

			try {
				let textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.setAttribute("readonly", "");
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.append(textarea);
				textarea.select();
				let ok = document.execCommand("copy");
				textarea.remove();
				return ok;
			} catch (error) {
				return false;
			}
		}

		/**
		 * Briefly replace a button's label with a status message
		 * @param  {Element} button  The button to update
		 * @param  {String}  message The temporary label
		 */
		flashButton(button, message) {
			clearTimeout(button._csbTimer);
			button._csbLabel ??= button.textContent;
			button.textContent = message;
			button._csbTimer = setTimeout(() => {
				button.textContent = button._csbLabel;
				delete button._csbLabel;
				delete button._csbTimer;
			}, 1500);
		}

		/**
		 * Toggle fullscreen on the whole sandbox, so the controls stay reachable
		 */
		async toggleFullscreen() {
			try {
				if (document.fullscreenElement === this.wrapperElem) {
					await document.exitFullscreen();
				} else if (this.wrapperElem.requestFullscreen) {
					await this.wrapperElem.requestFullscreen();
				}
			} catch (error) {
				// Fullscreen can be blocked by the browser or a permissions policy
			}
		}

		/**
		 * Reflect the current fullscreen state in the button label
		 */
		updateFullscreenButton() {
			let button = this.querySelector('[data-click="fullscreen"]');
			if (!button) return;
			button.textContent =
				document.fullscreenElement === this.wrapperElem
					? "Exit fullscreen"
					: "Fullscreen";
		}
	}
);
