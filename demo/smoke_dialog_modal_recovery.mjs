// #463: native hp-dialog is a real, centred top-layer modal throughout its
// lifecycle.  This is deliberately a production-bundle smoke: Lit updates,
// HTMLDialogElement top-layer state, ::backdrop and late custom-element
// registration cannot be proved by a pure DOM shim.
import { launch, checkAll, finish } from './serve.mjs';

const DESKTOP = { width: 800, height: 600 };
const NARROW = { width: 320, height: 720 };
const { page, browser } = await launch(DESKTOP);

const desktop = await page.evaluate(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const settle = async (element) => {
    await element.updateComplete;
    await element.querySelector('hp-dialog')?.updateComplete;
    await frame();
    await frame();
  };
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const backdropAlpha = (dialog) => {
    const color = getComputedStyle(dialog, '::backdrop').backgroundColor;
    if (!color || color === 'transparent') return 0;
    const values = color.match(/[\d.]+/g)?.map(Number) || [];
    return values.length >= 4 ? values.at(-1) : 1;
  };
  const geometry = (host) => {
    const native = host.shadowRoot?.querySelector('dialog');
    const surface = host.shadowRoot?.querySelector('.surface');
    const shellCount = host.shadowRoot?.querySelectorAll('dialog, ha-dialog').length || 0;
    const dialogRect = native?.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const centred = !!surfaceRect
      && Math.abs((surfaceRect.left + surfaceRect.right) / 2 - innerWidth / 2) <= 1
      && Math.abs((surfaceRect.top + surfaceRect.bottom) / 2 - innerHeight / 2) <= 1;
    return {
      native,
      oneShell: shellCount === 1,
      openModal: native?.open === true && native.matches(':modal'),
      centred,
      shrinkWrapped: !!dialogRect && !!surfaceRect
        && Math.abs(dialogRect.width - surfaceRect.width) <= 1
        && Math.abs(dialogRect.height - surfaceRect.height) <= 1,
      backdropVisible: !!native && backdropAlpha(native) > 0,
      noOverflow: !!surface
        && surface.scrollWidth <= surface.clientWidth + 1
        && document.documentElement.scrollWidth <= innerWidth + 1,
    };
  };

  // Exact user surface: hp-confirm forces the native alert branch even when
  // Home Assistant provides ha-dialog.
  const confirm = document.createElement('hp-confirm');
  confirm.token = 463001;
  confirm.request = {
    key: 'dialog-modal-contract',
    kind: 'destructive',
    title: 'Delete unfinished contour?',
    message: 'The unfinished contour will be removed.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };
  const decision = new Promise((resolve) => confirm.addEventListener(
    'hp-confirm-decision', (event) => resolve(event.detail.accepted), { once: true },
  ));
  document.body.append(confirm);
  await settle(confirm);
  const confirmShell = confirm.querySelector('hp-dialog');
  const confirmGeometry = geometry(confirmShell);
  const confirmCancel = confirm.querySelector('button[autofocus]');
  const confirmFocused = deepActive() === confirmCancel;
  confirmCancel?.click();
  const confirmCancelled = await decision === false;
  confirm.remove();
  await frame();

  // An ordinary dialog starts on the native fallback because ha-dialog is
  // intentionally registered only in the second half of this smoke.
  const opener = document.createElement('button');
  opener.id = 'hp-463-opener';
  opener.textContent = 'Open dialog';
  document.body.append(opener);
  opener.focus();

  const lifecycle = document.createElement('hp-dialog');
  lifecycle.id = 'hp-463-lifecycle';
  lifecycle.title = 'Lifecycle recovery';
  lifecycle.innerHTML = '<button autofocus>First action</button>';
  let lifecycleCloseCount = 0;
  lifecycle.addEventListener('hp-close', () => {
    lifecycleCloseCount += 1;
    lifecycle.remove();
  });
  document.body.append(lifecycle);
  await settle(lifecycle);
  const initialGeometry = geometry(lifecycle);
  const native = initialGeometry.native;

  // Reproduce the independently confirmed open-but-nonmodal state. update()
  // must recover the same physical shell without reporting a user close.
  let showModalCalls = 0;
  const realShowModal = native.showModal.bind(native);
  native.showModal = () => {
    showModalCalls += 1;
    return realShowModal();
  };
  native.close();
  native.show();
  const becameOpenNonmodal = native.open && !native.matches(':modal');
  lifecycle.requestUpdate();
  await settle(lifecycle);
  const afterUpdate = geometry(lifecycle);
  const updateRecoveredSameShell = afterUpdate.native === native
    && afterUpdate.openModal && afterUpdate.centred && afterUpdate.oneShell;
  const updateRecoveryWasBounded = showModalCalls === 1;
  lifecycle.requestUpdate();
  await settle(lifecycle);
  const stableUpdateDoesNotRetry = showModalCalls === 1;

  // Removing a modal from the document drops it from the top layer while the
  // open attribute can survive. Reconnecting the same host must repair that
  // exact native node and must not synthesize hp-close.
  lifecycle.remove();
  const detachedLostTopLayer = !native.matches(':modal');
  document.body.append(lifecycle);
  await settle(lifecycle);
  const afterReconnect = geometry(lifecycle);
  const reconnectRecoveredSameShell = afterReconnect.native === native
    && afterReconnect.openModal && afterReconnect.centred && afterReconnect.oneShell;
  const reconnectRestoresInitialFocus = deepActive() === lifecycle.querySelector('[autofocus]');
  const recoveryDidNotClose = lifecycleCloseCount === 0;

  // A shrink-wrapped native shell still owns the entire viewport scrim hit
  // target through the top layer. A content click stays inside; a click on the
  // outer dialog follows dismissOnScrim and preserves the close/focus contract.
  lifecycle.dismissOnScrim = true;
  lifecycle.requestUpdate();
  await settle(lifecycle);
  lifecycle.shadowRoot.querySelector('.surface')?.click();
  const surfaceClickDoesNotDismiss = lifecycleCloseCount === 0;
  native.click();
  await frame();
  await frame();
  const closeContractSurvives = lifecycleCloseCount === 1
    && !lifecycle.isConnected && deepActive() === opener;

  // Top-layer ordering must remain intact when a native parent opens an alert
  // confirmation. Escape closes only the top alert, then the parent.
  opener.focus();
  const parent = document.createElement('hp-dialog');
  parent.title = 'Native parent';
  parent.innerHTML = '<button autofocus>Parent action</button>';
  let parentCloseCount = 0;
  parent.addEventListener('hp-close', () => {
    parentCloseCount += 1;
    parent.remove();
  });
  document.body.append(parent);
  await settle(parent);
  const child = document.createElement('hp-confirm');
  child.token = 463002;
  child.request = {
    key: 'nested-dialog-order', kind: 'warning', title: 'Nested alert',
    message: 'Close only this alert first.', confirmLabel: 'Continue', cancelLabel: 'Cancel',
  };
  const childDecision = new Promise((resolve) => child.addEventListener(
    'hp-confirm-decision', (event) => resolve(event.detail.accepted), { once: true },
  ));
  document.body.append(child);
  await settle(child);
  const childNative = child.querySelector('hp-dialog')?.shadowRoot?.querySelector('dialog');
  const nestedStartIsTwoModals = parent.shadowRoot.querySelector('dialog')?.matches(':modal')
    && childNative?.matches(':modal');
  deepActive()?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  const childCancelled = await childDecision === false;
  child.remove();
  await frame();
  await frame();
  const firstEscapeClosedOnlyAlert = childCancelled && parentCloseCount === 0
    && parent.shadowRoot.querySelector('dialog')?.matches(':modal')
    && deepActive() === parent.querySelector('[autofocus]');
  deepActive()?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await frame();
  await frame();
  const secondEscapeClosedParent = parentCloseCount === 1 && !parent.isConnected;

  // Keep a second pre-registration ordinary dialog open. It must not switch
  // branch when ha-dialog is defined later.
  opener.focus();
  const early = document.createElement('hp-dialog');
  early.id = 'hp-463-early-native';
  early.title = 'Opened before HA';
  early.innerHTML = '<button autofocus>Keep open</button>';
  document.body.append(early);
  await settle(early);
  const earlyNative = early.shadowRoot.querySelector('dialog');
  earlyNative.__hp463Identity = true;

  return {
    confirmHasOneNativeShell: confirmGeometry.oneShell,
    confirmIsTopLayerModal: confirmGeometry.openModal,
    confirmSurfaceIsCentred: confirmGeometry.centred && confirmGeometry.shrinkWrapped,
    confirmBackdropIsVisible: confirmGeometry.backdropVisible,
    confirmFocusAndCancelWork: confirmFocused && confirmCancelled,
    standardFallbackStartsCentred: initialGeometry.oneShell && initialGeometry.openModal
      && initialGeometry.centred && initialGeometry.shrinkWrapped && initialGeometry.noOverflow,
    artificialOpenNonmodalWasCreated: becameOpenNonmodal,
    updateRecoversSameNativeShell: updateRecoveredSameShell,
    updateRecoveryRunsOnce: updateRecoveryWasBounded && stableUpdateDoesNotRetry,
    detachActuallyDropsTopLayer: detachedLostTopLayer,
    reconnectRecoversSameNativeShell: reconnectRecoveredSameShell,
    reconnectRestoresInitialFocus,
    recoveryNeverEmitsClose: recoveryDidNotClose,
    shrinkWrappedScrimKeepsDismissContract: surfaceClickDoesNotDismiss
      && closeContractSurvives,
    nestedNativeEscapeKeepsTopLayerOrder: nestedStartIsTwoModals
      && firstEscapeClosedOnlyAlert && secondEscapeClosedParent,
    earlyFallbackReadyForLateRegistration: !!earlyNative
      && earlyNative.matches(':modal') && geometry(early).centred,
  };
});

