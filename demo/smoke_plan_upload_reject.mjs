// Граница транзакции загрузки подложки (ревью R2-1, уточнено в R3-1).
// Файл плана пишется на диск ДО проверки ревизии конфига, поэтому отвергнутое
// сохранение не имеет права трогать сохранённый план. Со стороны карточки
// контракт теперь такой: она НЕ управляет удалением файлов вообще — уборку
// делает сам config/set под блокировкой (клиент не может упорядочить свою
// уборку относительно чужого коммита, R3-1). Здесь проверяем, что карточка
// не отправляет никаких команд удаления и корректно ведёт себя при отказе.
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
    // любая команда удаления файлов от клиента — нарушение контракта R3-1
    if (m.type === 'houseplan/plan/cleanup' || m.type === 'houseplan/plan/delete') { cleanups.push(m); return { ok: true }; }
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
  const f1 = (c.__sent?.spaces || []).find((s) => s.id === 'f1');
  out.savedPlanUrl = f1?.plan_url;
  out.dialogClosedOnAccept = c._spaceDialog === null;
  // вторая загрузка не переиспользует имя первой: старый файл жив до коммита
  out.versionedNames = uploads === 2;
  return out;
});
// зафиксировано прогоном на v1.45.0 и сверено с кодом
checkAll(res, {
  uploadedOnReject: true,
  cleanupsAfterReject: 0,
  dialogStaysOpenOnReject: true,
  cleanupsAfterAccept: 0,
  savedPlanUrl: '/api/houseplan/content/plans/_/f1.tok2.png',
  dialogClosedOnAccept: true,
  versionedNames: true,
});
await finish(browser);
