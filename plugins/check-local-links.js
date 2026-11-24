import { readFile, readdir } from 'node:fs/promises';
import { join, posix, relative } from 'node:path';
import { parse as parseCss, walk as walkCss } from 'css-tree';
import { parse as parseHtml } from 'parse5';
import { normalizePath } from 'vite';

const urlAttributes = {
  a: ['href'], area: ['href'], audio: ['src'], embed: ['src'], iframe: ['src'],
  image: ['href'], img: ['src', 'srcset'], input: ['src'], link: ['href', 'imagesrcset'],
  object: ['data'], script: ['src'], source: ['src', 'srcset'], track: ['src'],
  use: ['href'], video: ['src', 'poster'],
};

export function checkLocalLinks() {
  let config;

  return {
    name: 'check-local-links',
    apply: 'build',
    enforce: 'post',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    generateBundle: {
      order: 'post',
      async handler(_, bundle) {
        const base = new URL(config.base, 'https://vite-build.invalid/');
        const files = new Map();
        if (config.build.copyPublicDir && config.publicDir) {
          const entries = await readdir(config.publicDir, { recursive: true, withFileTypes: true })
            .catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
          for (const entry of entries.filter((item) => item.isFile())) {
            const path = join(entry.parentPath, entry.name);
            files.set(normalizePath(relative(config.publicDir, path)), { path });
          }
        }
        for (const output of Object.values(bundle)) files.set(output.fileName, output);

        const documents = new Map();
        async function getDocument(fileName) {
          if (!documents.has(fileName)) {
            documents.set(fileName, inspectHtml(await getText(files.get(fileName))));
          }
          return documents.get(fileName);
        }

        const issues = new Set();
        for (const [fileName, file] of files) {
          if (!/\.(?:html?|css)$/i.test(fileName)) continue;
          const document = /\.css$/i.test(fileName) ? undefined : await getDocument(fileName);
          const fileUrl = new URL(fileName.split('/').map(encodeURIComponent).join('/'), base);
          const referenceBase = document?.baseHref && URL.canParse(document.baseHref, fileUrl)
            ? new URL(document.baseHref, fileUrl) : fileUrl;
          const references = document?.references ?? cssReferences(await getText(file));
          for (const reference of references) {
            const { value, context, line } = reference;
            const issue = await findIssue(reference, fileName, referenceBase, base, files, getDocument);
            if (issue) issues.add(`${fileName}:${line} (${context}) ${JSON.stringify(value)} — ${issue}`);
          }
        }
        if (issues.size) this.error(`Найдены битые локальные ссылки:\n${[...issues].join('\n')}`);
      },
    },
  };
}

function getText(file) {
  if (file.path) return readFile(file.path, 'utf8');
  return typeof file.source === 'string' ? file.source : Buffer.from(file.source).toString('utf8');
}

async function findIssue({ value, templateAnchors }, sourceFile, referenceBase, base, files, getDocument) {
  if (!value.trim()) return;
  let url;
  let target;
  let fragment;
  try {
    url = new URL(value, referenceBase);
    if (url.protocol !== base.protocol || url.origin !== base.origin) return;
    if (!url.pathname.startsWith(base.pathname)) return 'путь вне базового каталога сборки';
    target = decodeURIComponent(url.pathname.slice(base.pathname.length));
    fragment = decodeURIComponent(url.hash.slice(1).split(':~:', 1)[0]);
  } catch {
    return 'некорректный URL';
  }

  const fileName = files.has(target) ? target : posix.join(target, 'index.html');
  if (!files.has(fileName)) return 'файл отсутствует в сборке';
  if (!fragment || !/\.(?:html?|svg)$/i.test(fileName)) return;
  if (/\.svg$/i.test(fileName) ? fragment.startsWith('svgView(') : fragment.toLowerCase() === 'top') return;
  if (fileName === sourceFile && templateAnchors?.has(fragment)) return;
  if (!(await getDocument(fileName)).anchors.has(fragment)) return `якорь отсутствует в ${fileName}`;
}

function inspectHtml(source) {
  const anchors = new Set();
  const references = [];
  let baseHref;
  function visit(node, templateAnchors) {
    const { tagName, sourceCodeLocation: location } = node;
    const originHint = tagName === 'link' && node.attrs.some(({ name, value }) =>
      name === 'rel' && /(?:^|\s)(?:preconnect|dns-prefetch)(?:\s|$)/i.test(value));
    for (const { name, value } of node.attrs ?? []) {
      const line = location?.attrs?.[name]?.startLine ?? location?.startLine ?? 1;
      if (name === 'id' || (tagName === 'a' && name === 'name')) (templateAnchors ?? anchors).add(value);
      if (!templateAnchors && tagName === 'base' && name === 'href') baseHref ??= value;
      if (name === 'style') references.push(...cssReferences(value, 'declarationList', line));
      if (!Object.hasOwn(urlAttributes, tagName) || !urlAttributes[tagName].includes(name)) continue;
      if (originHint && name === 'href') continue;
      const urls = name.endsWith('srcset') ? srcsetUrls(value) : [value];
      for (const url of urls) references.push({ value: url, context: `<${tagName} ${name}>`, line, templateAnchors });
    }
    if (tagName === 'style') {
      references.push(...cssReferences(node.childNodes.map((child) => child.value).join(''), 'stylesheet', location?.startLine));
    }
    const childAnchors = node.content ? new Set() : templateAnchors;
    for (const child of (node.content ?? node).childNodes ?? []) visit(child, childAnchors);
  }
  visit(parseHtml(source, { sourceCodeLocationInfo: true }));
  return { baseHref, anchors, references };
}

function* srcsetUrls(srcset) {
  let rest = srcset;
  while ((rest = rest.replace(/^[\s,]+/, ''))) {
    const url = rest.match(/^\S+/)[0];
    yield url.replace(/,+$/, '');
    rest = rest.slice(url.length);
    if (!url.endsWith(',')) rest = rest.replace(/^[^,]*/, '');
  }
}

function cssReferences(source, context = 'stylesheet', startLine = 1) {
  const references = [];
  function add(node, context) {
    if (!node.value.trim().startsWith('#')) {
      references.push({ value: node.value, context, line: startLine + node.loc.start.line - 1 });
    }
  }
  const ast = parseCss(source, { context, positions: true, parseCustomProperty: true });
  walkCss(ast, function (node) {
    if (node.type === 'AtrulePrelude' && this.atrule?.name.toLowerCase() === 'supports') return this.skip;
    if (node.type === 'Url') add(node, 'url()');
    if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
      const target = node.prelude?.children?.first;
      if (target?.type === 'String') add(target, '@import');
    }
    if (node.type === 'Function' && /^(?:-webkit-)?image-set$/i.test(node.name)) {
      for (const value of node.children) if (value.type === 'String') add(value, 'image-set()');
    }
  });
  return references;
}
