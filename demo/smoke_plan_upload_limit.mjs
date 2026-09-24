// #617: план загружается по HTTP, а предел 8 МБ проверяется до отправки.
// До задачи план уходил base64 в WebSocket-кадре: файл больше ~3 МиБ давал
// кадр больше 4 МиБ, Home Assistant закрывал сокет, и человек видел обрыв
// соединения вместо сообщения. Здесь на настоящем бандле проверяется: 5 МиБ
// уходит одним POST на /api/houseplan/plans/upload и ни одним plan/set (AC1);
// SVG больше предела отклоняется при выборе с тостом «8» (AC2); растр больше
// предела получает диалог #39 только с уменьшенной копией, а слишком большая
// уменьшенная копия не попадает в staging (AC3); 413 сервера показывает
// предел и оставляет диалог открытым (AC5); онбординг идёт тем же путём (AC8).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card;
  const out = {};
  const MAX = 8 * 1024 * 1024;
  const waitFor = async (predicate, timeout = 8000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };

  const base = c.hass.callWS;
  const fetches = [];
  let fetchMode = 'ok';
  let wsPlanSet = 0;
  let configSets = 0;
  c.hass = { ...c.hass, fetchWithAuth: async (url, init) => {
    const file = init?.body?.get?.('file');
    const space = init?.body?.get?.('space_id');
    fetches.push({ url, method: init?.method, space, ext: init?.body?.get?.('ext'), size: file?.size, file });
    if (fetchMode === '413') {
      return { ok: false, status: 413, json: async () => ({ error: 'too_large', max_mb: 8 }) };
    }
    return { ok: true, status: 200, json: async () => ({
      ok: true, url: `/api/houseplan/content/plans/_/${space}.t${fetches.length}.png`,
    }) };
  }, callWS: async (m) => {
    if (m.type === 'houseplan/plan/set') { wsPlanSet++; throw new Error('plan/set must not be used'); }
    if (m.type === 'houseplan/config/set') {
      configSets++;
      c.__sent = m.config;
      return { ok: true, rev: 500 + configSets };
    }
    if (m.type === 'houseplan/config/get') {
      const r = await base(m);
      return { ...r, config: JSON.parse(JSON.stringify(r.config)) };
    }
    return base(m);
  } };

  const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const ascii = (t) => [...t].map((ch) => ch.charCodeAt(0));
  /** PNG до конца IHDR и нули до нужного размера: проба читает только заголовок. */
  const pngOfSize = (w, h, size) => {
    const bytes = new Uint8Array(size);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...u32(13), ...ascii('IHDR'), ...u32(w), ...u32(h), 8, 2, 0, 0, 0, ...u32(0)], 0);
    return bytes;
  };
  const guardDialog = () => [...c.renderRoot.querySelectorAll('hp-dialog')]
    .find((d) => [c._t('backdrop.large_title'), c._t('backdrop.too_large_title')]
      .includes(String(d.title || ''))) || null;
  const guardButtons = () => [...(guardDialog()?.querySelectorAll('.row button') || [])];
  const hasButton = (key) => guardButtons().some((b) => b.textContent.includes(c._t(key)));

  await c._ensureEditorRuntime();
  const openEdit = async () => {
    c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
    c._spaceDialog = { ...c._spaceDialog, title: 'Ground', source: 'file', planFile: null };
    await c.updateComplete;
  };
  const sameBytes = async (a, b) => {
    if (!a || !b || a.size !== b.size) return false;
    const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]).then((r) => r.map((v) => new Uint8Array(v)));
    return x.every((v, i) => v === y[i]);
  };
  const pick = (file, runtime = null) => (runtime || c)._pickPlanFile({ target: { files: [file], value: 'x' } });

  // ── AC1: 5 МиБ растр (проба safe) → один POST, ни одного plan/set ─────────
  await openEdit();
  const fiveMiB = new File([pngOfSize(1000, 800, 5 * 1024 * 1024)], 'photo.png', { type: 'image/png' });
  await pick(fiveMiB);
  out.fiveMiBStagedWithoutGuard = await waitFor(() => c._spaceDialog?.planFile?.blob === fiveMiB)
    && !c._backdropGuard;
  await c._saveSpaceDialog(); await c.updateComplete;
  out.fiveMiBOnePost = fetches.length === 1 && fetches[0].url === '/api/houseplan/plans/upload'
    && fetches[0].method === 'POST' && fetches[0].space === 'f1' && fetches[0].ext === 'png';
  out.fiveMiBBytesSent = fetches[0]?.size === 5 * 1024 * 1024 && await sameBytes(fetches[0]?.file, fiveMiB);
  out.editorPlanSetCalls = wsPlanSet;
  const f1 = (c.__sent?.spaces || []).find((s) => s.id === 'f1');
  out.planUrlFromResponse = f1?.plan_url === '/api/houseplan/content/plans/_/f1.t1.png';
  out.dialogClosedAfterSave = c._spaceDialog === null;

  // ── AC2: SVG больше предела — тост с «8», staging пуст, запросов нет ──────
  await openEdit();
  const before2 = { fetches: fetches.length, ws: wsPlanSet, sets: configSets };
  c._toast = '';
  const bigSvg = new File([new Uint8Array(MAX + 1)], 'plan.svg', { type: 'image/svg+xml' });
  await pick(bigSvg);
  out.svgToastNamesLimit = c._toast === c._t('toast.plan_too_large', { mb: 8 }) && c._toast.includes('8');
  out.svgNotStaged = c._spaceDialog?.planFile === null && !c._backdropGuard;
  out.svgNoRequests = fetches.length === before2.fetches && wsPlanSet === before2.ws
    && configSets === before2.sets;
  // ровно предел — не отклоняется (граница включительная)
  const exactSvg = new File([new Uint8Array(MAX)], 'plan.svg', { type: 'image/svg+xml' });
  await pick(exactSvg);
  out.svgAtLimitStaged = await waitFor(() => c._spaceDialog?.planFile?.blob === exactSvg);
  c._spaceDialog = { ...c._spaceDialog, planFile: null };

  // ── AC3: растр больше предела → диалог #39 только с уменьшенной копией ────
  const src = new OffscreenCanvas(3000, 2000);
  const ctx = src.getContext('2d');
  ctx.fillStyle = '#c81e1e'; ctx.fillRect(0, 0, 3000, 2000);
  const jpeg = await src.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  // хвост после EOI Chromium игнорирует при декодировании — файл честно больше предела
  const bigRaster = new File([jpeg, new Uint8Array(MAX + 1 - jpeg.size)], 'scan.jpg', { type: 'image/jpeg' });
  out.bigRasterIsOverLimit = bigRaster.size === MAX + 1;
  await pick(bigRaster);
  await waitFor(() => !!c._backdropGuard); await c.updateComplete;
  const bodyText = guardDialog()?.textContent || '';
  out.guardOpened = !!c._backdropGuard && c._backdropGuard.probe.kind === 'safe';
  out.guardHidesOriginal = !hasButton('backdrop.keep_original');
  out.guardOffersReduced = hasButton('backdrop.use_downscaled');
  out.guardBodyNamesLimit = bodyText.includes(c._t('backdrop.over_limit_body', { fileMb: '8.0', mb: 8 }));
  guardButtons().find((b) => b.textContent.includes(c._t('backdrop.use_downscaled')))?.click();
  out.reducedStaged = await waitFor(() => !!c._spaceDialog?.planFile && !c._backdropGuard, 15000);
  out.reducedWithinLimit = (c._spaceDialog?.planFile?.blob?.size ?? Infinity) <= MAX
    && /-reduced\.jpg$/.test(c._spaceDialog?.planFile?.name || '');
  c._spaceDialog = { ...c._spaceDialog, planFile: null };

  // уменьшенная копия всё ещё больше предела (подменённый результат кодирования)
  const realConvert = OffscreenCanvas.prototype.convertToBlob;
  OffscreenCanvas.prototype.convertToBlob = async function () {
    return new Blob([new Uint8Array(MAX + 1)], { type: 'image/jpeg' });
  };
  c._toast = '';
  await pick(bigRaster);
  await waitFor(() => !!c._backdropGuard); await c.updateComplete;
  guardButtons().find((b) => b.textContent.includes(c._t('backdrop.use_downscaled')))?.click();
  out.oversizedReducedToast = await waitFor(() =>
    c._toast === c._t('toast.plan_too_large', { mb: 8 }) && !c._backdropGuard, 15000);
  out.oversizedReducedNotStaged = c._spaceDialog?.planFile === null;
  OffscreenCanvas.prototype.convertToBlob = realConvert;

  // ── AC5: сервер ответил 413 → тост с пределом, диалог открыт, config/set нет
  fetchMode = '413';
  const sets5 = configSets;
  c._toast = '';
  c._spaceDialog = { ...c._spaceDialog, planFile: {
    ext: 'png', blob: new Blob([new Uint8Array(16)]), aspect: 1.5, name: 'p.png' } };
  await c._saveSpaceDialog(); await c.updateComplete;
  out.serverTooLargeToast = c._toast === c._t('toast.error', { err: c._t('err.too_large', { mb: 8 }) });
  out.serverTooLargeDialogOpen = !!c._spaceDialog && c._spaceDialog.busy === false;
  out.serverTooLargeNoConfigSet = configSets === sets5;
  fetchMode = 'ok';
  c._spaceDialog = null; await c.updateComplete;

  // ── AC8: онбординг — тот же хелпер загрузки и та же проверка предела ─────
  await c._ensureOnboardingRuntime();
  const onboarding = c._onboardingRuntime;
  onboarding._openSpaceDialog('create'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Attic', source: 'file', planFile: null };
  c._toast = '';
  await pick(bigSvg, onboarding);
  out.onboardingSvgToast = c._toast === c._t('toast.plan_too_large', { mb: 8 })
    && c._spaceDialog?.planFile === null;
  const fetches8 = fetches.length;
  const ws8 = wsPlanSet;
  const onboardFile = new File([pngOfSize(640, 480, 4 * 1024 * 1024)], 'attic.png', { type: 'image/png' });
  await pick(onboardFile, onboarding);
  await waitFor(() => c._spaceDialog?.planFile?.blob === onboardFile);
  await onboarding._saveSpaceDialog(); await c.updateComplete;
  out.onboardingOnePost = fetches.length === fetches8 + 1
    && fetches[fetches.length - 1].url === '/api/houseplan/plans/upload'
    && await sameBytes(fetches[fetches.length - 1].file, onboardFile);
  out.onboardingPlanSetCalls = wsPlanSet - ws8;
  const attic = (c.__sent?.spaces || []).find((s) => s.title === 'Attic');
  out.onboardingPlanUrlFromResponse = !!attic
    && attic.plan_url === `/api/houseplan/content/plans/_/${attic.id}.t${fetches.length}.png`;

  c._spaceDialog = null;
  c._backdropGuard = null;
  return out;
});
checkAll(out, { editorPlanSetCalls: 0, onboardingPlanSetCalls: 0 });
await finish(browser, out);
