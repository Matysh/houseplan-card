// «Уже загруженные»: план, который не удаляется за ненадобностью, обязан быть
// находимым. Иначе обещание «отцепил — файл остался» неполноценно: вернуть его
// из карточки было нельзя, старый URL нигде не хранится (HP-1466-02).
// Заодно это единственный способ удалить план — явным действием.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 1000 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const base = c.hass.callWS;

  let serverPlans = [
    { name: 'f1.aaa.png', url: '/api/houseplan/content/plans/_/f1.aaa.png', size: 121335, modified: 2, used_by: [] },
    { name: 'f2.bbb.png', url: '/api/houseplan/content/plans/_/f2.bbb.png', size: 26931, modified: 1, used_by: ['2 этаж'] },
  ];
  const deleted = [];
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/plans/list') return { plans: serverPlans };
    if (m.type === 'houseplan/plans/delete') {
      const p = serverPlans.find((x) => x.name === m.name);
      if (p?.used_by.length) { const e = new Error('in_use'); e.code = 'in_use'; throw e; }
      deleted.push(m.name);
      serverPlans = serverPlans.filter((x) => x.name !== m.name);
      return { ok: true, removed: true };
    }
    if (m.type === 'houseplan/content/sign') {
      const urls = {}; for (const p of m.paths) urls[p] = p + '?authSig=X'; return { urls };
    }
    return base(m);
  } };
  window.confirm = () => true;

  // пространство без плана — как после отцепления
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, source: 'file', planUrl: null, planFile: null };
  await c.updateComplete;
  out.saveBlockedWithoutPlan = !!sr().querySelector('.dialog .btn.on[disabled]');

  // открываем список сохранённых
  await c._toggleServerPlans();
  await new Promise((r) => setTimeout(r, 60));
  await c.updateComplete;
  const rows = [...sr().querySelectorAll('.savedplan')];
  out.listed = rows.length;
  out.showsUsage = (rows[1]?.textContent || '').includes('2 этаж');
  out.deleteDisabledForUsed = !!rows[1]?.querySelector('.btn.danger[disabled]');
  out.deleteEnabledForFree = !rows[0]?.querySelector('.btn.danger[disabled]');
  out.thumbnailSigned = (rows[0]?.querySelector('img')?.getAttribute('src') || '').includes('authSig=');

  // выбираем свободный план — он подставляется в диалог
  c._useServerPlan(serverPlans[0].url);
  await new Promise((r) => setTimeout(r, 80));
  await c.updateComplete;
  out.picked = c._spaceDialog.planUrl === '/api/houseplan/content/plans/_/f1.aaa.png';
  out.listClosed = !c._spaceDialog.pickSaved;
  out.saveEnabledAfterPick = !sr().querySelector('.dialog .btn.on[disabled]');

  // удаление: занятый нельзя, свободный можно
  await c._toggleServerPlans();
  await new Promise((r) => setTimeout(r, 60));
  await c._deleteServerPlan('f2.bbb.png').catch(() => {});
  out.usedNotDeleted = !deleted.includes('f2.bbb.png');
  await c._deleteServerPlan('f1.aaa.png');
  await c.updateComplete;
  out.freeDeleted = deleted.includes('f1.aaa.png');
  out.rowGone = !(c._spaceDialog.saved || []).some((p) => p.name === 'f1.aaa.png');
  return out;
});
// зафиксировано прогоном на v1.47.0 и сверено с кодом
checkAll(res, {
  saveBlockedWithoutPlan: true,
  listed: 2,
  showsUsage: true,
  deleteDisabledForUsed: true,
  deleteEnabledForFree: true,
  thumbnailSigned: true,
  picked: true,
  listClosed: true,
  saveEnabledAfterPick: true,
  usedNotDeleted: true,
  freeDeleted: true,
  rowGone: true,
});
await finish(browser);
