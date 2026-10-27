/** Build the Anna iframe without affecting the standalone Vite build. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'anna'),
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: path.resolve(__dirname, '../integrations/anna/bundle'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
