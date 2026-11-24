import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { generate as generateCss, parse as parseCss, walk as walkCss } from 'css-tree';
import { defaultTreeAdapter, parse, serializeOuter } from 'parse5';
import sharp from 'sharp';
import { normalizePath } from 'vite';

const cacheDirectory = 'node_modules/.cache/responsive-images';
const cssWebpPlugin = 'css-webp-images';

export function responsiveImages({ scales, formats }) {
  let config;
  const watchedImages = new Set();

  return {
    name: 'responsive-images',
    config() {
      const plugin = {
        postcssPlugin: cssWebpPlugin,
        async Once(root, { result }) {
          const declarations = [];
          root.walkDecls((declaration) => {
            if (declaration.value.includes('?webp')) declarations.push(declaration);
          });
          for (const declaration of declarations) {
            await convertCssWebp(declaration, result, config, formats.webp);
          }
        },
      };
      return { css: { postcss: { plugins: [plugin] } } };
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, { filename, server }) {
        const images = collectImages(parse(html, { sourceCodeLocationInfo: true }));

        for (const img of images.sort((a, b) => b.sourceCodeLocation.startOffset - a.sourceCodeLocation.startOffset)) {
          const { startOffset, endOffset, startLine } = img.sourceCodeLocation;
          const attrs = Object.fromEntries(img.attrs.map(({ name, value }) => [name, value]));

          try {
            const width = Number(attrs.width);
            if (!Number.isSafeInteger(width) || width < 1) {
              throw new Error('Set width to a positive integer in pixels.');
            }

            const file = await resolveImage(attrs.src, filename, config);
            const { image, metadata, hash } = await loadImage(file);

            const sourceWidth = metadata.autoOrient.width;
            const widths = [...new Set(scales.map((scale) => Math.max(1, Math.round(width * scale))))]
              .filter((candidate) => candidate <= sourceWidth)
              .sort((a, b) => a - b);
            if (widths.length === 0) widths.push(sourceWidth);

            const outputDirectory = join(config.root, cacheDirectory);
            await mkdir(outputDirectory, { recursive: true });
            const sizes = attrs.sizes || `(max-width: ${width}px) 100vw, ${width}px`;
            const picture = defaultTreeAdapter.createElement('picture', img.namespaceURI, []);

            for (const [format, quality] of Object.entries(formats)) {
              const variants = await Promise.all(widths.map(async (candidate) => {
                const name = `${hash}-${candidate}w-q${quality}.${format}`;
                await writeVariant(image, join(outputDirectory, name), candidate, format, quality);
                return `/${cacheDirectory}/${name}?no-inline ${candidate}w`;
              }));

              const source = defaultTreeAdapter.createElement('source', img.namespaceURI, [
                { name: 'type', value: `image/${format}` },
                { name: 'srcset', value: variants.join(', ') },
                { name: 'sizes', value: sizes },
              ]);
              defaultTreeAdapter.appendChild(picture, source);
            }

            img.attrs = img.attrs.filter(({ name }) =>
              name !== 'data-responsive' && (name !== 'sizes' || attrs.srcset),
            );
            defaultTreeAdapter.detachNode(img);
            defaultTreeAdapter.appendChild(picture, img);
            html = html.slice(0, startOffset) + serializeOuter(picture) + html.slice(endOffset);

            if (server) {
              watchedImages.add(normalizePath(file));
              server.watcher.add(file);
            }
          } catch (error) {
            throw new Error(`${filename}:${startLine} <img data-responsive src="${attrs.src ?? ''}">: ${error.message}`, {
              cause: error,
            });
          }
        }

        return html;
      },
    },
    handleHotUpdate({ file, server }) {
      if (watchedImages.has(normalizePath(file))) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

async function convertCssWebp(declaration, result, config, quality) {
  const value = parseCss(declaration.value, { context: 'value' });
  const images = [];
  walkCss(value, {
    visit: 'Url',
    enter(node) {
      if (node.value.endsWith('?webp') && !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(node.value)) images.push(node);
    },
  });
  if (!images.length) return;

  const outputDirectory = join(config.root, cacheDirectory);
  await mkdir(outputDirectory, { recursive: true });
  const importer = declaration.source?.input.file ?? result.opts.from;
  for (const node of images) {
    try {
      const file = await resolveImage(node.value, importer, config);
      const { image, hash } = await loadImage(file);
      const name = `${hash}-original-q${quality}.webp`;
      await writeVariant(image, join(outputDirectory, name), undefined, 'webp', quality);
      result.messages.push({ type: 'dependency', plugin: cssWebpPlugin, file, parent: importer });
      node.value = `/${cacheDirectory}/${name}?no-inline`;
    } catch (error) {
      throw declaration.error(`${node.value}: ${error.message}`, { plugin: cssWebpPlugin });
    }
  }
  declaration.value = generateCss(value);
}

async function loadImage(file) {
  const input = await readFile(file);
  const image = sharp(input);
  const metadata = await image.metadata();
  if (metadata.format !== 'jpeg' && metadata.format !== 'png') {
    throw new Error('Expected a JPEG or PNG image.');
  }
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 20);
  return { image, metadata, hash };
}

function collectImages(node, images = []) {
  if (node.tagName === 'picture') return images;
  if (node.tagName === 'img' && node.attrs.some(({ name }) => name === 'data-responsive')) {
    images.push(node);
  }
  for (const child of (node.content ?? node).childNodes ?? []) {
    collectImages(child, images);
  }
  return images;
}

async function resolveImage(src, importer, { root, publicDir }) {
  const pathname = decodeURIComponent(src?.split(/[?#]/, 1)[0] ?? '');
  if (!/\.(?:jpe?g|png)$/i.test(pathname) || /^(?:[a-z][\w+.-]*:|\/\/)|\\/i.test(pathname)) {
    throw new Error('Use a local PNG or JPEG file in src.');
  }

  const candidates = pathname.startsWith('/')
    ? [publicDir, root].filter(Boolean).map((directory) => [directory, resolve(directory, `.${pathname}`)])
    : [[root, resolve(dirname(importer), pathname)]];

  for (const [directory, candidate] of candidates) {
    if (!isInside(directory, candidate)) continue;
    try {
      const file = await realpath(candidate);
      if (isInside(await realpath(directory), file)) return file;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  throw new Error('Image file not found in the project.');
}

function isInside(directory, file) {
  const path = relative(directory, file);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

async function writeVariant(image, file, width, format, quality) {
  if (existsSync(file)) return;

  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const variant = image.clone().autoOrient();
    if (width !== undefined) variant.resize({ width, withoutEnlargement: true });
    await variant.toFormat(format, { quality }).toFile(temporary);
    try {
      await rename(temporary, file);
    } catch (error) {
      if (!existsSync(file)) throw error;
    }
  } finally {
    await rm(temporary, { force: true });
  }
}
