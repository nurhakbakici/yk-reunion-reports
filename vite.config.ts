import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Relative base + single-file output: the same dist/index.html works on
// GitHub Pages (any repo path) and when double-clicked from disk on Windows.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
