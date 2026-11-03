// #1240: read the shipped picker registration before constructing any card.
import { launchPanelCold, checkAll, finish } from './serve.mjs';
const { page, browser } = await launchPanelCold();
const out = await page.evaluate(async () => {
  const root = document.createElement('home-assistant');
  root.hass = { locale: { language: 'ru' } };
  document.body.append(root);
  await import('/assets/houseplan-card.js');
  const cards = window.customCards;
  const main = cards.find(card => card.type === 'houseplan-card');
  const space = cards.find(card => card.type === 'houseplan-space-card');
  const result = {
    metadataExistsBeforeFirstCard: !document.querySelector('houseplan-card') && !!main && !!space,
    russianProfileLocalizesBothCards: main.description.startsWith('Интерактивный')
      && space.name.includes('Пространство') && space.description.includes('без редактирования'),
    spaceOptionsPreserved: space.preview === false && space.documentation === 'https://github.com/Matysh/houseplan-card',
  };
  const descriptions = [];
  for (const language of ['de-DE', 'fr-FR', 'en-US', 'ru-RU']) {
    root.hass = { locale: { language } };
    descriptions.push(main.description);
  }
  result.sameEntriesFollowProfileWithoutReload = descriptions[0].startsWith('Interaktiver')
    && descriptions[1].startsWith('Plan interactif') && descriptions[2].startsWith('Interactive')
    && descriptions[3].startsWith('Интерактивный') && window.customCards === cards;
  root.hass = { locale: { language: 'unknown' } };
  result.unknownLanguageFallsBackToEnglish = main.name === 'House Plan Card'
    && space.description.startsWith('Read-only');
  root.remove();
  return result;
});
checkAll(out);
await finish(browser);
