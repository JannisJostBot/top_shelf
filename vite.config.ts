import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The page stays hidden until the pixel fonts are in (main.js), so the browser should fetch them right away rather
// than only once it has parsed the stylesheet: preload the latin files, the ones every screen needs.
const preloadFonts = (): Plugin => ({
  name: 'preload-fonts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_html, ctx) =>
      Object.keys(ctx.bundle ?? {})
        .filter(f => /-latin-\d+-normal-[\w-]+\.woff2$/.test(f))
        .map(f => ({
          tag: 'link',
          attrs: { rel: 'preload', href: './' + f, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head' as const,
        })),
  },
});

export default defineConfig({
  base: './',
  plugins: [preloadFonts()],
  build: {
    // keep fonts as files: inlined into the stylesheet they would all be downloaded, even the subsets no page uses
    assetsInlineLimit: file => (/\.woff2?$/.test(file) ? false : undefined),
  },
  test: { include: ['tests/**/*.test.ts'] },
});
