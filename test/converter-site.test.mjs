import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareSitePage, sha256 } from '../scripts/sh3d-convert/site-page.mjs';
import { prepareConverterSite } from '../scripts/sh3d-convert/site-converter.mjs';

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

test('#1210 branded PHP publication keeps the shell and uses the exact canonical module', () => {
  const artifact = readFileSync(new URL('../scripts/sh3d-convert/dist/index.html', import.meta.url), 'utf8');
  const template = `<?php include __DIR__ . '/head.php'; ?>
<header>Existing brand and analytics</header><main>
<button data-format="easy"><strong>Easy Floorplan</strong><small>YAML / JSON</small></button>
<select id="format"><option value="easy">Easy Floorplan</option></select>
<label for="paste" data-i18n="easy.paste"></label><p data-i18n="easy.instructions"></p><textarea id="paste"></textarea>
</main><script type="module" src="/assets/js/converter.js?v=<?= time() ?>"></script>
<script type="module" src="/assets/js/converter-ui.js?v=old"></script>
<?php include __DIR__ . '/footer.php'; ?>`;
  const result = prepareConverterSite(template, artifact, 'a'.repeat(40));
  assert(result.page.startsWith(template.slice(0, template.indexOf('<main>'))));
  assert(result.page.endsWith("<?php include __DIR__ . '/footer.php'; ?>"));
  assert.equal(result.module, artifact.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  assert.match(result.page, /data-format="picture"/);
  assert.match(result.page, /value="picture"/);
  for (const id of ['paste-label', 'paste-instructions', 'picture-size', 'picture-image', 'picture-image-file', 'picture-width', 'picture-height', 'picture-size-status'])
    assert.equal(result.page.split(`id="${id}"`).length, 2, id);
  assert(result.page.includes(`/assets/js/${result.asset}`));
  assert(result.page.includes('converter-ui.js?v=old'));
  assert.throws(() => prepareConverterSite(result.page, artifact, 'a'.repeat(40)), /already exists/);
  assert.throws(() => prepareConverterSite(template.replace('id="paste"', 'id="other"'), artifact, 'a'.repeat(40)), /Unexpected site template/);
  assert.throws(() => prepareConverterSite(template, artifact, 'HEAD'), /immutable/);
});
