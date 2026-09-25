// #647: основная панель — нет счётчика устройств, крестик редактора в своём
// слоте, ширина шапки и положение кнопок режимов не меняются при входе,
// выходе и переключении редакторов; кликабельная зона × не меньше 24 × 24
// (#195); × виден на обычных ширинах (721–1100 px — там раньше скрывался
// счётчик). Режимы переключаются настоящими кнопками через фасад #629;
// приватные поля карточки только читаются.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1400, height: 820 }, 1);

const WIDTHS = [1400, 1000, 768, 390];
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
      let nextEl = slot()?.nextElementSibling;
      while (nextEl && !nextEl.getClientRects().length) nextEl = nextEl.nextElementSibling;
      return {
        head: head().getBoundingClientRect().width,
        tabs: tabs().map((t) => t.getBoundingClientRect().left - origin),
        slot: slot()?.getBoundingClientRect(),
        next: nextEl ? nextEl.getBoundingClientRect().left - origin : null,
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
      && a.tabs.every((left, i) => Math.abs(left - b.tabs[i]) <= 1)
      && (a.next === null || Math.abs(a.next - b.next) <= 1);
    const steps = [];
    const hits = [];
    // View → каждый редактор → View, и прямые переключения между редакторами.
    for (const sequence of [['plan', 'view'], ['devices', 'view'], ['decor', 'view'], ['plan', 'devices', 'decor', 'plan', 'view']]) {
      for (const next of sequence) {
        await hp.setMode(next);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const now = measure();
        steps.push({ next, stable: same(idle, now) });
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
    // AC2/AC3: ширина шапки и левые границы кнопок режимов и контрола справа стабильны.
    o.widthAndTabsStable = steps.every((s) => s.stable);
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
