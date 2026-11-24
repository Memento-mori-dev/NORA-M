import { readFile } from 'node:fs/promises';
import { dirname, posix, relative, resolve } from 'node:path';
import { generate as generateCss, parse as parseCss } from 'css-tree';
import { defaultTreeAdapter, parse, parseFragment, serializeOuter } from 'parse5';
import { normalizePath } from 'vite';

export const iconDirectory = 'src/icons';
export const spriteFilename = 'assets/svg/icons-[hash].svg';

const buildReference = '#__layout_svg_sprite__';
const imageAttributes = new Set(['class', 'height', 'id', 'role', 'style', 'tabindex', 'title', 'width']);
const svgAttributes = new Set([
  'viewBox', 'preserveAspectRatio', 'width', 'height', 'color', 'fill', 'fill-opacity',
  'fill-rule', 'opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'style',
]);
const paintAttributes = new Set(['fill', 'stroke', 'clip-path', 'filter', 'mask', 'marker-start', 'marker-mid', 'marker-end']);
const definitions = new Set(['defs', 'desc', 'metadata', 'style', 'title']);
const localPaintUrl = /\burl\(\s*['"]?#/i;

export const keepSvgPaintInSprite = {
  name: 'keep-svg-paint-in-sprite',
  fn(root) {
    const svg = root.children.find((node) => node.type === 'element' && node.name === 'svg');
    if (!svg) return;

    const { wrapper, group } = splitRootPaint(svg.attributes);
    if (!group) return;

    // The spritemap keeps the SVG children and namespaces the IDs they reference.
    const children = [];
    svg.attributes = wrapper;
    svg.children = svg.children.filter((node) => {
      if (node.type !== 'element' || definitions.has(node.name)) return true;
      children.push(node);
      return false;
    });
    svg.children.push({ type: 'element', name: 'g', attributes: group, children });
  },
};

function splitRootPaint(attributes) {
  const moved = new Set([...paintAttributes].filter((name) => localPaintUrl.test(attributes[name] ?? '')));
  const style = attributes.style ?? '';
  if (!moved.size && !localPaintUrl.test(style)) return { wrapper: attributes };

  const declarations = [...parseCss(style, { context: 'declarationList' }).children];
  for (const declaration of declarations) {
    const property = declaration.property?.toLowerCase();
    if (paintAttributes.has(property) && localPaintUrl.test(generateCss(declaration.value))) moved.add(property);
  }
  if (!moved.size) return { wrapper: attributes };

  const wrapper = { ...attributes };
  const group = {};
  for (const name of moved) {
    if (!Object.hasOwn(attributes, name)) continue;
    group[name] = generateCss(parseCss(attributes[name], { context: 'value' }));
    delete wrapper[name];
  }

  // Move all declarations for each selected property to preserve their precedence.
  const wrapperStyle = [];
  const groupStyle = [];
  for (const declaration of declarations) {
    const target = moved.has(declaration.property?.toLowerCase()) ? groupStyle : wrapperStyle;
    target.push(generateCss(declaration));
  }
  if (groupStyle.length) group.style = groupStyle.join(';');
  if (wrapperStyle.length) wrapper.style = wrapperStyle.join(';');
  else delete wrapper.style;

  return { wrapper, group };
}

export function iconSymbolId(file) {
  const name = normalizePath(file).slice(iconDirectory.length + 1, -'.svg'.length);
  return `icon-${name.replace(/[^A-Za-z0-9]/gu, (char) => `_${char.codePointAt(0).toString(16)}_`)}`;
}

export function svgSpriteImages() {
  let config;

  return {
    name: 'svg-sprite-images',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, { filename, server }) {
        const images = collectImages(parse(html, { sourceCodeLocationInfo: true }));
        const icons = new Map();
        const sprite = server ? `/${spriteFilename.replace('[hash]', 'dev')}#` : buildReference;

        images.sort((a, b) => b.sourceCodeLocation.startOffset - a.sourceCodeLocation.startOffset);
        for (const image of images) {
          const src = image.attrs.find(({ name }) => name === 'src')?.value;
          const file = iconPath(src, filename, config.root);
          if (!file) continue;

          if (!icons.has(file)) {
            const { childNodes } = parseFragment(await readFile(resolve(config.root, file), 'utf8'));
            icons.set(file, childNodes.find((node) => node.tagName === 'svg'));
          }
          const icon = icons.get(file);
          if (!icon) continue;

          const { startOffset, endOffset } = image.sourceCodeLocation;
          const replacement = renderIcon(image, icon, sprite + iconSymbolId(file));
          html = html.slice(0, startOffset) + replacement + html.slice(endOffset);
        }
        return html;
      },
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        // Vite writes HTML before this hook, and the spritemap asset now has its content hash.
        const sprite = Object.keys(bundle).find((file) =>
          file.replace(/-[a-f0-9]{8}\.svg$/, '-[hash].svg') === spriteFilename);
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.html') ||
              typeof asset.source !== 'string' || !asset.source.includes(buildReference)) continue;

          if (!sprite) this.error('The SVG spritemap was not emitted.');
          const href = config.base === './' || config.base === ''
            ? posix.relative(posix.dirname(asset.fileName), sprite)
            : config.base + sprite;
          asset.source = asset.source.replaceAll(`href="${buildReference}`, `href="${href}#`);
        }
      },
    },
  };
}

function collectImages(node, images = []) {
  if (node.tagName === 'picture') return images;
  if (node.tagName === 'img' && !node.attrs.some(({ name }) => name === 'usemap' || name === 'srcset')) {
    images.push(node);
  }
  for (const child of (node.content ?? node).childNodes ?? []) {
    collectImages(child, images);
  }
  return images;
}

function iconPath(src, htmlFile, root) {
  if (!src?.endsWith('.svg') || /^(?:[a-z][\w+.-]*:|\/\/)|[?#\\]/i.test(src)) return;

  const pathname = decodeURIComponent(src);
  const absolute = pathname.startsWith('/') ? resolve(root, `.${pathname}`) : resolve(dirname(htmlFile), pathname);
  const file = normalizePath(relative(root, absolute));
  if (file.startsWith(`${iconDirectory}/`)) return file;
}

function renderIcon(image, icon, href) {
  const sourceAttrs = Object.fromEntries(icon.attrs.map(({ name, value }) => [name, value]));
  const { wrapper, group } = splitRootPaint(sourceAttrs);
  const attrs = new Map(Object.entries(wrapper).filter(([name]) => svgAttributes.has(name)));
  for (const { name, value } of image.attrs) {
    if (imageAttributes.has(name) || name.startsWith('aria-') || name.startsWith('data-')) {
      attrs.set(name, group && name === 'style' && attrs.has(name) ? `${attrs.get(name)};${value}` : value);
    }
  }

  const alt = image.attrs.find(({ name }) => name === 'alt')?.value;
  const hasLabel = attrs.has('aria-label') || attrs.has('aria-labelledby');
  if (alt) {
    if (!attrs.has('role')) attrs.set('role', 'img');
    if (!hasLabel) attrs.set('aria-label', alt);
  } else if (alt === '' && !hasLabel && !attrs.has('aria-hidden') && !attrs.has('role')) {
    attrs.set('aria-hidden', 'true');
  }

  const svg = defaultTreeAdapter.createElement('svg', icon.namespaceURI,
    [...attrs].map(([name, value]) => ({ name, value })));
  const use = defaultTreeAdapter.createElement('use', icon.namespaceURI, [{ name: 'href', value: href }]);
  defaultTreeAdapter.appendChild(svg, use);
  return serializeOuter(svg);
}
