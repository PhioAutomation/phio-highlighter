import { highlightCode } from "@lezer/highlight";
import { parser } from "./iecst-parser";
import { highlighter } from "./tag-highlighter";

function renderHighlightedHTML(code, tree, highlighter) {
  let html = "";
  highlightCode(
    code,
    tree,
    highlighter,
    (text, classes) => {
      if (classes) {
        html += `<span class="${classes}">${escapeHtml(text)}</span>`;
      } else {
        html += escapeHtml(text);
      }
    },
    () => {
      html += "<br/>";
    }
  );
  return html;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

// Expose the highlight function globally
window.highlightCodeBlocks = function () {
  document.querySelectorAll("code.language-phioiecst").forEach(el => {
    const source = el.textContent
    const tree = parser.parse(source);
    const html = renderHighlightedHTML(source, tree, highlighter);
    el.innerHTML = html;
  });
};

// Auto run on content loaded
window.addEventListener("DOMContentLoaded", () => {
  window.highlightCodeBlocks();
});


