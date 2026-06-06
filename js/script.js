// Use Shiki (loaded from a CDN) as code-sandbox's syntax highlighter.
// If Shiki fails to load, the component falls back to plain text on its own.
import { createHighlighter } from "https://esm.sh/shiki@1";

const THEME = "one-dark-pro"; // pairs with the default --csb-editor-bg (#282c34)

// Map the component's language ids ("html" | "css" | "js") to Shiki's.
const LANGS = { html: "html", css: "css", js: "javascript" };

try {
	const highlighter = await createHighlighter({
		themes: [THEME],
		langs: Object.values(LANGS),
	});

	await customElements.whenDefined("code-sandbox");
	const CodeSandbox = customElements.get("code-sandbox");

	// structure: "inline" emits only the coloured token spans — no <pre>/<code>
	// wrapper and no background — so the component's own element and CSS keep
	// the highlighted mirror aligned with the textarea.
	CodeSandbox.highlight = (code, lang) =>
		highlighter.codeToHtml(code, {
			lang: LANGS[lang] ?? "txt",
			theme: THEME,
			structure: "inline",
		});

	// Editors that rendered before Shiki finished loading need a refresh.
	document
		.querySelectorAll("code-sandbox")
		.forEach((sandbox) => sandbox.rehighlight());
} catch (error) {
	console.warn("Shiki failed to load; code-sandbox will show plain text.", error);
}
