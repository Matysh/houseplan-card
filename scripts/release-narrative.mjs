/** Stable release prose belongs to the agent. This module checks, never drafts. */
import { isUserReleaseEntry, milestoneQuery } from './release-ledger.mjs';

export const NARRATIVE_MARKER = '<!-- stable-notes: 1 -->';
const languageMarker = (language) => `<!-- language: ${language} -->`;
const links = (text) => [...text.matchAll(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g)];
const sorted = (values) => [...new Set(values)].sort((a, b) => a - b).join(',');

export function stableHeading(tag, language) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error('User changelog requires a stable release tag');
  if (!['ru', 'en'].includes(language)) throw new Error('Unknown user changelog language');
  return language === 'ru' ? `## Релиз Houseplan ${tag.slice(1)}` : `## Houseplan ${tag.slice(1)} release`;
}

const isFeature = (block) => /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]* \*\*[^*\n]+\*\* \S/u.test(block);

export function narrativeLanguages(notes, { tag } = {}) {
  if (tag && notes.split(/\r?\n/, 1)[0] !== `<!-- release: ${tag} -->`)
    throw new Error(`Stable notes must start with <!-- release: ${tag} -->`);
  if (notes.split(NARRATIVE_MARKER).length !== 2) throw new Error('Stable notes need one narrative format marker');
  for (const language of ['ru', 'en']) {
    if (notes.split(languageMarker(language)).length !== 2) throw new Error(`Stable notes need one ${language} marker`);
  }
  const ruIndex = notes.indexOf(languageMarker('ru'));
  const enIndex = notes.indexOf(languageMarker('en'));
  if (ruIndex >= enIndex) throw new Error('Russian narrative must precede English');
  const prefix = notes.slice(0, ruIndex).replace(/<!--[^]*?-->/g, '').trim();
  if (prefix) throw new Error('Visible stable body must start with the introductory paragraph');
  return {
    ru: notes.slice(ruIndex + languageMarker('ru').length, enIndex).trim(),
    en: notes.slice(enIndex + languageMarker('en').length).trim(),
  };
}

export function validateNarrative(notes, { tag, repo = 'Matysh/houseplan-card', catalogue }) {
  const { cycle, entries } = catalogue;
  if (tag !== cycle.targetStable) throw new Error('Narrative tag differs from the classified release cycle');
  const baseMarker = `<!-- base: ${cycle.baseStable} -->`;
  if (notes.split(baseMarker).length !== 2) throw new Error('Stable notes need the exact previous stable marker');
  const major = entries.filter((entry) => entry.category === 'major').map((entry) => entry.issue);
  const fixes = entries.filter((entry) => entry.category === 'stable-fix');
  const allowedIssues = new Set(entries.filter(isUserReleaseEntry).map((entry) => entry.issue));
  const languages = narrativeLanguages(notes, { tag });
  const query = milestoneQuery(repo, cycle);
  const issueSets = [];
  for (const [language, body] of Object.entries(languages)) {
    const blocks = body.split(/\n\s*\n/);
    if (blocks.shift() !== stableHeading(tag, language))
      throw new Error(`${language}: stable announcement needs the exact release heading and a blank line`);
    if (/<!--|^\s*(?:#|>|\d+\.|```|[-*] )|<\/?[a-z][^>]*>/im.test(blocks.join('\n\n')))
      throw new Error(`${language}: use plain paragraphs and emoji features, not technical headings or bullet lists`);
    if (!blocks[0] || /^[-*]/.test(blocks[0]) || /\n- |https?:\/\//.test(blocks[0]))
      throw new Error(`${language}: first block must be a plain human-readable introductory paragraph`);
    if (isFeature(blocks[0])) throw new Error(`${language}: introductory paragraph must precede the features`);
    const collection = blocks.pop();
    if (links(collection).length !== 1 || collection !== links(collection)[0][0] || links(collection)[0][2] !== query)
      throw new Error(`${language}: final compact link must select the exact milestone, including closed issues`);
    blocks.shift();
    let bullets = [];
    while (blocks.length && isFeature(blocks[0])) bullets.push(blocks.shift());
    if (bullets.length > 5 || (major.length && !bullets.length) || (!major.length && bullets.length))
      throw new Error(`${language}: 1–5 major bullets, or no list when no major features`);
    const bulletIssues = [];
    for (const bullet of bullets) {
      if (bullet.includes('\n') || !/\[#\d+\]\(https:\/\/[^\s)]+\)$/.test(bullet))
        throw new Error(`${language}: each emoji feature needs a blank line and must end with compact issue-number link(s)`);
      const anchors = links(bullet);
      if (!anchors.length) throw new Error(`${language}: missing major-feature issue links`);
      for (const [, label, url] of anchors) {
        const issue = Number(label.slice(1));
        if (!/^#\d+$/.test(label) || url !== `https://github.com/${repo}/issues/${issue}` || !major.includes(issue))
          throw new Error(`${language}: bullet links must name classified major issues from this candidate`);
        bulletIssues.push(issue);
      }
    }
    if (sorted(bulletIssues) !== sorted(major)) throw new Error(`${language}: major-feature coverage differs from catalogue`);
    if (blocks.length > 1 || (fixes.length && blocks.length !== 1) || (!fixes.length && blocks.length))
      throw new Error(`${language}: one short other-changes paragraph only for actual previous-stable fixes`);
    if (blocks.some((block) => /^[-*]|\n- /.test(block))) throw new Error(`${language}: fixes-only notes have paragraphs, not a list`);
    const allAnchors = links(body);
    for (const [, label, url] of allAnchors) {
      if (url === query) continue;
      const issue = Number(label.slice(1));
      if (!/^#\d+$/.test(label) || url !== `https://github.com/${repo}/issues/${issue}` || !allowedIssues.has(issue))
        throw new Error(`${language}: foreign/infra/within-line issue or noncompact link in stable body`);
    }
    if (/https?:\/\//.test(body.replace(/\[[^\]\n]+\]\(https:\/\/[^\s)]+\)/g, '')))
      throw new Error(`${language}: raw full URLs are forbidden`);
    issueSets.push(sorted(allAnchors.filter(([,label]) => /^#\d+$/.test(label)).map(([,label]) => Number(label.slice(1)))));
  }
  if (issueSets[0] !== issueSets[1]) throw new Error('RU/EN issue coverage must agree');
  return notes.trim() + '\n';
}
