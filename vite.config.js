import { defineConfig } from 'vite';

// Relative base so the build works at any GitHub Pages path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  worker: { format: 'es' },
});
