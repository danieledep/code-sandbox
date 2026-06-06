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
				let logger = `<pre class="sandbox-console-log language-shell" id="sandbox-console-log-${this.uuid}"></pre>`;
				this.innerHTML = `
			<div class="sandbox">
				<div class="sandbox-header">
					<strong class="sandbox-label">${this.escapeHtml(
					this.title || "Code Sandbox"
				)}</strong>
					<span class="sandbox-controls">
						<button class="sandbox-btn" data-click="reset">Reload</button>
						${this.console || this.result === "console"
						? `<button class="sandbox-btn" data-click="clear">Clear Console</button>`
						: ""
					}
					</span>
				</div>
				<div class="sandbox-content">
					<div class="sandbox-code">
						${this.createEditor("html", html)}
						${this.createEditor("css", css)}
						${this.createEditor("js", js)}
					</div>
					<div class="${this.result === "iframe"
						? "sandbox-result"
						: "sandbox-console-result"
					}">
						<iframe class="sandbox-iframe" id="sandbox-iframe-${this.uuid
					}" sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-downloads" frameborder="0" ${this.result === "console" ? "hidden" : ""
					}></iframe>
						${this.result === "console"
						? `<div class="sandbox-label">Console</div>${logger}`
						: ""
					}
					</div>
				</div>
				${this.console && this.result !== "console"
						? `<details class="sandbox-console" ${this.getAttribute("console") === "open" ? "open" : ""
						}><summary>Console</summary>${logger}</details>`
						: ""
					}
			</div>`;

				// Get elements
				this.htmlElem = this.querySelector(`#sandbox-html-${this.uuid}`);
				this.cssElem = this.querySelector(`#sandbox-css-${this.uuid}`);
				this.jsElem = this.querySelector(`#sandbox-js-${this.uuid}`);
				this.iframeElem = this.querySelector(`#sandbox-iframe-${this.uuid}`);
				this.loggerElem = this.querySelector(
					`#sandbox-console-log-${this.uuid}`
				);

				// Render the initial UI
				this.render();

				// Setup event listeners
				this.addEventListener("input", this);
				this.addEventListener("keydown", this);
				this.addEventListener("click", this);
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
			if (!event.target.matches(".sandbox-text")) return;

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

			// If there's a console, clear it
			if (this.loggerElem) {
				this.loggerElem.innerHTML = "";
			}

			// If reset, wipe all elements
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
				!event.target.matches(".sandbox-text") ||
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
					<label for="sandbox-${type}-${this.uuid
				}" class="sr-only">${type.toUpperCase()}</label>
					<div class="sandbox-editor">
							<pre class="sandbox-mirror"><code id="sandbox-${type}-mirror-${this.uuid
				}" class="lang-${type}"></code></pre>
							<textarea spellcheck="false" autocorrect="off" autocapitalize="off" translate="no" class="sandbox-text" id="sandbox-${type}-${this.uuid
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
					log.className = `log-${data.type}`;
					log.textContent = instance.parseLog(item);
					instance.loggerElem.append(log);
				}
			});
		}
	}
);
