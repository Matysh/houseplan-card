/** Prepare the current PHP site's converter without replacing its shell/content. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { isMainModule } from '../spawn-portable.mjs';
export const digest = text => createHash('sha256').update(text).digest('hex');
const once = (source, pattern, replacement) => {
  if ([...source.matchAll(new RegExp(pattern.source, 'g'))].length !== 1) throw Error(`Unexpected site template: ${pattern.source}`);
  return source.replace(pattern, replacement);
};
export function prepareConverterSite(template, artifact, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Expected immutable accepted source');
  if (/data-format="picture"/.test(template)) throw Error('Picture already exists: inspect the current site');
  const module = artifact.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  if (!module || !module.includes('HOUSEPLAN_CONVERTER_COPY')) throw Error('Expected current canonical converter module');
  const asset = `converter-${digest(module).slice(0, 16)}.js`;
  let page = once(template, /<button\b[^>]*data-format="easy"[\s\S]*?<\/button>/, button => button
    + '\n' + button.replace('data-format="easy"', 'data-format="picture"').replace('Easy Floorplan', 'picture-elements'));
  page = once(page, /<option value="easy">[^<]*<\/option>/, option => option + '\n<option value="picture">picture-elements (YAML / JSON)</option>');
  page = once(page, /<label for="paste"/, '<label id="paste-label" for="paste"');
  page = once(page, /<p data-i18n="easy.instructions"/, '<p id="paste-instructions" data-i18n="easy.instructions"');
  page = once(page, /<textarea id="paste"/, `<section id="picture-size" class="converter-picture" hidden>
    <p data-i18n="picture.size.why"></p>
    <div class="converter-size-row">
      <button id="picture-image" type="button" class="btn btn-outline" data-i18n="picture.size.image"></button>
      <input id="picture-image-file" type="file" accept="image/*" hidden>
      <label><span data-i18n="picture.size.width"></span><input id="picture-width" class="converter-input" type="number" min="1" max="100000" step="1"></label>
      <label><span data-i18n="picture.size.height"></span><input id="picture-height" class="converter-input" type="number" min="1" max="100000" step="1"></label>
    </div><p id="picture-size-status" role="status"></p>
  </section><textarea id="paste"`);
  page = once(page, /<script type="module" src="\/assets\/js\/converter\.js[^\n]*<\/script>/,
    `<script type="module" src="/assets/js/${asset}"></script>`);
  page = once(page, /<\/main>/, `</main>
<style>
.converter-formats{grid-template-columns:repeat(3,minmax(0,1fr))}
.converter-picture{margin-bottom:16px}.converter-size-row{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
.converter-size-row label{min-width:0;flex:1 1 100px}.converter-size-row .converter-input{width:100%;box-sizing:border-box;min-height:44px;height:44px;flex:none;resize:none;padding:8px 12px;margin:6px 0;font:inherit}
@media(max-width:639px){.converter-formats{grid-template-columns:1fr}}
</style><!-- converter-source ${commit}; module-sha256 ${digest(module)} -->`);
  return { page, module, asset, receipt: { source: commit, previousSha256: digest(template),
    templateSha256: digest(page), moduleSha256: digest(module), asset: `assets/js/${asset}` } };
}
if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: { template: { type: 'string' }, artifact: { type: 'string' },
    commit: { type: 'string' }, out: { type: 'string' } } });
  if (!values.template || !values.artifact || !values.out) throw Error('Required: --template --artifact --commit --out');
  const result = prepareConverterSite(readFileSync(values.template, 'utf8'), readFileSync(values.artifact, 'utf8'), values.commit);
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'converter.php'), result.page);
  writeFileSync(join(values.out, result.asset), result.module);
  writeFileSync(join(values.out, 'receipt.json'), JSON.stringify(result.receipt, null, 2) + '\n');
  console.log(JSON.stringify(result.receipt, null, 2));
}
