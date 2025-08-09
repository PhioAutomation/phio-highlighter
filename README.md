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

## WordPress

A plugin is located at `/wordpress/iecst-highlighter`. To test this out, a docker compose is available.

```bash
cd wordpress
docker compose up
```

After some time, the WordPress site will be available at localhost:8000. Running the `docker compose up` will
scaffold the database and then configure WordPress. This will result in a new (ignored) `wordpress` directory.

Copy the `iecst-highlighter` folder into the `wordpress/wordpress/wp-content/plugins` directory.

Activate the Plugin.

In the editor, you should now see the IEC Structured Text Highlighter block.

![Block](/wordpress/block.png)

After the Page is saved, the runtime will display highlighted code blocks.

![Highlight](/wordpress/runtime.png)

The `iecst-highlighter/highlighter/themes/default.css` will define the styling of the code blocks.

## Vue

Sadly, I don't know enough about Vue yet to get this working but welcome any contributors!

