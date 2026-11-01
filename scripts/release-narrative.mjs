/** Pure authored release text parsing, shared by changelog preparation and Telegram. */

export const NARRATIVE_MARKER = '<!-- stable-notes: 1 -->';
const languageMarker = (language) => `<!-- language: ${language} -->`;

export function stableHeading(tag, language) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error('User changelog requires a stable release tag');
  if (!['ru', 'en'].includes(language)) throw new Error('Unknown user changelog language');
  return language === 'ru' ? `## Релиз Houseplan ${tag.slice(1)}` : `## Houseplan ${tag.slice(1)} release`;
}


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
