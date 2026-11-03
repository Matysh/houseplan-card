import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPickerCard } from '../test-build/card-picker-registration.js';
import { LANGUAGE_REGISTRY, dictionaryFor } from '../test-build/i18n/registry.js';

function setup() {
  globalThis.window = { customCards: [] };
  let root = null;
  globalThis.document = { querySelector: () => root };
  registerPickerCard('houseplan-card');
  registerPickerCard('houseplan-space-card', { preview: false, documentation: 'https://github.com/Matysh/houseplan-card' });
  return { cards: window.customCards, profile(hass) { root = { hass }; } };
}

test('#1240: cold metadata follows the HA profile even before any card exists', () => {
  const { cards, profile } = setup();
  assert.equal(cards[0].name, 'House Plan Card');
  assert.match(cards[0].description, /^Interactive house plan/);
  profile({ language: 'en', locale: { language: 'ru-RU' } });
  assert.match(cards[0].description, /^Интерактивный план дома/);
  assert.match(cards[1].name, /Пространство/);
  assert.match(cards[1].description, /без редактирования/);
  assert.deepEqual(cards.map(card => card.type), ['houseplan-card', 'houseplan-space-card']);
  assert.equal(cards[1].preview, false);
});

test('#1240: registered entries follow language changes with synchronous metadata and fallback', () => {
  const { cards, profile } = setup();
  const prefixes = { en: /^Interactive/, ru: /^Интерактивный/, de: /^Interaktiver/, fr: /^Plan interactif/ };
  for (const { code, cardPicker } of LANGUAGE_REGISTRY) {
    assert.deepEqual(Object.keys(cardPicker).sort(), cards.map(card => card.type).sort());
    profile({ locale: { language: `${code.toUpperCase()}_XX` } });
    assert.match(cards[0].description, prefixes[code]);
    for (const card of cards) {
      assert.ok(card.name.trim() && card.description.trim());
      assert.match(card.name, /^House Plan/);
    }
  }
  // Metadata must not trigger a full lazy dictionary request.
  assert.equal(dictionaryFor('de'), dictionaryFor('en'));
  assert.equal(dictionaryFor('fr'), dictionaryFor('en'));
  profile({ language: 'unsupported' });
  assert.equal(cards[0].name, 'House Plan Card');
  assert.match(cards[0].description, /^Interactive/);
  profile({ language: 'ru' });
  assert.match(cards[0].description, /^Интерактивный/);
  registerPickerCard('houseplan-card');
  registerPickerCard('houseplan-space-card');
  assert.equal(window.customCards.length, 2);
});
