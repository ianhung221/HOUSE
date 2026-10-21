import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/HOUSE/' : '/',
  publicDir: mode === 'pages' ? false : 'public',
  resolve: { alias: mode === 'pages' ? [{ find: /^(?:\.\.\/|\.\/)+(?:config\/)?identity$/, replacement: decodeURIComponent(new URL('./src/config/publicIdentity.ts', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1') }] : [] },
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, watch: { ignored: ['**/verification/**', '**/backups/**', '**/release/**', '**/dist-pages/**', '**/dist-hosted/**'] } },
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist', sourcemap: false, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
}));
