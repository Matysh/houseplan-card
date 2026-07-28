// HP-1454-01: загруженный SVG — пользовательский контент, который Home Assistant
// отдаёт со своего origin. Внутри карточки он подключён через <image>, где
// скрипты не выполняются, но тот же URL, открытый как отдельный документ,
// становится живым документом этого origin: <script> в нём получает доступ к
// localStorage сессии и к API. Проверяем, что заголовок sandbox это снимает,
// и что обычный SVG при этом продолжает отображаться.
import { chromium } from 'playwright';
import { check, finish } from './serve.mjs';

const EVIL = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="#eee"/>
  <script>
    document.title = 'HOUSEPLAN_XSS_EXECUTED';
    try { localStorage.setItem('hp_xss', 'executed'); } catch (e) {}
  </script>
</svg>`;

// ровно тот набор, который отдаёт HouseplanContentView для .svg
const CSP = "sandbox; default-src 'none'; script-src 'none'; object-src 'none'; "
  + "base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src data:";

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext();

async function serve(page, { csp }) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.endsWith('/evil.svg')) {
      const headers = { 'Content-Type': 'image/svg+xml', 'X-Content-Type-Options': 'nosniff' };
      if (csp) headers['Content-Security-Policy'] = CSP;
      return route.fulfill({ status: 200, headers, body: EVIL });
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>host</body></html>' });
  });
}

// 1) как было до фикса: скрипт исполняется в origin Home Assistant
const before = await ctx.newPage();
await serve(before, { csp: false });
await before.goto('https://ha.example/api/houseplan/content/plans/_/evil.svg');
await before.waitForTimeout(200);
const noCsp = await before.evaluate(() => ({
  title: document.title,
  storage: (() => { try { return localStorage.getItem('hp_xss'); } catch (e) { return 'blocked'; } })(),
}));

// 2) с заголовком: opaque origin, скрипт не выполняется, storage недоступен
const after = await ctx.newPage();
await serve(after, { csp: true });
await after.goto('https://ha.example/api/houseplan/content/plans/_/evil.svg');
await after.waitForTimeout(200);
const withCsp = await after.evaluate(() => ({
  title: document.title,
  storage: (() => { try { return localStorage.getItem('hp_xss'); } catch (e) { return 'blocked'; } })(),
}));

// 3) тот же файл как <image> внутри страницы — рисуется и без скрипта
const card = await ctx.newPage();
await serve(card, { csp: true });
await card.goto('https://ha.example/');
const drawn = await card.evaluate(async () => {
  const img = new Image();
  const ok = await new Promise((res) => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = '/api/houseplan/content/plans/_/evil.svg';
  });
  return { loaded: ok, width: img.naturalWidth, title: document.title };
});

check('без CSP скрипт выполняется (иначе тест ничего не доказывает)', noCsp.title, 'HOUSEPLAN_XSS_EXECUTED');
check('без CSP скрипт пишет в storage origin', noCsp.storage, 'executed');
check('с CSP скрипт не выполняется', withCsp.title !== 'HOUSEPLAN_XSS_EXECUTED', true);
check('с CSP storage origin недоступен', withCsp.storage !== 'executed', true);
check('SVG по-прежнему грузится как картинка', drawn.loaded, true);
check('и имеет размеры', drawn.width, 100);
check('картинка ничего не выполнила на странице-хосте', drawn.title, '');
await finish(browser);
