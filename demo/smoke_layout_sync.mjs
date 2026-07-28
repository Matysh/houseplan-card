// HP-1460-03: позиции — отдельное состояние. В v1.46.0 событие layout_updated
// научилась слушать статическая карточка, а полная — нет, поэтому две полные
// карточки рядом расходились до перезагрузки. Проверяем и обратное: приход
// чужой ревизии не должен затирать перетаскивание, которое ещё не улетело.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const base = c.hass.callWS;

  // общий «сервер»: layout с ревизией и подписчики на событие
  let rev = 5;
  let layout = { dev_a: { x: 10, y: 10 }, dev_b: { x: 20, y: 20 } };
  const subs = [];
  let gets = 0;
  const hass = { ...c.hass,
    callWS: async (m) => {
      if (m.type === 'houseplan/layout/get') { gets++; return { layout: JSON.parse(JSON.stringify(layout)), rev }; }
      if (m.type === 'houseplan/layout/update') {
        layout = { ...layout, [m.device_id]: m.pos }; rev += 1;
        subs.forEach((f) => f({ data: { rev } }));
        return { ok: true, rev };
      }
      return base(m);
    },
    connection: { subscribeEvents: async (cb, ev) => {
      if (ev === 'houseplan_layout_updated') { subs.push(cb); return () => {}; }
      return () => {};
    } },
  };
  c.hass = hass;
  c._serverStorage = true;
  c._layout = JSON.parse(JSON.stringify(layout));
  c._layoutRev = rev;
  c._unsubLayout = await hass.connection.subscribeEvents(
    (e) => c._onLayoutEvent(Number(e?.data?.rev ?? -1)),
    'houseplan_layout_updated',
  );
  out.subscribed = subs.length === 1;

  // 1) чужая карточка подвинула иконку — наша обязана подхватить без перезагрузки
  layout = { ...layout, dev_a: { x: 77, y: 88 } }; rev += 1;
  subs.forEach((f) => f({ data: { rev } }));
  await new Promise((r) => setTimeout(r, 350));
  out.adoptedRemoteMove = JSON.stringify(c._layout.dev_a) === JSON.stringify({ x: 77, y: 88 });
  out.revFollowed = c._layoutRev === rev;

  // 2) собственная запись не вызывает лишнего перечитывания
  const before = gets;
  c._layout = { ...c._layout, dev_b: { x: 31, y: 32 } };
  c._dirtyPos.add('dev_b');
  c._persistLayout();
  c._persistLayout.flush();
  await new Promise((r) => setTimeout(r, 350));
  out.ownWriteNoReload = gets === before;
  out.ownWriteKept = JSON.stringify(c._layout.dev_b) === JSON.stringify({ x: 31, y: 32 });

  // 3) НАСТОЯЩЕЕ перетаскивание: debounce запланирован, запись задержана, а
  //    layout/get отвечает мгновенно. Именно этот порядок и терял позицию:
  //    flush() внутри перечитывания опустошал _dirtyPos ДО снятия снимка.
  let releaseUpdate;
  const updateGate = new Promise((r) => { releaseUpdate = r; });
  let delayUpdate = true;
  const plain = hass.callWS;
  c.hass = { ...hass, callWS: async (m) => {
    if (m.type === 'houseplan/layout/update' && delayUpdate) {
      delayUpdate = false;
      await updateGate;
    }
    return plain(m);
  } };

  c._layout = { ...c._layout, dev_a: { x: 5, y: 6 } };
  c._dirtyPos.add('dev_a');
  c._persistLayout();                              // debounce запланирован, не сброшен вручную
  layout = { ...layout, dev_b: { x: 99, y: 99 } }; rev += 1;
  subs.forEach((f) => f({ data: { rev } }));
  await new Promise((r) => setTimeout(r, 400));
  out.dragKeptWhileWriteInFlight = JSON.stringify(c._layout.dev_a) === JSON.stringify({ x: 5, y: 6 });
  out.remoteChangeApplied = JSON.stringify(c._layout.dev_b) === JSON.stringify({ x: 99, y: 99 });

  releaseUpdate();
  await new Promise((r) => setTimeout(r, 350));
  out.localDragSurvived = JSON.stringify(c._layout.dev_a) === JSON.stringify({ x: 5, y: 6 });
  out.serverAgrees = JSON.stringify(layout.dev_a) === JSON.stringify({ x: 5, y: 6 });
  out.sentPosDrained = c._sentPos.size === 0;
  return out;
});
// зафиксировано прогоном на v1.46.1 и сверено с кодом
checkAll(res, {
  subscribed: true,
  adoptedRemoteMove: true,
  revFollowed: true,
  ownWriteNoReload: true,
  ownWriteKept: true,
  dragKeptWhileWriteInFlight: true,
  remoteChangeApplied: true,
  localDragSurvived: true,
  serverAgrees: true,
  sentPosDrained: true,
});
await finish(browser);
