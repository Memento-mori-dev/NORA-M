import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { build, normalizePath } from 'vite';
import viteConfig from '../vite.config.js';
import { checkLocalLinks } from '../plugins/check-local-links.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const slot = '<!-- CMS_BLOCKS -->';
const base = process.env.CMS_BASE || '/';

if (!/^\/(?:[\w.-]+\/)*$/.test(base) || base.split('/').some((part) => part === '.' || part === '..')) {
  throw new Error('CMS_BASE должен быть абсолютным путём с завершающим слешем, например /nora/.');
}

const entries = {
  index: { folder: 'index', file: 'index', script: '/src/main.js' },
  hero: { script: '/src/script/hero.js' },
  'popular-categories': { script: '/src/script/popular-categories.js', wrapper: 'container' },
  recommendations: { script: '/src/script/recommendations.js', wrapper: 'container' },
  promotions: { script: '/src/script/promotions.js', wrapper: 'container' },
  'brand-lines': { script: '/src/script/brand-lines.js' },
  partners: { script: '/src/script/partners.js' },
  'company-reviews': { script: '/src/script/company-reviews.js', wrapper: 'container' },
  'contact-banner': { wrapper: 'container' },
  'useful-materials': { script: '/src/script/useful-materials.js', wrapper: 'container' },
  'company-news': { wrapper: 'container' },
  'wholesale-banner': { wrapper: 'wholesale-section' },
  'about-company': { script: '/src/script/about-company.js', wrapper: 'container' },
};

function entryPath(name, extension) {
  const { folder = `blocks/${name}`, file = 'block' } = entries[name];
  return `${folder}/${file}.${extension}`;
}

function createBlock(name, { script, wrapper }, css) {
  const partial = `{{> ${name} }}`;
  const content = wrapper ? `<div class="${wrapper}">\n${partial}\n</div>` : partial;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="${css}">
  ${script ? `<script type="module" src="${script}"></script>` : ''}
</head>
<body>
${content}
</body>
</html>`;
}

function packageCms(input) {
  return {
    name: 'package-cms',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const manifest = { base, slot, index: null, blocks: {} };

        for (const [name, path] of Object.entries(input)) {
          const original = normalizePath(relative(root, path));
          const asset = bundle[original];
          if (asset?.type !== 'asset') this.error(`CMS: отсутствует собранный HTML для ${name}`);

          const html = String(asset.source);
          const document = parse(html, { sourceCodeLocationInfo: true });
          const { childNodes } = document.childNodes.find((node) => node.tagName === 'html');
          const head = childNodes.find((node) => node.tagName === 'head');
          const body = childNodes.find((node) => node.tagName === 'body');
          const css = [];
          const js = [];
          for (const node of head.childNodes) {
            const attribute = (key) => node.attrs?.find(({ name }) => name === key)?.value;
            if (node.tagName === 'link' && attribute('rel') === 'stylesheet') css.push(attribute('href'));
            if (node.tagName === 'script' && attribute('type') === 'module') js.push(attribute('src'));
          }

          const fileName = entryPath(name, 'html');
          const files = { html: fileName, css, js };
          if (!css.includes(base + entryPath(name, 'css')) ||
              (entries[name].script && !js.includes(base + entryPath(name, 'js'))) ||
              [...css, ...js].some((url) => !url.startsWith(base) || !bundle[url.slice(base.length)])) {
            this.error(`CMS: отсутствуют CSS или JS для ${name} (${[...css, ...js].join(', ')})`);
          }

          let source = html;
          if (name === 'index') {
            manifest.index = files;
          } else {
            const { startTag, endTag } = body.sourceCodeLocation;
            source = html.slice(startTag.endOffset, endTag.startOffset).trim() + '\n';
            manifest.blocks[name] = files;
          }

          delete bundle[original];
          this.emitFile({ type: 'asset', fileName, source });
        }

        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(manifest, null, 2) + '\n',
        });
      },
    },
  };
}

const temporary = await mkdtemp(join(root, '.cms-'));
const generated = [];
async function createFile(name, content) {
  const path = join(temporary, name);
  generated.push(path);
  await writeFile(path, content);
  return path;
}

try {
  const home = await readFile(join(root, 'index.html'), 'utf8');
  const input = {};
  for (const [name, entry] of Object.entries(entries)) {
    const style = name === 'index' ? 'site-base' : `blocks/${name}`;
    const css = `./${name}.scss`;
    await createFile(`${name}.scss`, `@use '../src/styles/${style}';\n`);

    const html = name === 'index'
      ? home.replace(/<main>[\s\S]*?<\/main>/, `<main>\n      ${slot}\n    </main>`)
        .replace('./src/styles/main.scss', css)
        .replace('/src/pages/index.js', entry.script)
      : createBlock(name, entry, css);
    if (name === 'index' && !html.includes(slot)) throw new Error('CMS: отсутствует область вставки блоков.');
    input[name] = await createFile(`${name}.html`, html);
  }

  const { build: buildConfig, plugins } = viteConfig;
  const { output } = buildConfig.rolldownOptions;
  await build({
    ...viteConfig,
    configFile: false,
    root,
    base,
    build: {
      ...buildConfig,
      outDir: 'dist-cms',
      modulePreload: { polyfill: false },
      rolldownOptions: {
        ...buildConfig.rolldownOptions,
        input,
        output: {
          ...output,
          codeSplitting: true,
          entryFileNames: ({ name }) => entryPath(name, 'js'),
          assetFileNames(asset) {
            const name = basename(asset.names[0] ?? '', '.css');
            if (Object.hasOwn(entries, name) && asset.names[0].endsWith('.css')) {
              return entryPath(name, 'css');
            }
            return output.assetFileNames(asset);
          },
        },
      },
    },
    plugins: [
      ...plugins.filter(({ name }) => name !== 'check-local-links'),
      packageCms(input),
      checkLocalLinks(),
    ],
  });
} finally {
  for (const path of generated) await unlink(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await rmdir(temporary);
}
