import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareSitePage, sha256 } from '../scripts/sh3d-convert/site-page.mjs';

test('#937 deployment preserves the existing wrapper and exact accepted converter module', () => {
  const artifact = readFileSync(new URL('../scripts/sh3d-convert/dist/index.html', import.meta.url), 'utf8');
  const wrapper = '<!-- Google tag (gtag.js) -->\r\n<script src="https://www.googletagmanager.com/gtag/js?id=existing"></script>\r\n'
    + '<script src="https://mc.yandex.ru/metrika/tag.js?id=existing"></script>\r\n<!-- /Yandex.Metrika counter -->';
  const old = '<head>' + wrapper + '</head><body>old converter</body>';
  const result = prepareSitePage(old, artifact, 'a'.repeat(40));
  assert(result.page.includes(wrapper)); assert(!result.page.includes('old converter'));
  assert.equal(result.artifactSha256, sha256(artifact)); assert.equal(result.previousSha256, sha256(old));
  const module = text => /<script type="module">([\s\S]*?)<\/script>/.exec(text)[1];
  assert.equal(module(result.page), module(artifact));
  assert.throws(() => prepareSitePage('<head>changed layout</head>', artifact, 'a'.repeat(40)), /Unexpected site wrapper/);
  assert.throws(() => prepareSitePage(old + wrapper, artifact, 'a'.repeat(40)), /Unexpected site wrapper/);
  assert.throws(() => prepareSitePage(old, result.page, 'a'.repeat(40)), /standalone offline artifact/);
  assert.throws(() => prepareSitePage(old, artifact, 'HEAD'), /full accepted commit SHA/);
});
