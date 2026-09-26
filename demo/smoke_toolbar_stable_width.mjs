// #647/#660: основная панель — нет счётчика устройств, крестик редактора в
// постоянном слоте внутри группы режимов, ширина шапки и группы не меняются,
// выходе и переключении редакторов; кликабельная зона × не меньше 24 × 24
// (#195); × виден на обычных ширинах (721–1100 px — там раньше скрывался
// счётчик). Режимы переключаются настоящими кнопками через фасад #629;
// приватные поля карточки только читаются.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1400, height: 820 }, 1);

const WIDTHS = [1400, 1200, 1000, 768, 620, 481, 390];
const out = {};

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 820 });
  const r = await page.evaluate(async (width) => {
    const o = {};
    const c = window.__card;
    const hp = window.__hpTest;
    const sr = () => c.shadowRoot || c.renderRoot;
    const head = () => sr().querySelector('.head');
    const slot = () => sr().querySelector('.editor-close-slot');
    const cross = () => sr().querySelector('.editor-close-slot .closex');
    // #616: на ≤ 480 px кнопки режимов живут в меню шестерёнки; соседи × в строке —
    // вкладки пространств, зум и шестерёнка, их положение и меряется.
    const phone = width <= 480;
    const tabs = () => [...sr().querySelectorAll(phone
      ? '.head > .tabs, .head > .zoomctl, [data-hp="header-menu"]' : '[data-hp="mode-tab"]')];
    await hp.setMode('view');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Позиции — относительно левого края шапки: прокрутка страницы их не меняет.
    const measure = () => {
      const origin = head().getBoundingClientRect().left;
      const modes = sr().querySelector('.modes');
      const zoom = sr().querySelector('.zoomctl');
      const modesBox = modes?.getBoundingClientRect();
      const zoomBox = zoom?.getBoundingClientRect();
      const active = modes?.querySelector('.modetab.active');
      return {
        head: head().getBoundingClientRect().width,
        modesLeft: modesBox ? modesBox.left - origin : null,
        modesWidth: modesBox?.width ?? null,
        zoomLeft: zoomBox ? zoomBox.left - origin : null,
        gap: modesBox && zoomBox ? zoomBox.left - modesBox.right : null,
        slot: slot()?.getBoundingClientRect(),
        slotInside: slot()?.parentElement === modes,
        slotOrder: c._mode === 'view'
          ? slot() === modes?.lastElementChild
          : slot()?.previousElementSibling === active,
      };
    };
    const visibleTabs = tabs().filter((t) => t.getBoundingClientRect().width > 0).length === 3
      && (!phone || [...sr().querySelectorAll('[data-hp="mode-tab"]')].every((t) => !t.getClientRects().length));
    o.tabsVisible = visibleTabs;

    // AC1: числа нет — ни узла, ни текста вида «N dev.».
    o.noHeaderCount = !head().querySelector('.count')
      && !/\d+\s*(dev\.|устр\.)/.test(head().textContent || '');

    // AC4 (вне редактора): слот пуст, не фокусируется, скрыт от скринридера.
    const idle = measure();
    o.idleSlotInert = !!slot() && !cross()
      && slot().getAttribute('aria-hidden') === 'true'
      && !slot().querySelector('button, [tabindex], a, input');
    o.idleSlotKeepsSize = !!idle.slot && Math.abs(idle.slot.width - 24) <= 0.5 && Math.abs(idle.slot.height - 24) <= 0.5;

    const same = (a, b) => Math.abs(a.head - b.head) <= 1
      && Math.abs(a.modesLeft - b.modesLeft) <= 1
      && Math.abs(a.modesWidth - b.modesWidth) <= 1
      && Math.abs(a.zoomLeft - b.zoomLeft) <= 1;
    const steps = [];
    const hits = [];
    // View → каждый редактор → View, и прямые переключения между редакторами.
    for (const sequence of [['plan', 'view'], ['devices', 'view'], ['decor', 'view'], ['plan', 'devices', 'decor', 'plan', 'view']]) {
      for (const next of sequence) {
        await hp.setMode(next);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const now = measure();
        const expectedGap = width <= 620 ? 40.5 : 50;
        steps.push({ next, stable: same(idle, now), inside: now.slotInside,
          order: now.slotOrder, gap: phone || Math.abs(now.gap - expectedGap) <= 1 });
        if (next !== 'view' && cross()) {
          // На 390 px карточка демо-стенда шире окна (так и на dev) — докрутить × в видимую область.
          cross().scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const rect = cross().getBoundingClientRect();
          const centre = sr().elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          hits.push({
            visible: rect.width >= 24 && rect.height >= 24 && getComputedStyle(cross()).display !== 'none',
            centreHitsCross: !!centre && (centre === cross() || cross().contains(centre)),
            glyph13: getComputedStyle(cross().querySelector('ha-icon')).getPropertyValue('--mdc-icon-size').trim() === '13px',
            noCrossInTabs: !sr().querySelector('.modetab .closex'),
          });
        }
      }
    }
    // AC2/AC3: ширина шапки, группы режимов и контрола справа стабильны.
    o.widthAndTabsStable = steps.every((s) => s.stable);
    o.closeSlotLivesInsideModes = idle.slotInside && idle.slotOrder
      && steps.every((s) => s.inside && s.order);
    o.modeToZoomGapMatchesSpec = (phone || Math.abs(idle.gap - (width <= 620 ? 40.5 : 50)) <= 1)
      && steps.every((s) => s.gap);
    // AC5/AC6: × виден, ≥ 24 × 24, глиф 13 px, центр слота — это ×, кнопки режимов без ×.
    o.crossVisibleAndSized = hits.length === 7 && hits.every((h) => h.visible && h.glyph13);
    o.crossHitTarget = hits.every((h) => h.centreHitsCross);
    o.noCrossInsideTabs = hits.every((h) => h.noCrossInTabs);

    // AC4/AC5: клик в точку в 10 px от центра глифа по горизонтали закрывает редактор.
    await hp.setMode('devices');
    cross().scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const rect = cross().getBoundingClientRect();
    const x = rect.left + rect.width / 2 - 10;
    const y = rect.top + rect.height / 2;
    const edge = sr().elementFromPoint(x, y);
    edge?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: x, clientY: y }));
    await hp.settled();
    o.edgeClickCloses = sr().querySelector('ha-card')?.getAttribute('data-hp-mode') === 'view';

    // AC7: нового горизонтального overflow шапки нет.
    o.noHeadOverflow = head().scrollWidth <= head().clientWidth + 1;
    o.width = width;
    return o;
  }, width);
  for (const [key, value] of Object.entries(r)) if (key !== 'width') out[`w${width}_${key}`] = value;
}

// AC1 в русской локали на широком окне.
await page.setViewportSize({ width: 1400, height: 820 });
out.ru_noHeaderCount = await page.evaluate(async () => {
  const c = window.__card;
  c.hass = { ...c.hass, language: 'ru', locale: { ...(c.hass.locale || {}), language: 'ru' } };
  await window.__hpTest.settled();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const head = (c.shadowRoot || c.renderRoot).querySelector('.head');
  return !head.querySelector('.count') && !/\d+\s*устр\./.test(head.textContent || '');
});

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
