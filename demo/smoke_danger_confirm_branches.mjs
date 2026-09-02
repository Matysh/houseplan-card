// #402: подтверждение опасного действия не принадлежит ни одной ветке
// render(). Раньше `hp-confirm` рендерился только в финальной ветке цепочки
// ранних return, и в онбординге («ещё нет ни одного пространства») кнопка
// удаления плана была мертва: диалог не появлялся, промис не разрешался
// никогда. Отдельный файл, а не дополнение smoke_danger_confirmation:
// там оснастка проверяет матрицу мутаций и держит открытыми неполные
// фикстуры диалогов, а здесь нужен чистый рендер.
import { launch, checkAll, finish } from './serve.mjs';

// Touch-эмуляция намеренно: `docs/TOUCH-SUPPORT.md` § Safety floor запрещает
// «best effort» в обходе подтверждения разрушающего действия, а сломанная
// ветка пробивала этот пол одинаково на мыши и на пальце. Проверяем там, где
// он обязан держаться.
const { page, browser } = await launch(
  { width: 390, height: 760 }, 1, [], { hasTouch: true, isMobile: true },
);

// Hold the first German chunk request so the card remains in the real `warm`
// language gate long enough to exercise it. Aborting would immediately select
// the English fallback and could turn this into a test that never enters the
// branch it claims to cover.
const germanAsset = /\/houseplan-assets\/de-[^/?]+\.js(?:\?.*)?$/;
let releaseGerman;
let markGermanStarted;
let markGermanCompleted;
const germanStarted = new Promise((resolve) => { markGermanStarted = resolve; });
const germanCompleted = new Promise((resolve) => { markGermanCompleted = resolve; });
const holdGerman = async (route) => {
  markGermanStarted();
  await new Promise((resolve) => { releaseGerman = resolve; });
  await route.continue();
  markGermanCompleted();
};
await page.route(germanAsset, holdGerman);

const warmGate = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const originalLanguage = card._config?.language;
  card._config = { ...card._config, language: 'de' };
  card.requestUpdate();
  for (let attempt = 0; attempt < 50 && card._dangerConfirmLocaleGate !== 'warm'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await settle();
  }

  const entered = card._dangerConfirmLocaleGate === 'warm' && card.inert;
  const before = root().innerHTML;
  const decision = await Promise.race([
    card._confirmDanger({
      key: 'warm-language-gate',
      kind: 'destructive',
      title: 'Delete?',
      message: 'The plan and all its rooms will be deleted.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    }),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
  ]);
  const result = {
    warmLanguageGateActuallyEntered: entered,
    warmLanguageGateRefusesImmediately: decision === false,
    warmLanguageGateKeepsControllerEmpty: card._dangerConfirm === null
      && card._dangerConfirmController.state === null,
    warmLanguageGateKeepsNoChangeDom: root().innerHTML === before
      && !root().querySelector('hp-confirm'),
  };

  card._config = { ...card._config, language: originalLanguage };
  card.requestUpdate();
  await settle();
  return result;
});

