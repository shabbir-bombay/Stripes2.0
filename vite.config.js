import { defineConfig } from 'vite';

// Relative base so the build works at any GitHub Pages path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  // data/routes.json and data/gates.csv are served next to the page, so the studios can load them.
  publicDir: 'data',
  worker: { format: 'es' },
});
