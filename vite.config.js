import { defineConfig } from 'vite';

export default defineConfig({
    // GitHub Pages のリポジトリ名に合わせて base を設定
    // https://<USERNAME>.github.io/<REPO>/ の形式になるため
    base: '/ggdemon/',
    build: {
        outDir: 'dist',
    },
});
