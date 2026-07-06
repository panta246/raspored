import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer (React) se gradi iz mape "renderer" u "dist-renderer".
// base:'./' je obavezno da bi se asseti učitali preko file:// u Electronu.
export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
  },
  server: { port: 5173, strictPort: true },
});
