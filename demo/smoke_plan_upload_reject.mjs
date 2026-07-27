// Граница транзакции загрузки подложки (ревью R2-1).
// Файл плана пишется на диск ДО проверки ревизии конфига, поэтому отвергнутое
// сохранение не имеет права трогать сохранённый план. Проверяем контракт со
// стороны карточки: удаление старых файлов (houseplan/plan/cleanup) уходит
// ТОЛЬКО после принятого config/set — и никогда после отказа.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const base = c.hass.callWS;
  let uploads = 0;
  const cleanups = [];
  let rejectSave = true;

  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/plan/set') {
      uploads++;
      return { ok: true, url: '/api/houseplan/content/plans/_/' + m.space_id + '.tok' + uploads + '.png' };
    }
    if (m.type === 'houseplan/plan/cleanup') { cleanups.push(m); return { ok: true, removed: 1 }; }
    if (m.type === 'houseplan/config/set') {
      if (rejectSave) { const e = new Error('conflict'); e.code = 'conflict'; throw e; }
      c.__sent = m.config; return { ok: true, rev: 77 };
    }
    if (m.type === 'houseplan/config/get') {
      const r = await base(m);
      return { ...r, config: JSON.parse(JSON.stringify(r.config)) };
    }
    return base(m);
  } };

  const attach = async () => {
    c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
    c._spaceDialog = { ...c._spaceDialog, title: 'Ground', source: 'file',
      planFile: { ext: 'png', b64: 'AAAA', aspect: 1.6 } };
    await c._saveSpaceDialog(); await c.updateComplete;
  };

  // 1) конфиг отвергнут → файл загружен, но чистить старый план нельзя
  await attach();
  out.uploadedOnReject = uploads === 1;
  out.cleanupsAfterReject = cleanups.length;
  out.dialogStaysOpenOnReject = c._spaceDialog !== null;

  // 2) конфиг принят → чистка уходит, и ровно на тот файл, что записан в конфиг
  rejectSave = false;
  c._spaceDialog = null; await c.updateComplete;
  await attach();
  out.cleanupsAfterAccept = cleanups.length;
  out.cleanupSpace = cleanups[0]?.space_id;
  out.cleanupKeep = cleanups[0]?.keep;
  const f1 = (c.__sent?.spaces || []).find((s) => s.id === 'f1');
  out.savedPlanUrl = f1?.plan_url;
  out.keepMatchesSavedUrl = !!f1 && f1.plan_url.endsWith('/' + cleanups[0]?.keep);
  return out;
});
// зафиксировано прогоном на v1.45.0 и сверено с кодом
checkAll(res, {
  uploadedOnReject: true,
  cleanupsAfterReject: 0,
  dialogStaysOpenOnReject: true,
  cleanupsAfterAccept: 1,
  cleanupSpace: 'f1',
  cleanupKeep: 'f1.tok2.png',
  savedPlanUrl: '/api/houseplan/content/plans/_/f1.tok2.png',
  keepMatchesSavedUrl: true,
});
await finish(browser);
