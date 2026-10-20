import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  compressHTML: false,
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
});
