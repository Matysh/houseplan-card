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

  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/plan/set') {
      // пока файл «загружается», прилетает чужая ревизия конфига
      reloadDuringUpload++;
      await c._reloadConfigOnly(true);
      return { ok: true, url: '/api/houseplan/content/plans/_/' + m.space_id + '.png?v=42' };
    }
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
    planFile: { ext: 'png', b64: 'AAAA', aspect: 1.6 } };
  await c._saveSpaceDialog(); await c.updateComplete;

  out.reloadHappened = reloadDuringUpload === 1;
  const sentF1 = (c.__sent?.spaces || []).find((s) => s.id === 'f1');
  const liveF1 = (c._serverCfg?.spaces || []).find((s) => s.id === 'f1');
  out.sentPlanUrl = sentF1?.plan_url;
  out.sentAspect = sentF1?.aspect;
  out.sentTitle = sentF1?.title;
  out.livePlanUrl = liveF1?.plan_url;
  out.dialogClosed = c._spaceDialog === null;

  // создание пространства при том же сбое: оно должно доехать целиком
  c._openSpaceDialog('create'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Attic', source: 'file',
    planFile: { ext: 'png', b64: 'BBBB', aspect: 0.8 } };
  await c._saveSpaceDialog(); await c.updateComplete;
  const attic = (c.__sent?.spaces || []).find((s) => s.title === 'Attic');
  out.atticSaved = !!attic;
  out.atticHasPlan = !!attic && typeof attic.plan_url === 'string' && attic.plan_url.includes('/content/plans/');
  out.atticAspect = attic?.aspect;
  return out;
});
// зафиксировано прогоном на v1.44.8 и сверено с кодом
checkAll(res, {
  reloadHappened: true,
  sentPlanUrl: '/api/houseplan/content/plans/_/f1.png?v=42',
  sentAspect: 1.6,
  sentTitle: 'Ground',
  livePlanUrl: '/api/houseplan/content/plans/_/f1.png?v=42',
  dialogClosed: true,
  atticSaved: true,
  atticHasPlan: true,
  atticAspect: 0.8,
});
await finish(browser);
