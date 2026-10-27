import { defineConfig } from 'vite';
// @ts-expect-error Build plugin is shared with the JavaScript development runner.
import { localWorklets } from './scripts/worklets.mjs';
export default defineConfig({
  plugins: [localWorklets()],
  optimizeDeps: { exclude: ['superdough', 'supradough'] },
  base: './',
  build: { outDir: 'dist/renderer', target: 'chrome134', sourcemap: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
