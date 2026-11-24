import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { build, createServer, preview } from 'vite';
import config from '../vite.config.js';

const size = 100;
const gap = 105;
const spriteOffset = 130;
const host = '127.0.0.1';
const exec = promisify(execFile);
const box = '<path d="M0 0h100v100H0z"/>';
const svg = (attrs, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${attrs}><defs>${defs}</defs>${box}</svg>`;
const gradient = (start, end) => `<linearGradient id="paint"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`;
const half = '<path fill="white" d="M0 0h50v100H0z"/>';
const samples = {
  'gradient': svg('fill="url(#paint)"', gradient('#f43f5e', '#6040ff')),
  'inline-style': svg("fill='none' style='fill: url(&quot;#paint&quot;); opacity: .85'", gradient('#19bc68', '#fdb05e')),
  'style-override': svg('fill="url(#paint)" style="fill: #b92151"', gradient('#f43f5e', '#6040ff')),
  'mask': svg('fill="#0e7bb9" mask="url(#paint)"', `<mask id="paint" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">${half}</mask>`),
  'clip-path': svg('fill="#157538" clip-path="url(#paint)"', `<clipPath id="paint">${half}</clipPath>`),
  'filter': svg('filter="url(#paint)"', '<filter id="paint"><feFlood flood-color="#c84a12"/></filter>'),
  'current-color': svg('fill="currentColor"'),
};

if (process.argv.includes('--help')) {
  console.log('npm run check:svg — проверить SVG-спрайт в dev и production. Можно задать путь к браузеру через CHROME_BIN.');
} else {
  await checkSprite();
}

async function checkSprite() {
  const chrome = findChrome();
  const temp = await realpath(tmpdir());
  const workspace = await mkdtemp(join(temp, 'vite-svg-check-'));
  // Vite must not watch files that Chrome locks while running on Windows.
  const root = join(workspace, 'project');
  try {
    await writeFixtures(root);
    const options = {
      ...config, configFile: false, root, base: '/', publicDir: 'public', logLevel: 'warn',
      build: {
        ...config.build,
        outDir: join(root, 'dist'),
        rolldownOptions: { ...config.build.rolldownOptions, input: join(root, 'index.html') },
      },
    };
    await build(options);
    const production = await preview({ ...options, preview: { host, port: 0, open: false } });
    try {
      await inspect(chrome, workspace, production.httpServer.address().port, 'production');
    } finally {
      await new Promise((done) => production.httpServer.close(done));
    }

    const dev = await createServer({ ...options, mode: 'development', server: { host, port: 0, open: false } });
    try {
      await dev.listen();
      await inspect(chrome, workspace, dev.httpServer.address().port, 'dev');
    } finally {
      await dev.close();
    }
    console.log('SVG-спрайт прошёл проверку в dev и production.');
  } finally {
    const actual = await realpath(workspace);
    assert(dirname(actual) === temp && basename(actual).startsWith('vite-svg-check-'));
    await rm(actual, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
}

function findChrome() {
  const windowsPaths = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map((prefix) => join(prefix, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  const candidates = process.env.CHROME_BIN ? [process.env.CHROME_BIN] : [
    ...windowsPaths, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  const binary = candidates.find(existsSync);
  if (!binary) throw new Error('Chrome или Chromium не найден. Укажи путь к исполняемому файлу через CHROME_BIN.');
  return binary;
}

async function writeFixtures(root) {
  const icons = join(root, 'src/icons');
  const originals = join(root, 'public/assets/svg');
  await Promise.all([mkdir(icons, { recursive: true }), mkdir(originals, { recursive: true })]);
  const rows = [];
  for (const [index, [name, content]] of Object.entries(samples).entries()) {
    await Promise.all([writeFile(join(icons, name + '.svg'), content), writeFile(join(originals, name + '.svg'), content)]);
    rows.push(`<img src="/assets/svg/${name}.svg" width="${size}" height="${size}" style="left:0;top:${index * gap}px" alt="">
      <img src="/src/icons/${name}.svg" width="${size}" height="${size}" style="left:${spriteOffset}px;top:${index * gap}px" class="${name}" alt="">`);
  }
  await writeFile(join(root, 'index.html'), `<!doctype html><html><head>
    <style>body{margin:0;background:#fff}img,svg{position:absolute}.current-color{color:#d72438}</style>
    </head><body>${rows.join('')}</body></html>`);
}

async function inspect(chrome, workspace, port, mode) {
  const origin = `http://${host}:${port}`;
  const response = await fetch(origin);
  assert(response.ok, `${mode}: тестовая страница вернула HTTP ${response.status}`);
  const html = await response.text();
  const links = [...html.matchAll(/<use\b[^>]*\shref="([^"]+)"/g)].map((match) => new URL(match[1], origin));
  assert.equal(links.length, Object.keys(samples).length, `${mode}: количество ссылок на символы`);
  const sprite = new URL(links[0]);
  sprite.hash = '';
  assert.equal(sprite.origin, origin);
  assert.match(sprite.pathname, mode === 'dev' ? /\/icons-dev\.svg$/ : /\/icons-[a-f0-9]{8}\.svg$/);
  const spriteResponse = await fetch(sprite);
  assert(spriteResponse.ok && spriteResponse.headers.get('content-type')?.includes('image/svg+xml'), `${mode}: спрайт не загрузился`);
  const spriteText = await spriteResponse.text();
  const symbolIds = new Set([...spriteText.matchAll(/<symbol\b[^>]*\sid="([^"]+)"/g)].map((match) => '#' + match[1]));
  for (const link of links) {
    assert.equal(link.pathname, sprite.pathname, `${mode}: путь к общему спрайту`);
    assert(symbolIds.has(link.hash), `${mode}: в спрайте отсутствует ${link.hash}`);
  }

  const screenshot = join(workspace, mode + '.png');
  await exec(chrome, [
    '--headless', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--user-data-dir=' + join(workspace, 'chrome-' + mode), '--window-size=600,850',
    '--virtual-time-budget=3000', '--screenshot=' + screenshot, origin,
  ], { timeout: 20000, windowsHide: true });
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  function pixel(x, y) {
    assert(x < info.width && y < info.height, 'Снимок Chrome меньше тестовой области');
    const start = (y * info.width + x) * info.channels;
    return [...data.subarray(start, start + 3)];
  }

  for (const [index, name] of Object.keys(samples).entries()) {
    for (const x of [15, 82]) {
      const y = index * gap + 50;
      const expected = name === 'current-color' ? [215, 36, 56] : pixel(x, y);
      const actual = pixel(x + spriteOffset, y);
      if (x === 15) assert(expected.some((channel) => channel < 250), `${mode}, ${name}: исходный SVG пуст`);
      assert(expected.every((channel, i) => Math.abs(channel - actual[i]) < 4),
        `${mode}, ${name}: ожидалось RGB(${expected}), получено RGB(${actual})`);
    }
  }
  console.log(`${mode}: проверено ${links.length} SVG-иконок`);
}
