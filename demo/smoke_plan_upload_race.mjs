// Загрузка подложки: ссылка обязана долететь до конфига.
// Баг 2026-07-27 (найден на боевой установке): _saveSpaceDialog держал ссылку
// на объект пространства через await загрузки файла. Любое событие
// houseplan_config_updated в этот момент вызывает _reloadConfigOnly(), которое
// ЗАМЕНЯЕТ _serverCfg — и plan_url/aspect/settings уезжали в осиротевший
// объект, а на сервер уходил нетронутый конфиг. Симптом: файл на диске есть,
// подложки нет, пересохранение не помогает.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const base = c.hass.callWS;
  let reloadDuringUpload = 0;
  let wsUploads = 0;

  // #617: план уходит по HTTP (`/api/houseplan/plans/upload`), не по WS
  c.hass = { ...c.hass, fetchWithAuth: async (url, init) => {
    if (url !== '/api/houseplan/plans/upload') throw new Error('unexpected fetch ' + url);
    // пока файл «загружается», прилетает чужая ревизия конфига
    reloadDuringUpload++;
    await c._reloadConfigOnly(true);
    const spaceId = init.body.get('space_id');
    return { ok: true, status: 200, json: async () => ({
      ok: true, url: '/api/houseplan/content/plans/_/' + spaceId + '.png?v=42',
    }) };
  }, callWS: async (m) => {
    if (m.type === 'houseplan/plan/set') { wsUploads++; throw new Error('plan/set must not be used'); }
    if (m.type === 'houseplan/config/set') { c.__sent = m.config; return { ok: true, rev: 99 }; }
    if (m.type === 'houseplan/config/get') {
      // сервер отдаёт СВЕЖИЙ объект, а не тот же самый — как в реальном HA
      const r = await base(m);
      return { ...r, config: JSON.parse(JSON.stringify(r.config)) };
    }
    return base(m);
  } };

  // редактирование существующего пространства: подложка + новый заголовок
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Ground', source: 'file',
    planFile: { ext: 'png', blob: new Blob([new Uint8Array([1])]), aspect: 1.6, name: 'a.png' } };
  await c._saveSpaceDialog(); await c.updateComplete;

  out.reloadHappened = reloadDuringUpload === 1;
  const sentF1 = (c.__sent?.spaces || []).find((s) => s.id === 'f1');
  const liveF1 = (c._serverCfg?.spaces || []).find((s) => s.id === 'f1');
  out.sentPlanUrl = sentF1?.plan_url;
  out.sentPlanAspect = sentF1?.plan_aspect;   // the IMAGE's ratio; the canvas is square
  out.sentTitle = sentF1?.title;
  out.livePlanUrl = liveF1?.plan_url;
  out.dialogClosed = c._spaceDialog === null;

  // создание пространства при том же сбое: оно должно доехать целиком
  c._openSpaceDialog('create'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Attic', source: 'file',
    planFile: { ext: 'png', blob: new Blob([new Uint8Array([2])]), aspect: 0.8, name: 'b.png' } };
  await c._saveSpaceDialog(); await c.updateComplete;
  const attic = (c.__sent?.spaces || []).find((s) => s.title === 'Attic');
  out.atticSaved = !!attic;
  out.atticHasPlan = !!attic && typeof attic.plan_url === 'string' && attic.plan_url.includes('/content/plans/');
  out.atticPlanAspect = attic?.plan_aspect;
  out.wsUploads = wsUploads;
  return out;
});
// зафиксировано прогоном на v1.44.8 и сверено с кодом
checkAll(res, {
  reloadHappened: true,
  sentPlanUrl: '/api/houseplan/content/plans/_/f1.png?v=42',
  sentPlanAspect: 1.6,
  sentTitle: 'Ground',
  livePlanUrl: '/api/houseplan/content/plans/_/f1.png?v=42',
  dialogClosed: true,
  atticSaved: true,
  atticHasPlan: true,
  atticPlanAspect: 0.8,
  wsUploads: 0,
});
await finish(browser);
