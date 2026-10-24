/** #1056: a reused mounted HA snapshot must not suppress current operational intake. */
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser('mounted authority');
const reports = {};
for (const scenario of ['connection', 'user', 'new-object', 'ABA', 'held-old', 'held-current', 'same-context', 'missing-initial']) {
  const { page, browser } = await launchColdView({ width: 1200, height: 900 });
  try {
    reports[scenario] = await page.evaluate(async scenario => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const until = async test => {
        const end = performance.now() + 4000;
        while (!test() && performance.now() < end) await sleep(16);
        return !!test();
      };
      const initial = window.__card, original = initial.hass;
      const seed = structuredClone(initial._serverCfg);
      const layout = await original.callWS({ type: 'houseplan/layout/get' });
      let card = initial;
      const mandatoryConfig = message => message.type === 'houseplan/config/get'
        && !(message.fields?.length === 1 && message.fields[0] === 'model_version');
      const capability = message => message.type === 'houseplan/config/get' && !mandatoryConfig(message);
      const make = (name, connection = { ...original.connection }, userId = `mounted-${name}`) => {
        const config = structuredClone(seed), calls = [], held = [];
        config.spaces = config.spaces.map(space => space.id === 'f1' ? { ...space, title: `Mounted ${name}` } : space);
        let hold = false;
        const hass = { ...original, connection, user: { ...original.user, id: userId },
          callService: (...args) => { calls.push({ type: 'service', args }); },
          callWS: async message => {
            calls.push(structuredClone(message));
            if (hold && (mandatoryConfig(message) || message.type === 'houseplan/layout/get')) {
              await new Promise(resolve => held.push(resolve));
            }
            if (message.type === 'houseplan/config/get') {
              // Real projection semantics: [] is full config, never metadata.
              const selected = Array.isArray(message.fields) && message.fields.length
                ? Object.fromEntries(Object.entries(config).filter(([key]) => message.fields.includes(key))) : config;
              return { config: structuredClone(selected), rev: 1,
                can_write: scenario === 'held-old' && name === 'B', zigbee_lqi_api: 0 };
            }
            if (message.type === 'houseplan/layout/get') return { ...structuredClone(layout), rev: 1 };
            return original.callWS(message);
          },
        };
        return { hass, calls, held, hold: () => { hold = true; }, release: () => {
          hold = false; for (const resolve of held.splice(0)) resolve();
        } };
      };
      const a = make('A'), b = scenario === 'user' ? make('B', a.hass.connection) : make('B');
      if (scenario === 'connection') b.hass.user = a.hass.user;
      const c = make('C');
      const owners = [a, b, c];
      const counts = owner => ({ config: owner.calls.filter(mandatoryConfig).length,
        layout: owner.calls.filter(message => message.type === 'houseplan/layout/get').length,
        capability: owner.calls.filter(capability).length });
      const title = () => card._serverCfg?.spaces?.find(space => space.id === 'f1')?.title;
      const ready = name => title() === `Mounted ${name}` && card._loadOk && !card._read.busy
        && card.renderRoot.querySelectorAll('.room').length === 4;
      const settle = async () => { await card.updateComplete;
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); };
      const out = {};
      const intakeCount = () => card._continuity.trace.filter(event => event.event === 'hass-snapshot').length;
      let intakeObservation = null;
      if (scenario === 'missing-initial') {
        const host = document.createElement('div'); host.style.width = '800px'; document.body.append(host);
        card = document.createElement('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card' });
        const reused = { ...a.hass, callWS: undefined };
        card.hass = reused; host.append(card); await settle();
        out.noReadWithoutUsableHA = counts(a).config === 0 && counts(a).layout === 0;
        Object.assign(reused, a.hass); card.hass = reused;
        out.initialSameObjectRecovers = await until(() => ready('A'));
        out.initialOnePair = counts(a).config === 1 && counts(a).layout === 1;
      } else {
        card.hass = a.hass;
        out.initialLoaded = await until(() => ready('A'));
        await settle(); a.calls.length = 0;
        // _hassSequence also includes signal-cache retirement notifications.
        // The existing redacted trace marks operational intake specifically.
        const intakeBefore = intakeCount(), sequenceBefore = card._hassSequence;
        const reused = a.hass;
        const savedA = { ...a.hass };
        if (scenario === 'same-context') {
          card.hass = reused; await settle();
          card.hass = { ...reused, states: { ...reused.states,
            'sensor.mounted_unrepresented': { entity_id: 'sensor.mounted_unrepresented', state: '1', attributes: {} } } };
          await settle();
          out.sameContextKeepsPlan = ready('A');
          out.sameContextNoRead = counts(a).config === 0 && counts(a).layout === 0;
          out.onlyNewStateSnapshotIntakes = intakeCount() === intakeBefore + 1;
        } else if (scenario === 'ABA') {
          Object.assign(reused, b.hass); card.hass = reused;
          Object.assign(reused, savedA); card.hass = reused;
          out.ABARecoversWithoutTick = await until(() => ready('A'));
          await settle();
          out.ABAOneCurrentPair = counts(a).config === 1 && counts(a).layout === 1;
          out.ABANoIntermediateRead = counts(b).config === 0 && counts(b).layout === 0;
          out.ABAOneFinalIntake = intakeCount() === intakeBefore + 1;
        } else {
          if (scenario.startsWith('held-')) b.hold();
          if (scenario === 'new-object') card.hass = b.hass;
          else { Object.assign(reused, b.hass); card.hass = reused; }
          if (scenario.startsWith('held-')) {
            out.currentPairStarted = await until(() => b.held.length === 2);
            if (scenario === 'held-old') {
              Object.assign(reused, c.hass); card.hass = reused;
              out.newerAuthorityLoaded = await until(() => ready('C'));
              b.release(); await settle(); await sleep(30);
              out.lateOldCannotReplaceCurrent = ready('C') && card._serverCanWrite === false;
              out.newerAuthorityOnePair = counts(c).config === 1 && counts(c).layout === 1;
            } else {
              card.hass = reused; card.hass = reused;
              await settle();
              out.heldPairCoalesces = counts(b).config === 1 && counts(b).layout === 1;
              b.release();
              out.heldCurrentCompletes = await until(() => ready('B'));
            }
          } else {
            out.mountedCurrentWithoutFurtherTick = await until(() => ready('B'));
            await settle();
          }
          out.oneCurrentMandatoryPair = counts(b).config === 1 && counts(b).layout === 1;
          out.currentOperationalIntakeOnce = intakeCount() === intakeBefore + (scenario === 'held-old' ? 2 : 1);
        }
        intakeObservation = { sequenceDelta: card._hassSequence - sequenceBefore, traceDelta: intakeCount() - intakeBefore };
      }
      out.intakeTraceNotTruncated = card._continuity.trace.length < 80;
      out.staysMounted = card.isConnected;
      out.noWrites = owners.every(owner => owner.calls.every(message =>
        message.type !== 'service' && !/(set|update|delete)$/.test(message.type)));
      out.noEditorLoad = !performance.getEntriesByType('resource').some(entry => /houseplan-editor-runtime-/.test(entry.name));
      return { checks: out, counts: owners.map(counts), intakeObservation, observedTitle: title(),
        rooms: card.renderRoot.querySelectorAll('.room').length,
        requests: owners.map(owner => owner.calls.map(({ type, fields }) => ({ type, ...(fields ? { fields } : {}) }))) };
    }, scenario);
    checkAll(reports[scenario].checks);
  } finally { await finish(browser); }
}
console.log(JSON.stringify(reports, null, 2));