await page.setViewportSize(NARROW);

const narrowAndLateRegistration = await page.evaluate(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const settle = async (element) => {
    await element.updateComplete;
    await element.querySelector('hp-dialog')?.updateComplete;
    await frame();
    await frame();
  };
  const centred = (host) => {
    const surface = host.shadowRoot?.querySelector('.surface');
    const rect = surface?.getBoundingClientRect();
    return !!rect
      && Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) <= 1
      && Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) <= 1;
  };

  const early = document.querySelector('#hp-463-early-native');
  const originalNative = early.shadowRoot.querySelector('dialog');
  early.wide = true;
  early.requestUpdate();
  await settle(early);
  const surface = early.shadowRoot.querySelector('.surface');
  const surfaceRect = surface.getBoundingClientRect();
  const wideFitsNarrowViewport = early.wide && originalNative.matches(':modal')
    && centred(early)
    && surfaceRect.width <= innerWidth * 0.94 + 1
    && surfaceRect.height <= innerHeight * 0.92 + 1
    && surfaceRect.left >= -1 && surfaceRect.right <= innerWidth + 1
    && surface.scrollWidth <= surface.clientWidth + 1
    && originalNative.scrollWidth <= originalNative.clientWidth + 1;

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
  await frame();
  await frame();

  const earlyStillNative = early.shadowRoot.querySelector('dialog') === originalNative
    && originalNative.__hp463Identity === true
    && originalNative.matches(':modal')
    && !early.shadowRoot.querySelector('ha-dialog')
    && centred(early);

  const lateOrdinary = document.createElement('hp-dialog');
  lateOrdinary.title = 'Opened after HA';
  lateOrdinary.innerHTML = '<button autofocus>HA action</button>';
  document.body.append(lateOrdinary);
  await settle(lateOrdinary);
  const newOrdinaryUsesOneHaShell = lateOrdinary.shadowRoot.querySelectorAll('ha-dialog').length === 1
    && !lateOrdinary.shadowRoot.querySelector('dialog');

  const lateAlert = document.createElement('hp-dialog');
  lateAlert.alert = true;
  lateAlert.title = 'Alert after HA';
  lateAlert.innerHTML = '<button autofocus>Native action</button>';
  document.body.append(lateAlert);
  await settle(lateAlert);
  const alertNative = lateAlert.shadowRoot.querySelector('dialog');
  const alertAfterHaStaysOneNativeModal = lateAlert.shadowRoot
    .querySelectorAll('dialog, ha-dialog').length === 1
    && !!alertNative?.matches(':modal') && centred(lateAlert);

  lateAlert.remove();
  lateOrdinary.remove();
  early.remove();
  await frame();
  await frame();

  return {
    wideNativeFallbackFitsAndCentresOnNarrowViewport: wideFitsNarrowViewport,
    openFallbackDoesNotSwitchAfterLateHaRegistration: earlyStillNative,
    newOrdinaryUsesExactlyOneHaShell: newOrdinaryUsesOneHaShell,
    alertAfterHaStillUsesExactlyOneNativeModal: alertAfterHaStaysOneNativeModal,
  };
});

const out = { ...desktop, ...narrowAndLateRegistration };
checkAll(out);
await finish(browser, out);
