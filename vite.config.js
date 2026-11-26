import { extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import { svgSpritemap } from 'vite-plugin-svg-spritemap';
import { checkLocalLinks } from './plugins/check-local-links.js';
import { catalogGroups } from './src/data/catalog-menu.js';
import { partnerSlides } from './src/data/partners.js';
import { promotionSlides } from './src/data/promotions.js';
import { headerDemoLinks } from './src/data/header-demo-links.js';
import { responsiveImages } from './plugins/responsive-images.js';
import { iconDirectory, iconSymbolId, keepSvgPaintInSprite, spriteFilename, svgSpriteImages } from './plugins/svg-sprite-images.js';

const commonScript = normalizePath(fileURLToPath(new URL('./src/main.js', import.meta.url)));

const assetDirectories = {
  css: /^css$/,
  js: /^(cjs|js|mjs)$/,
  images: /^(apng|avif|bmp|cur|gif|heic|heif|ico|jfif|jpe?g|jxl|pjp|pjpeg|png|tiff?|webp)$/,
  svg: /^svgz?$/,
  fonts: /^(eot|otf|ttc|ttf|woff2?)$/,
};

const templates = handlebars({
  context: { catalogGroups, headerDemoLinks, partnerSlides, promotionSlides },
  partialDirectory: fileURLToPath(new URL('./src/partials', import.meta.url)),
});
const reloadPartial = templates.handleHotUpdate;

// Handlebars stores native filesystem paths, while Vite sends paths with forward slashes.
templates.handleHotUpdate = function (update) {
  return reloadPartial.call(this, { ...update, file: normalize(update.file) });
};

export default defineConfig({
  build: {
    // Keep the browser targets used before the Vite 8 upgrade.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    cssMinify: true,
    rolldownOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        uiKit: fileURLToPath(new URL('./ui-kit.html', import.meta.url)),
      },
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        codeSplitting: {
          groups: [{
            name: 'common',
            // Keep Vite's module-preload polyfill in the shared script too.
            test: (id) => id === commonScript || id === '\0vite/modulepreload-polyfill.js',
          }],
        },
        assetFileNames({ names }) {
          const extension = extname(names[0] ?? '').slice(1).toLowerCase();
          const directory = Object.keys(assetDirectories).find((key) => assetDirectories[key].test(extension));
          return `assets/${directory ?? 'other'}/[name]-[hash][extname]`;
        },
      },
    },
  },
  plugins: [
    templates,
    responsiveImages({
      scales: [0.5, 1, 1.5, 2],
      formats: { avif: 55, webp: 80 },
    }),
    svgSpritemap({
      pattern: `${iconDirectory}/**/*.svg`,
      filename: spriteFilename,
      symbolId: iconSymbolId,
      svgo: { plugins: [keepSvgPaintInSprite, 'preset-default'] },
      hmr: false,
    }),
    svgSpriteImages(),
    checkLocalLinks(),
  ],
});
