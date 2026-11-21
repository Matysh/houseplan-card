import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width:1000, height:840 }, 1, [], {}, undefined, undefined, '/demo.html?tv-mount=1');
page.setDefaultTimeout(10000);
const mount = page.locator('button[data-action="tv-mount"]:visible');
const undo = page.locator('button[data-action="geometry-undo"]:visible');
const redo = page.locator('button[data-action="geometry-redo"]:visible');
const television = '[data-hp-furniture-volume][data-id="tv"]';
const tvStand = television + ' [data-furniture-part="stand-base"] path[fill="#f7fbfc"]';
const furniture = '.stage.mode-decor .decorlayer path.dfurniturehit[data-id="cabinet"][data-symbol="cabinet_tv"]:visible';

async function savedDecor() {
  return page.evaluate(async () => {
    await window.__hpTest.waitForWrites();
    const result = await window.__mkHass().callWS({ type:'houseplan/config/get' });
    return result.config.spaces.find(space => space.id === 'f1').decor;
  });
}

async function viewStand() {
  await page.locator(tvStand).first().waitFor({state:'attached'});
  return page.locator(tvStand).first().evaluate(path => {
    const point = path.getPointAtLength(0).matrixTransform(path.getCTM());
    return { x:point.x, y:point.y };
  });
}

async function selectCabinet() {
  await page.locator(furniture).waitFor();
  const point = await page.locator(furniture).evaluate(path => {
    const center = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
    return { x:center.x, y:center.y };
  });
  await page.mouse.click(point.x, point.y);
}

try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => {
      const floor = cfg.spaces.find(space => space.id === 'f1');
      floor.settings = { ...floor.settings, show_borders:true };
      floor.decor = [
        { id:'tv', kind:'furniture', symbol:'tv', x:.205, y:.165, w:.09, h:.03, color:'#ab4e72' },
        { id:'cabinet', kind:'furniture', symbol:'cabinet_tv', x:.175, y:.15, w:.15, h:.06 },
      ];
    });
    await window.__hpTest.setVolumetricView();
  });
  const floor = await viewStand();
  await page.evaluate(() => window.__hpTest.setMode('decor'));
  await selectCabinet();
  check('cabinet context offers the mount command', (await mount.textContent()).trim(), 'Place on TV cabinet');
  await mount.click();
  check('mount writes the selected cabinet ID to backend', (await savedDecor())[0].tv_cabinet_id, 'cabinet');
  await undo.click();
  check('undo restores the free television', !Object.hasOwn((await savedDecor())[0], 'tv_cabinet_id'));
  await redo.click();
  check('redo restores the link', (await savedDecor())[0].tv_cabinet_id, 'cabinet');

  await page.evaluate(() => window.__hpTest.setMode('view'));
  const raised = await viewStand();
  check('mounted stand is projected above its former position', raised.y < floor.y - 5);
  check('the cabinet paints before its raised TV even though the TV is stored first', await page.evaluate(() => {
    const root = window.__card.renderRoot;
    const cabinet = root.querySelector('[data-hp-furniture-volume][data-id="cabinet"]');
    const tv = root.querySelector('[data-hp-furniture-volume][data-id="tv"]');
    return !!(cabinet?.compareDocumentPosition(tv) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  await page.evaluate(() => window.__hpTest.setMode('decor'));
  await selectCabinet();
  const originalX = (await savedDecor())[1].x;
  await page.keyboard.press('ArrowRight');
  const moved = await savedDecor();
  check('cabinet moved by the ordinary editor operation', moved[1].x > originalX);
  check('after movement the backend still retains the saved pair', moved[0].tv_cabinet_id, moved[1].id);
  check('the original TV size and style are preserved', [moved[0].w,moved[0].h,moved[0].color], [.09,.03,'#ab4e72']);

  await page.evaluate(() => window.__hpTest.setMode('view'));
  const translated = await viewStand();
  check('the raised TV follows the cabinet in 2.5D', translated.x > raised.x);
  await page.evaluate(() => window.__hpTest.setMode('decor'));
  await selectCabinet();
  check('linked cabinet offers the remove command', (await mount.textContent()).trim(), 'Remove from TV cabinet');
  await mount.click();
  check('remove persists a free television', !Object.hasOwn((await savedDecor())[0], 'tv_cabinet_id'));
  check('the freed television is selected', await page.evaluate(() => window.__card._decorSel), 'tv');
  await undo.click();
  check('undoing removal restores the TV link', (await savedDecor())[0].tv_cabinet_id, 'cabinet');
  check('undoing removal moves the selection and handles to the cabinet', await page.evaluate(() => {
    const card = window.__card;
    const frame = card.renderRoot.querySelector('.dtfurnitureframe .dtbox');
    const cabinet = card._decorList.find(item => item.id === 'cabinet');
    return card._decorSel === cabinet.id && !!frame
      && Math.abs(Number(frame.getAttribute('x')) - cabinet.x * 1000) < .001
      && Math.abs(Number(frame.getAttribute('width')) - cabinet.w * 1000) < .001;
  }));
  await redo.click();
  check('redoing removal returns the TV to the floor', !Object.hasOwn((await savedDecor())[0], 'tv_cabinet_id'));
  await page.evaluate(() => window.__hpTest.setMode('view'));
  const detached = await viewStand();
  check('detaching lowers the TV without losing its new plan position',
    detached.y > translated.y + 5 && Math.abs(detached.x - translated.x) < 1);
} finally {
  await finish(browser);
}
