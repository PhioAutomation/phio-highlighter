import { useEffect } from "react";

// We have to let Typescript know that we have a
// highlightCodeBlocks function on the window object that
// is loaded from the script
declare global {
  interface Window {
    highlightCodeBlocks?: () => void;
  }
}

export type StructuredTextHighlighterProps = {
  code: string;
  theme: string;
};

export default function StructuredTextHighlighter({
  code,
  theme,
}: StructuredTextHighlighterProps) {
  useEffect(() => {
    // Dynamically load theme stylesheet if not present
    if (!document.getElementById(theme)) {
      const link = document.createElement("link");
      link.id = theme;
      link.rel = "stylesheet";
      link.href = `https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/${theme}.min.css`;
      document.head.appendChild(link);
      return () => {
        link.parentNode?.removeChild(link);
      };
    }
    return undefined;
  }, [theme]);

  // We cannot use the DOMContentLoaded event here and need to run the
  // highlightCodeBlocks function manually after the component mounts
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.highlightCodeBlocks === "function"
    ) {
      window.highlightCodeBlocks();
    }
  }, [code]);

  return (
    <pre className="language-phioiecst">
      <code className="language-phioiecst">{code.replace(/</g, "&lt;")}</code>
    </pre>
  );
}
