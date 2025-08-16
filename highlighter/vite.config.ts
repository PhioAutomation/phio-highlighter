import { defineConfig } from 'vite'
import terser from '@rollup/plugin-terser'

const banner = `/*! 
 * IEC Structured Text Highlighter v1.0.0
 * Copyright (c) 2025 Andrew Parman
 * Released under the MIT License https://highlighter.phioautomation.com/LICENSE.txt
 */`

// We output both a minified / non-minifed version
export default defineConfig({
  build: {
    lib: {
      entry: 'src/iecst.js',
      name: 'IecstHighlighter',
    },
    rollupOptions: {
      output: [
        {
          dir: 'dist',
          entryFileNames: 'iecst.min.js',
          format: 'iife',
          name: 'IecstHighlighter',
          globals: {
            '@lezer/highlight': 'lezerHighlight',
          },
          banner: banner,
          plugins: [terser()],
        },
        {
          dir: 'dist',
          entryFileNames: 'iecst.js',
          format: 'iife',
          name: 'IecstHighlighter',
          globals: {
            '@lezer/highlight': 'lezerHighlight',
          },
          banner: banner,
        }
      ]
    },
    // prevent Vite from doing its own minification
    minify: false,
  },
})