await Promise.race([
  germanStarted,
  new Promise((_, reject) => setTimeout(() => reject(new Error('German locale request not seen')), 1000)),
]);
releaseGerman();
await germanCompleted;
await page.unroute(germanAsset, holdGerman);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const settleElement = async (element) => {
    await element.updateComplete;
    const shell = element.querySelector('hp-dialog');
    if (shell) await shell.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const deepActiveElement = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const directConfirm = async (kind, action, key) => {
    const element = document.createElement('hp-confirm');
    element.token = Math.floor(Math.random() * 1_000_000) + 1;
    element.request = {
      key,
      kind,
      title: kind === 'destructive' ? 'Delete?' : 'Unlock?',
      message: kind === 'destructive'
        ? 'The plan and all its rooms will be deleted.'
        : 'House Plan will send an unlock command.',
      confirmLabel: kind === 'destructive' ? 'Delete' : 'Unlock',
      cancelLabel: 'Cancel',
    };
    const decision = new Promise((resolve) => element.addEventListener(
      'hp-confirm-decision', (event) => resolve(event.detail.accepted), { once: true },
    ));
    document.body.append(element);
    await settleElement(element);
    const shell = element.querySelector('hp-dialog');
    const native = shell?.shadowRoot?.querySelector('dialog');
    const body = element.querySelector('.danger-confirm-body');
    const cancel = element.querySelector('button[autofocus]');
    const semantics = native?.getAttribute('role') === 'alertdialog'
      && native.getAttribute('aria-describedby') === body?.id
      && !!body?.textContent?.trim();
    const focused = deepActiveElement() === cancel;
    const stayedNative = !!native && !shell?.shadowRoot?.querySelector('ha-dialog');
    if (action === 'escape') {
      cancel?.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, composed: true, cancelable: true,
      }));
    } else {
      cancel?.click();
    }
    const accepted = await decision;
    element.remove();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return { semantics, focused, stayedNative, cancelled: accepted === false };
  };
  const dialogs = () => root().querySelectorAll('hp-confirm').length;
  const request = (key) => ({
    key,
    kind: 'destructive',
    title: card._t('confirm.delete_plan_title'),
    message: card._t('confirm.delete_plan_body'),
    confirmLabel: card._t('btn.delete'),
    cancelLabel: card._t('btn.cancel'),
  });
  const decide = async (accepted) => {
    const element = root().querySelector('hp-confirm');
    element?.dispatchEvent(new CustomEvent('hp-confirm-decision', {
      detail: { token: card._dangerConfirm.token, accepted },
      bubbles: true,
      composed: true,
    }));
    await settle();
  };

  await settle();

  result.standaloneStartsWithoutHaDialog = !customElements.get('ha-dialog');
  const noHaDestructive = await directConfirm('destructive', 'click', 'no-ha-delete');
  result.noHaDestructiveIsDescribedAlert = noHaDestructive.semantics;
  result.noHaDestructiveFocusesCancel = noHaDestructive.focused;
  result.noHaDestructiveCancelResolvesFalse = noHaDestructive.cancelled;
  const noHaWarning = await directConfirm('warning', 'escape', 'no-ha-unlock');
  result.noHaWarningIsDescribedAlert = noHaWarning.semantics;
  result.noHaWarningFocusesCancel = noHaWarning.focused;
  result.noHaWarningEscapeResolvesFalse = noHaWarning.cancelled;

  // Основная ветка: ровно один диалог, а не два (риск двойного рендера при
  // выносе — если бы блок остался и в ветке, и в обёртке).
  const single = card._confirmDanger(request('single'));
  await settle();
  result.mainBranchRendersExactlyOneConfirm = dialogs() === 1;
  card._cancelDangerConfirm();
  result.mainBranchCancelResolvesFalse = (await single) === false;

  const savedCfg = card._serverCfg;
  const savedModel = card._model;
  const enterBranch = async (spaces) => {
    card._serverCfg = { ...savedCfg, spaces };
    card._model = spaces.length ? savedModel : [];
    card._cfgEpoch += 1;
    card.requestUpdate();
    await settle();
  };
  const leaveBranch = async () => {
    card._serverCfg = savedCfg;
    card._model = savedModel;
    card._cfgEpoch += 1;
    card.requestUpdate();
    await settle();
  };

  // Ветка онбординга — буквальный сценарий issue: здесь живёт корзина
  // сохранённого плана.
  await enterBranch([]);
  result.onboardingBranchIsActuallyEntered = !root().querySelector('.stage');
  const onboarding = card._confirmDanger(request('onboarding'));
  await settle();
  result.onboardingBranchShowsConfirm = dialogs() === 1;
  await decide(false);
  result.onboardingBranchResolves = (await onboarding) === false;
  await leaveBranch();

  // Открытое подтверждение переживает смену ветки: раньше оно исчезало вместе
  // с веткой, оставляя вызывающего с неразрешённым промисом.
  const survivor = card._confirmDanger(request('survivor'));
  await settle();
  const openedInMainBranch = dialogs() === 1;
  await enterBranch([]);
  const stillOpenInOnboarding = dialogs() === 1;
  await decide(true);
  result.openConfirmSurvivesBranchChange = openedInMainBranch && stillOpenInOnboarding
    && (await survivor) === true;
  await leaveBranch();

  // The exact missed branch from #417: a non-empty model whose active space
  // cannot be resolved returns `nothing`, unlike onboarding and fixed-floor
  // status cards. An already open request must be cancelled during the same
  // update, and a new request must never enter the controller.
  const originalSpaceModel = card._spaceModel;
  const pendingAtSpaceLoss = card._confirmDanger(request('space-lost-after-open'));
  await settle();
  card._spaceModel = () => undefined;
  card.requestUpdate();
  await settle();
  const spaceLossDecision = await Promise.race([
    pendingAtSpaceLoss,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
  ]);
  result.lostSpaceBranchIsActuallyEntered = root().childElementCount === 0;
  result.openConfirmCancelsWhenSpaceIsLost = spaceLossDecision === false
    && card._dangerConfirm === null && card._dangerConfirmController.state === null;
  const refusedWithoutSpace = await Promise.race([
    card._confirmDanger(request('space-already-lost')),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
  ]);
  result.lostSpaceRequestRefusesImmediately = refusedWithoutSpace === false
    && card._dangerConfirm === null && card._dangerConfirmController.state === null
    && dialogs() === 0;
  card._spaceModel = originalSpaceModel;
  card.requestUpdate();
  await settle();

  // The two status branches called out by #402 still paint a card, so they
  // must keep hosting the confirmation instead of being caught by the new
  // lost-space guard.
  const originalConfig = card._config;
  const originalLoadOk = card._loadOk;
  const confirmInFixedBranch = async (loadOk, state) => {
    card._loadOk = loadOk;
    card._config = { ...originalConfig, floor: 'missing-floor-for-confirm-smoke' };
    card.requestUpdate();
    await settle();
    const branchEntered = !!root().querySelector(`[data-fixed-floor-state="${state}"]`);
    const pending = card._confirmDanger(request(`fixed-${state}`));
    await settle();
    const shown = dialogs() === 1;
    await decide(false);
    return branchEntered && shown && (await pending) === false;
  };
  result.fixedFloorPendingStillShowsConfirm = await confirmInFixedBranch(false, 'pending');
  result.fixedFloorInvalidStillShowsConfirm = await confirmInFixedBranch(true, 'invalid');
  card._loadOk = originalLoadOk;
  card._config = originalConfig;
  card.requestUpdate();
  await settle();

  // Тап по «Отмена» — тот же путь, что и клик: на touch подтверждение обязано
  // спрашиваться, а не деградировать (TOUCH-SUPPORT § Safety floor).
  await enterBranch([]);
  const byTap = card._confirmDanger(request('touch'));
  await settle();
  const tapDialog = root().querySelector('hp-confirm');
  // Кнопки живут в hp-dialog внутри hp-confirm; «Отмена» — первая в футере
  // (она же с autofocus, см. #32 §6.1).
  const footer = tapDialog?.renderRoot?.querySelector('.danger-confirm-footer')
    || tapDialog?.shadowRoot?.querySelector('.danger-confirm-footer');
  const cancelButton = footer?.querySelector('button');
  const tapPoint = cancelButton?.getBoundingClientRect();
  if (cancelButton && tapPoint) {
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      cancelButton.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
        clientX: tapPoint.left + tapPoint.width / 2,
        clientY: tapPoint.top + tapPoint.height / 2,
        bubbles: true, composed: true, cancelable: true,
      }));
    }
  }
  await settle();
  result.touchTapOnCancelResolvesFalse = !!cancelButton && (await byTap) === false
    && dialogs() === 0;
  await leaveBranch();

  // Соседние подтверждения остались в основной ветке и не поехали за компанию.
  const source = card.constructor.toString?.() || '';
  result.neighbourConfirmsUntouched = card._tapConfirm === null
    && card._vacCalConfirm === null && typeof source === 'string';

  // Неготовая карточка отказывает сразу: подвесить запрос — это и есть дефект.
  const savedHass = card.hass;
  card.hass = undefined;
  const refused = card._confirmDanger(request('not-ready'));
  card.hass = savedHass;
  card.requestUpdate();
  await settle();
  result.notReadyCardRefusesInsteadOfHanging = (await refused) === false;

  // Match the public surface of HA's pinned ha-dialog closely enough to prove
  // branch selection and ARIA forwarding without depending on private shadow
  // DOM. Alert confirmations must still avoid it: the pinned component does
  // not forward its reflected `type` to the actual dialog role.
  class HaDialogStub extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = '<slot name="headerTitle"></slot>'
        + '<slot></slot><slot name="footer"></slot>';
    }
    connectedCallback() {
      queueMicrotask(() => this.dispatchEvent(new Event('opened')));
    }
  }
  customElements.define('ha-dialog', HaDialogStub);

  const ordinary = document.createElement('hp-dialog');
  ordinary.title = 'Ordinary device editor';
  ordinary.describedBy = 'ordinary-description';
  ordinary.innerHTML = '<p id="ordinary-description">Ordinary dialog description</p>';
  document.body.append(ordinary);
  await ordinary.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const haShell = ordinary.shadowRoot.querySelector('ha-dialog');
  result.ordinaryDialogUsesHaBranch = !!haShell
    && !ordinary.shadowRoot.querySelector('dialog');
  result.ordinaryDialogForwardsHaAria = haShell?.ariaLabelledBy?.startsWith('hp-dialog-title-')
    && haShell?.ariaDescribedBy === 'ordinary-description';
  ordinary.remove();

  const haDestructive = await directConfirm('destructive', 'click', 'ha-delete');
  result.haDestructiveStaysNativeAlert = haDestructive.semantics
    && haDestructive.stayedNative;
  result.haDestructiveFocusesCancel = haDestructive.focused;
  result.haDestructiveCancelResolvesFalse = haDestructive.cancelled;
  const haWarning = await directConfirm('warning', 'escape', 'ha-unlock');
  result.haWarningStaysNativeAlert = haWarning.semantics && haWarning.stayedNative;
  result.haWarningFocusesCancel = haWarning.focused;
  result.haWarningEscapeResolvesFalse = haWarning.cancelled;

  return result;
});

Object.assign(out, warmGate);

await page.evaluate(async () => {
  const element = document.createElement('hp-confirm');
  element.token = 4_060_000;
  element.request = {
    key: 'accessibility-probe', kind: 'destructive', title: 'Accessibility probe',
    message: 'All rooms in this plan will be permanently deleted.',
    confirmLabel: 'Delete', cancelLabel: 'Cancel',
  };
  document.body.append(element);
  await element.updateComplete;
  await element.querySelector('hp-dialog')?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const accessibilitySnapshot = await page.getByRole('alertdialog', {
  name: 'Accessibility probe',
}).ariaSnapshot();
out.realAccessibilityTreeIncludesConsequence = accessibilitySnapshot
  .includes('All rooms in this plan will be permanently deleted.');
await page.evaluate(() => document.querySelector('hp-confirm')?.remove());

checkAll(out);
await finish(browser, out);
