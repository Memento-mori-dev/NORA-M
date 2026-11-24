import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLocalLinks } from '../plugins/check-local-links.js';

function validate({ css = '', html = '', assets = {} }) {
  const plugin = checkLocalLinks();
  plugin.configResolved({ base: '/', build: { copyPublicDir: false } });

  const sources = { 'assets/css/style.css': css, 'index.html': html, ...assets };
  const bundle = Object.fromEntries(Object.entries(sources).map(([fileName, source]) =>
    [fileName, { type: 'asset', fileName, source }]));
  return plugin.generateBundle.handler.call({
    error(message) { throw new Error(message); },
  }, {}, bundle);
}

test('rejects missing URLs declared in CSS custom properties', async () => {
  await assert.rejects(validate({
    css: ':root { --hero: url("/assets/images/missing.png"); } .hero { background: var(--hero); }',
  }), /assets\/css\/style\.css:1.*missing\.png/);
});

test('rejects missing custom property URLs in an inline style', async () => {
  await assert.rejects(validate({
    html: '<div style="--hero: var(--custom, url(/assets/images/missing.png))"></div>',
  }), /index\.html:1.*missing\.png/);
});

test('accepts a CSS custom property URL pointing to an emitted file', async () => {
  await validate({
    css: ':root { --hero: url("../images/background.webp"); } .hero { background: var(--hero); }',
    assets: { 'assets/images/background.webp': '' },
  });
});

test('validates URLs in the body of @supports and skips its condition', async () => {
  await assert.rejects(validate({
    css: '@supports (background: url("/probe.png")) { .hero { --hero: url("/missing.png"); } }',
  }), (error) => error.message.includes('/missing.png') && !error.message.includes('/probe.png'));
});
