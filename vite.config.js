import { defineConfig } from 'vite';

export default defineConfig({
    // Cloudflare Pages や GitHub Pages の両方で動作しやすいように相対パスに設定
    base: './',
    build: {
        outDir: 'dist',
    },
});
