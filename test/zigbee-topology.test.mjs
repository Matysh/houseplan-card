import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeIeee,
} from '../test-build/zigbee-topology.js';
import { zigbeeArrowGeometry } from '../test-build/zigbee-topology-geometry.js';
import {
  normalizeZ2mBaseTopic, writeZigbeeTopologySettings, zigbeeTopologySettingsOf,
} from '../test-build/zigbee-topology-settings.js';
import {
  readZhaTopology, refreshZ2mTopology, zigbeeTopologyRuntimeSnapshot,
} from '../test-build/zigbee-topology-runtime.js';

const z2mNetworkmapFixture = JSON.parse(readFileSync(
  new URL('./fixtures/zigbee2mqtt-networkmap-real-anonymized.json', import.meta.url),
  'utf8',
));
const topologySmoke = readFileSync(
  new URL('../demo/smoke_zigbee_topology_hover.mjs', import.meta.url), 'utf8',
);

test('Stage 3 topology smoke follows actual raised DOM centres before and after pan/zoom', () => {
  // #649: 2.5D is the General settings switch; the harness applies it like a save.
  assert.doesNotMatch(topologySmoke, /hp_alpha/);
  assert.match(topologySmoke,
    /window\.__hpHarnessProjection\(card, 'iso'\);\s*await window\.__hpEnsureHarnessIsoRuntime\(card\)/,
    'the witness must enter real 2.5D and await its lazy runtime');
  assert.match(topologySmoke, /data-hp-iso-overlay-kind/,
    'the witness must prove both marker roots are raised');
  assert.match(topologySmoke, /svg\?\.getScreenCTM\(\)/,
    'SVG route endpoints must be compared in the same CSS-pixel coordinate space as DOM markers');
  assert.match(topologySmoke, /distance\(lineStart, sourceCentre\) <= 1/);
  assert.match(topologySmoke, /distance\(lineEnd, neighborCentre\) <= 1/);
  assert.match(topologySmoke, /distance\(haloCentre, neighborCentre\) <= 1/);
  assert.match(topologySmoke, /isoTopologyTracksRaisedDomCentresAfterPanZoom/,
    'the same exact geometry witness must be repeated after a real pan/zoom');
});

test('topology settings are default-off, bounded, normalized and preserved independently', () => {
  assert.deepEqual(zigbeeTopologySettingsOf(undefined), { enabled: false, z2mBaseTopics: [] });
  assert.deepEqual(zigbeeTopologySettingsOf({ zigbee_topology: {
    enabled: true, z2m_base_topics: [' zigbee2mqtt/ ', 'zigbee2mqtt', 'bad/#'],
  } }), { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] });
  assert.equal(normalizeZ2mBaseTopic('/house//z2m/'), 'house/z2m');
  const saved = writeZigbeeTopologySettings({ keep: 7 }, {
    enabled: true, z2mBaseTopics: ['zigbee2mqtt'],
  });
  assert.deepEqual(saved, { keep: 7, zigbee_topology: { enabled: true, z2m_base_topics: ['zigbee2mqtt'] } });
  assert.deepEqual(writeZigbeeTopologySettings(saved, { enabled: false, z2mBaseTopics: [] }), { keep: 7 });
});

test('IEEE normalization is exact and rejects partial identifiers', () => {
  assert.equal(normalizeIeee('0x00124B0000000001'), '00124b0000000001');
  assert.equal(normalizeIeee('00:12:4b:00:00:00:00:01'), '00124b0000000001');
  assert.equal(normalizeIeee('124b1'), null);
});

// Provider normalization, exact mapping and provider-only route resolution:
// test/zigbee-provider-routes.test.mjs (#798 replaces the inferred BFS-tree contract).

