// #1386: real same-element masonry moves, event gaps and connection recovery.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 1180, height: 900 });
try {
  const report = await page.evaluate(async () => {
    const card = window.__card, parent = card.parentElement, original = card.hass;
    const connection = Object.assign(new EventTarget(), original.connection);
    const requests = [];
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async predicate => {
      const end = performance.now() + 6000;
      while (!predicate() && performance.now() < end) await sleep(16);
      return !!predicate();
    };
    const ready = () => card._loadOk && !card._loading && !card._booting
      && card._continuity.state === 'steady' && !!card.renderRoot.querySelector('svg.plan-svg');
    const counts = () => Object.fromEntries(['config/entity_registry/list', 'config/device_registry/list',
      'houseplan/config/get', 'houseplan/layout/get'].map(type => [type, requests.filter(r => r.type === type
        && !(type === 'houseplan/config/get' && r.fields)).length]));
    const checks = {};
    card.remove();
    card.hass = { ...original, connection, callWS: request => {
      requests.push(structuredClone(request)); return original.callWS(request);
    } };
    parent.append(card);
    checks.freshAuthorityReady = await until(ready);
    const initial = counts(), builds = card._spaceModels.work.builds;
    const fingerprint = card.renderRoot.querySelector('svg.plan-svg')?.outerHTML;
    const samples = [];
    for (const delay of [0, 1000, 1000]) {
      card.remove(); await sleep(delay);
      const started = performance.now(); parent.append(card);
      await card.updateComplete;
      const shown = [];
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        shown.push(!!card.renderRoot.querySelector('.room') && !card._booting);
      }
      checks[`move-${delay}-${samples.length}-ready`] = await until(ready);
      checks[`move-${delay}-${samples.length}-visible`] = shown.every(Boolean);
      samples.push({ gapMs: delay, reconnectMs: performance.now() - started,
        builds: card._spaceModels.work.builds - builds, counts: counts() });
    }
    checks.noRepeatedRegistryRead = counts()['config/entity_registry/list'] === initial['config/entity_registry/list']
      && counts()['config/device_registry/list'] === initial['config/device_registry/list'];
    checks.noRepeatedConfigLayoutRead = counts()['houseplan/config/get'] === initial['houseplan/config/get']
      && counts()['houseplan/layout/get'] === initial['houseplan/layout/get'];
    checks.noRepeatedPhysicalBuild = card._spaceModels.work.builds === builds;
    checks.samePaintedPlan = card.renderRoot.querySelector('svg.plan-svg')?.outerHTML === fingerprint;

    const beforeEvent = counts()['houseplan/config/get'];
    const positionId = Object.keys(card._layout)[0];
    const positionX = Math.min(.8, (card._layout[positionId]?.x || .2) + .02);
    card.remove();
    const changed = window.__hpTest.setServerConfig(config => {
      config.spaces[0].title = 'Changed during DOM move';
    }).then(() => true, () => false);
    const moved = window.__hpTest.setLayout(layout => {
      layout[positionId] = { ...layout[positionId], x: positionX };
    }).then(() => true, () => false);
    await sleep(100); parent.append(card);
    checks.gapEventRecovered = await changed && await until(() => ready()
      && card._serverCfg?.spaces[0].title === 'Changed during DOM move');
    checks.gapEventReadsOnePair = counts()['houseplan/config/get'] === beforeEvent + 1;
    checks.gapLayoutRecovered = await moved && card._layout[positionId]?.x === positionX;

    const beforeDetachedReconnect = counts();
    card.remove();
    connection.dispatchEvent(new Event('disconnected'));
    connection.dispatchEvent(new Event('ready'));
    await sleep(100);
    checks.detachedReconnectDoesNotRead = JSON.stringify(counts()) === JSON.stringify(beforeDetachedReconnect);
    parent.append(card);
    checks.detachedReconnectRecovered = await until(() => ready()
      && counts()['houseplan/config/get'] === beforeDetachedReconnect['houseplan/config/get'] + 1
      && counts()['config/entity_registry/list'] === beforeDetachedReconnect['config/entity_registry/list'] + 1);

    const beforeLongReturn = counts()['houseplan/config/get'];
    card.remove(); await sleep(2300); parent.append(card);
    checks.longReturnRevalidates = await until(() => ready()
      && counts()['houseplan/config/get'] === beforeLongReturn + 1);

    const beforeReconnect = counts();
    connection.dispatchEvent(new Event('disconnected'));
    connection.dispatchEvent(new Event('ready'));
    checks.realReconnectRevalidates = await until(() => ready()
      && counts()['houseplan/config/get'] === beforeReconnect['houseplan/config/get'] + 1
      && counts()['config/entity_registry/list'] === beforeReconnect['config/entity_registry/list'] + 1);
    checks.noWrites = !requests.some(r => /\/(set|update|delete)$/.test(r.type));
    return { checks, initial, final: counts(), samples };
  });
  console.log(JSON.stringify(report, null, 2));
  mkdirSync('artifacts/issue1386', { recursive: true });
  writeFileSync('artifacts/issue1386/native-reconnect.json', JSON.stringify(report, null, 2) + '\n');
  checkAll(report.checks);
  await finish(browser, report.checks);
} finally { await browser.close(); }
