import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dictionary = (path) => JSON.parse(readFileSync(new URL(`../src/i18n/${path}.json`, import.meta.url), 'utf8'));
const LANGS = ['en', 'ru', 'de', 'fr'];

test('#1033 AC1: the backup export button names no file format', () => {
  const expected = { en: 'Download', ru: 'Скачать', de: 'Herunterladen', fr: 'Télécharger' };
  for (const lang of LANGS) {
    assert.equal(dictionary(lang)['backup.download'], expected[lang], lang);
  }
});

test('#1033 AC1: the help diagnostics download still says JSON — it is JSON', () => {
  const expected = {
    en: 'Download JSON', ru: 'Скачать JSON', de: 'JSON herunterladen', fr: 'Télécharger le JSON',
  };
  for (const lang of LANGS) {
    assert.equal(dictionary(`support/${lang}`)['support.download'], expected[lang], lang);
  }
});

test('#1033: the opening repair texts exist in every language with their count', () => {
  for (const lang of LANGS) {
    // Editor-only texts live in the lazy `tools` namespace, not in the View graph.
    const strings = dictionary(`tools/${lang}`);
    for (const key of ['backup.openings_rehosted', 'backup.openings_detached']) {
      assert.match(strings[key] || '', /\{n\}/, `${lang} ${key}`);
    }
    for (const key of ['backup.openings_details', 'backup.confirm_openings']) {
      assert.ok((strings[key] || '').trim(), `${lang} ${key}`);
    }
  }
});
