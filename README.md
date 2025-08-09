# phio-highlighter-samples
A set of examples for using the Phio Highlighter for IEC 61131-3 Structured Text syntax highlighting

## HTML Embed

The `sample.html` file demonstrates how to use the script directly.

You can view this hosted at : https://phioautomation.github.io/phio-highlighter-samples/sample.html

1. Add the `script` tag
```html
<script src="https://highlighter.phioautomation.com/iecst.js"></script>
```
2. Add a stylesheet to for the highlighting style. This can be any Prism style CSS.
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vsc-dark-plus.min.css" />
```
3. Add `pre` and `code` tags with the class `language-phioiecst` to your document
```html
<pre class="language-phioiecst"><code class="language-phioiecst">// Code goes here</code></pre>
```

## React

A sample is provided at `react/src/components/StructuredTextHighlighter.tsx`. To run this :
```bash
cd react
npm install
npm run dev
```
![React Sample](/react/sample.png)
