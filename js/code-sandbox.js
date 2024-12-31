customElements.define(
	"code-sandbox",
	class extends HTMLElement {
		// The class constructor object
		constructor() {
			// Always call super first in constructor
			super();

			// Get the code elements
			let intro = this.querySelector('[for="intro"]');
			let collapse = this.hasAttribute("collapse");
			let html = this.querySelector('textarea[for="html"]');
			if (!html && this.querySelector('pre[class="language-html"]')) {
				html = document.createElement("textarea");
				html.setAttribute("for", "html");
				html.value = this.querySelector(
					'pre[class="language-html"]'
				).textContent;
			}
			let css = this.querySelector('textarea[for="css"]');
			if (!css && this.querySelector('pre[class="language-css"]')) {
				css = document.createElement("textarea");
				css.setAttribute("for", "css");
				css.value = this.querySelector('pre[class="language-css"]').textContent;
			}
			let js = this.querySelector('textarea[for="js"]');
			if (!js && this.querySelector('pre[class="language-js"]')) {
				js = document.createElement("textarea");
				js.setAttribute("for", "js");
				js.value = this.querySelector('pre[class="language-js"]').textContent;
			}

			(async () => {
				this.html = await this.fetchContent(html, !!html ? html.value : false);
				this.css = await this.fetchContent(css, !!css ? css.value : false);
				this.js = await this.fetchContent(js, !!js ? js.value : false);

				this.console = this.hasAttribute("console");
				this.result =
					this.getAttribute("result") === "console" ? "console" : "iframe";
				this.debounce = null;

				// Create sandbox
				let logger = `<div class="sandbox-console-log" id="sandbox-console-log-${this.uuid}"></div>`;
				this.innerHTML = `${
					collapse && intro ? '<details class="margin-bottom">' : ""
				}
			${intro ? intro.innerHTML : ""}
			<div class="sandbox">
				<div class="sandbox-header">
					<strong class="sandbox-label">Code Sandbox</strong>
					<span class="sandbox-controls">
						<button class="sandbox-btn" data-click="reset">Reload</button>
						${
							this.console || this.result === "console"
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
					<div class="${
						this.result === "iframe"
							? "sandbox-result"
							: "sandbox-console-result"
					}">
						<iframe class="sandbox-iframe" id="sandbox-iframe-${
							this.uuid
						}" sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-downloads" frameborder="0" ${
					this.result === "console" ? "hidden" : ""
				}></iframe>
						${
							this.result === "console"
								? `<div class="sandbox-label">Console</div>${logger}`
								: ""
						}
					</div>
				</div>
				${
					this.console && this.result !== "console"
						? `<details class="sandbox-console" ${
								this.getAttribute("console") === "open" ? "open" : ""
						  }><summary>Console</summary>${logger}</details>`
						: ""
				}
			</div>
			${collapse && intro ? "</details>" : ""}`;

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

				// Show the element in the UI
				this.removeAttribute("hidden");
			})();
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
			clearTimeout(this.debounce);
			this.mirrorContent(event.target);
			this.debounce = setTimeout(() => {
				this.updateIframe();
			}, 1000);
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
			<details ${
				(elem && elem.hasAttribute("open")) || isSingleContentType ? "open" : ""
			} ${
				this && this.hasAttribute("name")
					? `name="${this.getAttribute("name")}"`
					: ""
			}>
					<summary>${type.toUpperCase()}</summary>
					<label for="sandbox-${type}-${
				this.uuid
			}" class="screen-reader">${type.toUpperCase()}</label>
					<div class="sandbox-editor">
							<pre class="sandbox-mirror"><code id="sandbox-${type}-mirror-${
				this.uuid
			}" class="lang-${type}"></code></pre>
							<textarea spellcheck="false" autocorrect="off" autocapitalize="off" translate="no" class="sandbox-text" id="sandbox-${type}-${
				this.uuid
			}"></textarea>
					</div>
			</details>`;
		}

		/**
		 * Mirror the content of a text area with syntax highlighting
		 * @param  {Element} elem The element to mirror
		 */
		mirrorContent(elem) {
			let mirror = elem.previousElementSibling.firstElementChild;
			mirror.textContent = elem.value;
			Prism.highlightElement(mirror);
		}

		/**
		 * Update the iframe content
		 */
		updateIframe() {
			// Create new iframe
			let clone = this.iframeElem.cloneNode();
			this.iframeElem.replaceWith(clone);
			this.iframeElem = clone;

			// Attach console logs
			this.setupConsole();

			// Render
			this.iframeElem.contentWindow.document.open();
			this.iframeElem.contentWindow.document.writeln(
				`${this.htmlElem ? this.htmlElem.value : ""}
			${this.cssElem ? `<style>${this.cssElem.value}</style>` : ""}
			${this.jsElem ? `<script type="module">${this.jsElem.value}</script>` : ""}`
			);
			this.iframeElem.contentWindow.document.close();
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
			this.debounce = setTimeout(() => {
				this.updateIframe();
			}, 1000);
		}

		/**
		 * Process console log items into a string
		 * @param  {*}       item  The item to process
		 * @param  {Integer} depth How deep items are indented
		 * @return {String}        A stringified version
		 */
		parseLog(item, depth = 0) {
			let instance = this;
			let indent = [...new Array(depth)].map(() => "\t").join("");
			let indentProps = `${indent}\t`;
			if (Object.prototype.toString.call(item) === "[object Object]") {
				return `{\n${Object.entries(item)
					.map(function ([key, val]) {
						return `${indentProps}${key}: ${instance.parseLog(val, depth + 1)}`;
					})
					.join(",\n")}\n${indent}}`;
			}
			if (typeof item !== "string" && Symbol.iterator in Object(item)) {
				return `[\n${Array.from(item)
					.map(function (val) {
						return `${indentProps}${instance.parseLog(val, depth + 1)}`;
					})
					.join(",\n")}\n${indent}]`;
			}
			return item && item.nodeType === 1
				? `${item.tagName.toLowerCase()}${item.id ? `#${item.id}` : ""}${
						item.className ? `.${item.className}` : ""
				  }`
				: item;
		}

		/**
		 * Fetches content from a given source element. If the source element has a `src` attribute,
		 * it fetches the content from the URL specified in the `src` attribute. If the fetch fails
		 * or the `src` attribute is not present, it resolves with the provided fallback value.
		 *
		 * @param {HTMLElement} source - The source element to fetch content from.
		 * @param {string} fallback - The fallback value to use if fetching fails or `src` is not present.
		 * @returns {Promise<string>} A promise that resolves with the fetched content or the fallback value.
		 */
		fetchContent(source, fallback) {
			return new Promise((resolve, reject) => {
				if (source && source.getAttribute("src")) {
					fetch(source.getAttribute("src"))
						.then((response) => response.text())
						.then((data) => resolve(data))
						.catch((error) => resolve(fallback));
				} else {
					resolve(fallback);
				}
			});
		}

		/**
		 * Intercept console log events in the iframe
		 */
		setupConsole() {
			// Only run if there's a console to log into
			if (!this.console && this.result !== "console") return;

			// Replace native console methods
			this.iframeElem.contentWindow.document.open();
			this.iframeElem.contentWindow.document.writeln(
				`<script>
				let __console = Object.assign({}, console);
				let __listener = function () {};
				for (let type in console) {
					console[type] = function (...msg) {
						__listener({source: 'iframe', msg, type}, '*');
						__console[type](...msg);
					};
				}
				console.listen = function (callback) {
					__listener = callback;
				};
			<\/script>`
			);
			this.iframeElem.contentWindow.document.close();

			// Listen for messages
			let instance = this;
			this.iframeElem.contentWindow.console.listen(function (data) {
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
