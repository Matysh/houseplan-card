/** Extract/copy agent-authored stable prose; never generate or summarize it. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NARRATIVE_MARKER, stableHeading } from './release-narrative.mjs';

export const USER_STABLE_PATHS = {
  ru: 'docs/changelog_user_stable_ru.md',
  en: 'docs/changelog_user_stable_en.md',
};

export function userStableSection(changelog, { tag, language, baseStable } = {}) {
  const heading = stableHeading(tag, language);
  const lines = changelog.split(/\r?\n/);
  const markers = [];
  let fenced = false;
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*```/.test(lines[index])) { fenced = !fenced; continue; }
    const match = !fenced && /^<!-- release: (v\d+\.\d+\.\d+) -->$/.exec(lines[index]);
    if (match) markers.push({ tag: match[1], index });
  }
  const matches = markers.filter((marker) => marker.tag === tag);
  if (matches.length !== 1) throw new Error(`${language}: user stable changelog needs exactly one ${tag} section`);
  const start = matches[0].index;
  const end = markers.find((marker) => marker.index > start)?.index;
  const section = lines.slice(start + 1, end).join('\n').trim();
  const base = /^<!-- base: (v\d+\.\d+\.\d+) -->\n/.exec(section);
  if (!base || (baseStable && base[1] !== baseStable))
    throw new Error(`${language}: user stable changelog has no matching previous stable marker`);
  const body = section.slice(base[0].length).trim();
  if (!body.startsWith(`${heading}\n\n`) || body.includes('<!--'))
    throw new Error(`${language}: user stable changelog needs the exact release heading and a blank line`);
  return { baseStable: base[1], body };
}

export function composeUserStableNotes({ changelogRu, changelogEn, tag, baseStable }) {
  const ru = userStableSection(changelogRu, { tag, language: 'ru', baseStable });
  const en = userStableSection(changelogEn, { tag, language: 'en', baseStable });
  if (ru.baseStable !== en.baseStable) throw new Error('RU/EN user changelog previous stable must agree');
  return `<!-- release: ${tag} -->\n${NARRATIVE_MARKER}\n<!-- base: ${ru.baseStable} -->\n<!-- language: ru -->\n${ru.body}\n<!-- language: en -->\n${en.body}\n`;
}

export function readUserStableNotes(root, { tag, baseStable } = {}) {
  const read = (language) => readFileSync(resolve(root, USER_STABLE_PATHS[language]), 'utf8');
  return composeUserStableNotes({ changelogRu: read('ru'), changelogEn: read('en'), tag, baseStable });
}
