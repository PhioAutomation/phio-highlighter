import { useState } from "react";
import StructuredTextHighlighter from "./components/StructuredTextHighlighter";

function App() {
  const [code, setCode] = useState("// Hello World");
  const [theme, setTheme] = useState("prism-vsc-dark-plus");

  const themes = [
    "prism-a11y-dark",
    "prism-atom-dark",
    "prism-base16-ateliersulphurpool.light",
    "prism-cb",
    "prism-coldark-cold",
    "prism-coldark-dark",
    "prism-coy-without-shadows",
    "prism-darcula",
    "prism-dracula",
    "prism-duotone-dark",
    "prism-duotone-earth",
    "prism-duotone-forest",
    "prism-duotone-light",
    "prism-duotone-sea",
    "prism-duotone-space",
    "prism-ghcolors",
    "prism-gruvbox-dark",
    "prism-gruvbox-light",
    "prism-holi-theme",
    "prism-hopscotch",
    "prism-lucario",
    "prism-material-dark",
    "prism-material-light",
    "prism-material-oceanic",
    "prism-night-owl",
    "prism-nord",
    "prism-one-dark",
    "prism-one-light",
    "prism-pojoaque",
    "prism-shades-of-purple",
    "prism-solarized-dark-atom",
    "prism-synthwave84",
    "prism-vs",
    "prism-vsc-dark-plus",
    "prism-xonokai",
    "prism-z-touch",
  ];

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="theme-select" style={{ marginRight: 8 }}>
          Theme:
        </label>
        <select
          id="theme-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        cols={60}
        style={{ marginBottom: "1rem", fontFamily: "monospace" }}
      />
      <StructuredTextHighlighter code={code} theme={theme} />
    </>
  );
}

export default App;
