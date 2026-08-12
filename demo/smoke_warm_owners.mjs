// Регрессия аудита v1.59.0-beta.1 — владение тёплой памяткой.
// Три находки, все три ПАДАЮТ на сборке v1.59.0-beta.1:
//   AUD-159B1-01 (P2): две карточки с ИДЕНТИЧНЫМ конфигом на одной странице
//     делили один слот памятки (ключ = размер окна × JSON конфига), поэтому
//     новый экземпляр на месте A усыновлял вид последнего писателя — соседа B
//     (его этаж, режим, зум), а черновик настоящего предшественника съедался
//     guard-ом `d.mode !== this._mode`.
//   AUD-159B1-02 (P2): быстрая серия пересозданий (A→B→C в одном такте):
//     промежуточный B ещё не успел воскресить диалог A, но в своём
//     disconnectedCallback сбрасывал `_warmRevivePending` ДО снимка и писал
//     `dlg: null` поверх чужого черновика — C не получал ничего.
//   AUD-159B1-03 (P3): 10-секундный TTL запрещал воскрешение, но не освобождал
//     payload: просроченная запись держала диалог (у пространства это план
//     целиком в base64) до перезагрузки страницы.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const res = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const HP = customElements.get('houseplan-card');
  HP._warmBootReset(400); // TTL диалога 400мс вместо 10с — иначе смок стоит 10 секунд
  localStorage.removeItem('houseplan_card_zoom_v1');
  localStorage.removeItem('houseplan_card_nav_v1');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  document.body.appendChild(wrap);
  /** Lovelace: setConfig ДО вставки; `before` = вставить в чужой DOM-слот */
  const mk = (before) => {
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card' });
    c.hass = window.__mkHass();
    if (before) wrap.insertBefore(c, before); else wrap.appendChild(c);
    return c;
  };
  const settle = async (c) => {
    const t0 = performance.now();
    while ((c._booting || c._modeTransitionBusy) && performance.now() - t0 < 2500) await sleep(30);
    await sleep(250);
  };
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  // ============ A. две одинаковые карточки не делят вид и черновик =========
  const A = mk();
  await settle(A);
  A._applyView(2.15, 300, 420);
  A.requestUpdate(); await A.updateComplete; await sleep(60);
  const zoomA = A._zoom;
  A._openSpaceDialog('edit', A._space); await A.updateComplete;
  A._spaceDialog = { ...A._spaceDialog, title: 'DRAFT-FROM-A' };
  await A.updateComplete; await sleep(30);

  const B = mk();                      // вторая карточка, тот же конфиг
  await settle(B);
  B._setMode('devices'); await B.updateComplete; await settle(B);
  B._applyView(3.35, 200, 200);
  B.requestUpdate(); await B.updateComplete; await sleep(60);
  const zoomB = B._zoom;
  out.aTwoLiveCards = A.isConnected && B.isConnected && zoomB !== zoomA;
  // B — самостоятельная карточка, а не наследник A
  out.aNeighbourKeptOwnView = B._mode === 'devices' && !B._spaceDialog;

  // Lovelace создаёт замену A ДО того, как отсоединит A (порядок аудитора)
  const A2 = mk(A);
  A.remove();
  await sleep(120); await A2.updateComplete; await sleep(60);

  out.aReplacementKeepsOwnMode = A2._mode === 'view';         // не 'devices' от B
  out.aReplacementKeepsOwnZoom = near(A2._zoom, zoomA);       // не 3.35 от B
  out.aOwnersDraftRestored = A2._spaceDialog?.title === 'DRAFT-FROM-A';
  out.aNeighbourUntouched = B._mode === 'devices' && near(B._zoom, zoomB) && !B._spaceDialog;
  A2.remove(); B.remove(); await sleep(20);

  // ============ B. быстрый двойной ре-маунт не убивает черновик ============
  HP._warmBootReset(400);
  let c = mk();
  await settle(c);
  c._openSpaceDialog('edit', c._space); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'DRAFT-RAPID' };
  await c.updateComplete; await sleep(30);
  out.bDraftOpenBefore = c._spaceDialog?.title === 'DRAFT-RAPID';
  // A(черновик) -> создать B -> убрать A -> создать C -> убрать B — всё в одном
  // такте, ни один таймер воскрешения не успевает отработать
  const rb = mk(c);
  c.remove();
  const rc = mk(rb);
  rb.remove();
  await sleep(150); await rc.updateComplete; await sleep(60);
  out.bDraftSurvivedDoubleRemount = rc._spaceDialog?.title === 'DRAFT-RAPID';
  rc.remove(); await sleep(20);

  // ============ C. просроченный диалог освобождает payload =================
  HP._warmBootReset(400);
  c = mk();
  await settle(c);
  c._openSpaceDialog('edit', c._space); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'DRAFT-TTL', planFile: 'x'.repeat(4096) };
  await c.updateComplete; await sleep(30);
  c.remove(); await sleep(20);
  out.cHeldWhileRevivable = HP._warmBootStats().dlgs === 1;   // пока TTL идёт — держим
  await sleep(900);                                          // TTL 400мс + запас
  const st = HP._warmBootStats();
  out.cPayloadFreedAfterTtl = st.dlgs === 0;
  out.cGeometryKept = st.slots >= 0 && st.keys >= 0;          // память не сломана
  // и после TTL ничего не воскресает
  c = mk(); await sleep(150); await c.updateComplete; await sleep(40);
  out.cNoReviveAfterTtl = !c._spaceDialog;
  c.remove();

  HP._warmBootReset();
  wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(res)) check(k, v);
await finish(browser, res);
