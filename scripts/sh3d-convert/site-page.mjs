/** Local deployment preparation only: no SSH, network or server writes. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isMainModule } from '../spawn-portable.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
const WRAPPER = /<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- \/Yandex\.Metrika counter -->/g;
export function prepareSitePage(previous, artifact, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected the full accepted commit SHA');
  const wrappers = [...previous.matchAll(WRAPPER)];
  if (wrappers.length !== 1 || !wrappers[0][0].includes('googletagmanager.com/gtag/js')
      || !wrappers[0][0].includes('mc.yandex.ru/metrika/tag.js'))
    throw new Error('Unexpected site wrapper: inspect the live page, do not discard or guess it');
  if (artifact.includes('googletagmanager.com') || artifact.includes('mc.yandex.ru'))
    throw new Error('Expected the standalone offline artifact, not an already wrapped page');
  const marker = '<meta charset="UTF-8">';
  if (artifact.split(marker).length !== 2 || !artifact.includes('<select id="format"')
      || !artifact.includes('<script type="module">')) throw new Error('Unexpected offline converter artifact');
  const wrapper = wrappers[0][0];
  const page = artifact.replace(marker, () => marker + '\n' + wrapper
    + `\n<!-- converter-source ${commit}; artifact-sha256 ${sha256(artifact)} -->`);
  // No transformation of the accepted executable payload during deployment.
  const module = text => /<script type="module">([\s\S]*?)<\/script>/.exec(text)?.[1];
  if (!module(page) || module(page) !== module(artifact)) throw new Error('Deployment changed converter code');
  return { page, artifactSha256: sha256(artifact), pageSha256: sha256(page),
    previousSha256: sha256(previous), wrapperSha256: sha256(wrapper) };
}
if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: { previous: { type: 'string' }, artifact: { type: 'string' },
    out: { type: 'string' }, commit: { type: 'string' } } });
  if (!values.previous || !values.artifact || !values.out) throw new Error('Required: --previous --artifact --out --commit');
  const result = prepareSitePage(readFileSync(values.previous, 'utf8'), readFileSync(values.artifact, 'utf8'), values.commit);
  writeFileSync(values.out, result.page);
  const { page: _page, ...proof } = result;
  console.log(JSON.stringify(proof, null, 2));
}
