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

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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

  return result;
});

checkAll(out);
await finish(browser, out);