test('screen-pixel arrow geometry points at the requested endpoint and respects clearance', () => {
  const origin = { x: 0, y: 20 };
  const neighbor = { x: 100, y: 20 };
  const outgoing = zigbeeArrowGeometry(origin, neighbor, 10, 12, 'toward-neighbor');
  assert.deepEqual(outgoing?.tip, { x: 88, y: 20 });
  assert.equal(outgoing?.points[1].x, 79);
  assert.equal(outgoing?.points[2].x, 79);
  const incoming = zigbeeArrowGeometry(origin, neighbor, 10, 12, 'toward-origin');
  assert.deepEqual(incoming?.tip, { x: 10, y: 20 });
  assert.equal(incoming?.points[1].x, 19);
  const diagonal = zigbeeArrowGeometry({ x: 10, y: 10 }, { x: 70, y: 90 }, 5, 7, 'toward-neighbor');
  assert.ok(diagonal && diagonal.tip.x < 70 && diagonal.tip.y < 90);
  assert.equal(zigbeeArrowGeometry(origin, { x: 20, y: 20 }, 10, 8, 'toward-neighbor'), null);
});

test('ZHA runtime is explicit, admin-only and deduplicates concurrent reads', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const hass = { user: { is_admin: true }, connection: {}, callWS: async (message) => {
    calls++;
    assert.deepEqual(message, { type: 'zha/devices' });
    await pending;
    return [{ ieee: '00124b0000000001', device_reg_id: 'da', neighbors: [] }];
  } };
  const a = readZhaTopology(hass);
  const b = readZhaTopology(hass);
  assert.equal(calls, 1);
  release();
  await Promise.all([a, b]);
  assert.equal(zigbeeTopologyRuntimeSnapshot(hass).topologies.length, 1);

  const denied = { user: { is_admin: false }, connection: {}, callWS: async () => assert.fail('must not call') };
  await readZhaTopology(denied);
  assert.deepEqual(zigbeeTopologyRuntimeSnapshot(denied).states, {}, 'non-admin cannot read runtime data');
});

// #800 moves MQTT correlation/limits/cleanup to the HA coordinator tests.
// The frontend consumes its authoritative result and preserves route normalization.
test('Z2M server job response retains the real fixture normalization without browser MQTT', async () => {
  const hass = { user: { is_admin: true }, connection: { async subscribeMessage() { return () => {}; } },
    async callWS(message) {
      if (message.type === 'houseplan/config/get') return { zigbee_scan_api: 1 };
      assert.deepEqual(message, { type: 'houseplan/zigbee/start', base_topic: 'zigbee2mqtt' });
      return { kind: 'state', session_id: 'server', revision: 1, provider: {
        topic: 'zigbee2mqtt', job_id: 'job', phase: 'ready', elapsed_ms: 900000,
        obtained_at: 1000, result: z2mNetworkmapFixture,
      } };
    }, callService() { assert.fail('no frontend MQTT'); },
  };
  await refreshZ2mTopology(hass, 'zigbee2mqtt');
  const snapshot = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(snapshot.states['z2m:zigbee2mqtt'].phase, 'ready');
  assert.equal(snapshot.topologies[0].nodes.length, 3);
  assert.equal(snapshot.topologies[0].links.length, 2);
  assert.equal(snapshot.topologies[0].uplinkEvidence.length, 0, 'neighbors-only fixture is not route evidence');
});

// #459. Подсказка «Связи Zigbee»: легенда живёт в словаре, и её содержание —
// защитный контракт. Текст, называющий только цвет и пунктир, формально
// «подсказка есть», но не отвечает ни на один вопрос про стрелки — ради
// которых задача и ждала #457. Поэтому проверяется КАЖДЫЙ пункт легенды.

const topologyDict = (code) => JSON.parse(readFileSync(
  new URL(`../src/i18n/topology/${code}.json`, import.meta.url), 'utf8',
));
const TOPOLOGY_LANGS = ['en', 'ru', 'de', 'fr'];

test('подсказка описывает provider evidence, unknown и новый сплошной рисунок (#798)', () => {
  const help = topologyDict('ru').help;
  for (const [pattern, reason] of [
    [/родител/i, 'parent evidence'],
    [/координатор/i, 'destination coordinator'],
    [/интеграц/i, 'provider source'],
    [/данн/i, 'unknown route'],
    [/пакет/i, 'not packet tracing'],
    [/LQI/i, 'LQI named'],
    [/\b0\b/, 'zero LQI scale anchor'],
    [/\b128\b/, 'midpoint LQI scale anchor'],
    [/\b255\b/, 'full-range LQI scale anchor'],
    [/сплошн/i, 'solid lines'],
    [/сер/i, 'unknown-LQI color'],
    [/обвод/i, 'unknown-LQI outline'],
    [/ч[её]рн/i, 'unknown-LQI black outline'],
  ]) assert.match(help, pattern, reason);
  assert.doesNotMatch(help, /запасн[а-яё]* сосед|пунктир|40.*180|дерево маршрут/i);
});

test('подсказка не полагается на переносы строк (#459 AC5)', () => {
  // hp-help кладёт .text текстовым узлом: \n схлопнется в пробел.
  for (const code of TOPOLOGY_LANGS) {
    const dict = topologyDict(code);
    assert.ok(!dict.help.includes('\n'), `${code}: перенос строки в help`);
    assert.ok(dict.help.trim().length > 0, `${code}: пустая подсказка`);
    assert.ok(dict.help_aria.trim().length > 0, `${code}: пустая подпись для скринридера`);
  }
});

test('словари topology несут один и тот же набор ключей (#459 AC6)', () => {
  // Гейт, которого не было: i18n-dead-keys и i18n.test знают основной словарь,
  // бэкендные переводы и support, но не namespace topology.
  const english = Object.keys(topologyDict('en')).sort();
  const placeholders = (value) => (String(value).match(/\{\w+\}/gu) || []).sort();
  const en = topologyDict('en');
  for (const code of TOPOLOGY_LANGS) {
    const dict = topologyDict(code);
    assert.deepEqual(Object.keys(dict).sort(), english, `${code}: набор ключей расходится`);
    for (const key of english) {
      assert.deepEqual(placeholders(dict[key]), placeholders(en[key]),
        `${code}: плейсхолдеры расходятся в ${key}`);
    }
  }
});

test('кружок справки не рисуется без подписи для скринридера (#459 AC2)', async () => {
  const { hasTopologyTranslation, topologyT, TOPOLOGY_LANGUAGE_RUNTIME } =
    await import('../test-build/i18n/topology.js');
  // #627: ru/de are lazy chunks. Without `ensure` this would prove the English
  // fallback layer, not the Russian dictionary.
  await TOPOLOGY_LANGUAGE_RUNTIME.ensure('ru');
  await TOPOLOGY_LANGUAGE_RUNTIME.ensure('de');
  assert.equal(TOPOLOGY_LANGUAGE_RUNTIME.state('ru'), 'ready');
  assert.notEqual(topologyT('ru', 'help_aria'), topologyT('en', 'help_aria'));
  // Проверка идёт по СЛОВАРЮ, а не по строке: topologyT на отсутствующий ключ
  // отвечает именем ключа, и «help» — вполне непустая строка.
  assert.equal(hasTopologyTranslation('ru', 'help'), true);
  assert.equal(hasTopologyTranslation('ru', 'help_aria'), true);
  assert.equal(hasTopologyTranslation('ru', 'no_such_key'), false);
  // Английский — слой фолбэка: ключ, которого нет в локали, но есть в en,
  // доступен, как и в topologyT.
  assert.equal(hasTopologyTranslation('de', 'help'), true);
});

test('подсказка вызывается из блока настройки топологии (#459 AC1)', () => {
  const source = readFileSync(
    new URL('../src/hp-zigbee-topology-settings.ts', import.meta.url), 'utf8',
  );
  // Кружок стоит у ЗАГОЛОВКА функции, а не у тумблера: он объясняет функцию,
  // а не то, что делает галочка.
  assert.match(source, /<div class="section">\$\{this\._t\('title'\)\}\$\{this\._help\(\)\}<\/div>/);
  assert.match(source, /<hp-help \.text=/);
  // Fail-closed: оба ключа обязательны, иначе не рисуется ничего.
  assert.match(source, /hasTopologyTranslation\(lang, 'help'\)/);
  assert.match(source, /hasTopologyTranslation\(lang, 'help_aria'\)/);
});
