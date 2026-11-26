import { launchPanelCold, check, finish } from './serve.mjs';
import { mountFirstSpace } from './helpers/first-space.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const floors = ['Ground floor', 'Second floor with a longer name'];
const { page, browser } = await launchPanelCold();
const picker = page.locator('hp-dialog[data-kind="import"]');
const form = page.locator('hp-dialog[data-kind="onboarding"]');
const name = form.locator('input[id$="-title"]');
const save = form.locator('[data-hp="dialog-confirm"]');
const skip = form.locator('[data-action="import-skip"]');
const title = form.locator('.title-text');
const empty = page.locator('[data-hp="empty"]');
const writes = () => page.evaluate(() => window.firstSpaceFixture.calls.filter(x =>
  x.type === 'houseplan/config/set').length);
const waitForWrites = () => page.evaluate(() => window.__hpTest.waitForWrites());
const mount = async (singleFloor = false) => {
  await mountFirstSpace(page, { singleFloor, persistConfig: true, waitHint: false });
  await installHpTestOnPage(page);
};
const persisted = async () => {
  await page.waitForFunction(() => window.__card?._loadOk
    && window.firstSpaceFixture.calls.some(x => x.type === 'houseplan/config/get'));
  return page.evaluate(() => ({
    spaces: window.firstSpaceFixture.config.spaces.map(s => [s.id, s.title, s.plan_url]),
    rendered: window.__card._serverCfg.spaces.map(s => [s.id, s.title, s.plan_url]),
    rev: window.firstSpaceFixture.rev,
  }));
};

try {
  for (const [actions, manual] of [['S'], ['SS'], ['KS'], ['SK'], ['KK'], ['KK', true]]) {
    const label = manual ? 'KK then manual' : actions;
    await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
    await page.reload();
    await mount(actions.length === 1);
    await picker.waitFor();
    check(`${label}: floors selected`, await picker.locator('input:checked').count(), actions.length);
    await picker.locator('[data-hp="dialog-confirm"]').click();
    const expected = [];
    let reachedEnd = true;
    for (const [i, action] of [...actions].entries()) {
      await page.waitForFunction(expected =>
        window.__card.renderRoot.querySelector('hp-dialog[data-kind="onboarding"] input[id$="-title"]')?.value === expected,
      floors[i]);
      check(`${label}: step ${i + 1} and suggested name`,
        (await title.innerText()).includes(`Floor ${i + 1} of ${actions.length}`));
      if (action === 'K') {
        await skip.click();
        continue;
      }
      if (!check(`${label}: save untouched floor ${i + 1}`, await save.isEnabled())) {
        reachedEnd = false;
        break; // Still run the independent all-skip regression against an unpatched build.
      }
      if (actions === 'SS' && i === 0) {
        await page.evaluate(() => { window.firstSpaceFixture.holdNextWrite = true; });
        await save.click();
        await page.waitForFunction(() => typeof window.firstSpaceFixture.releaseWrite === 'function');
        check('pending: Save and Skip disabled', await save.isDisabled() && await skip.isDisabled());
        await save.evaluate(button => { button.click(); button.click(); });
        check('pending: a repeated click does not write', await writes(), 1);
        await page.evaluate(() => window.firstSpaceFixture.releaseWrite());
      } else {
        await save.click();
      }
      expected.push(floors[i]);
    }
    if (!reachedEnd) continue;
    await form.waitFor({ state: 'detached' });
    if (expected.length) {
      await page.locator('ha-card[data-hp-mode="plan"]').waitFor();
      await waitForWrites();
      // Other config writes (e.g. on entry to the editor) can leave the same spaces.
      const spaceTransitions = await page.evaluate(() => window.firstSpaceFixture.calls
        .filter(x => x.type === 'houseplan/config/set')
        .map(x => x.config.spaces.map(s => [s.id, s.title]))
        .filter((s, i, all) => !i || JSON.stringify(s) !== JSON.stringify(all[i - 1]))
        .map(s => s.map(([, floor]) => floor)));
      check(`${label}: saves add exactly one chosen space at a time`, spaceTransitions,
        expected.map((_, i) => expected.slice(0, i + 1)));
      if (actions === 'SS') {
        const beforeEdit = await persisted();
        const writesBeforeEdit = await writes();
        await page.locator('[data-hp="space-settings"]').first().click();
        const edit = page.locator('hp-dialog[data-kind="space"]');
        await edit.waitFor();
        check('existing untouched space cannot be saved', await edit.locator('[data-hp="dialog-confirm"]').isDisabled());
        await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
        await edit.waitFor({ state: 'detached' });
        await waitForWrites();
        check('opening and closing an untouched space does not send a write', await writes(), writesBeforeEdit);
        check('opening and closing an untouched space preserves the stored revision', (await persisted()).rev, beforeEdit.rev);
      }
    } else if (manual) {
      await empty.waitFor();
      check('all skipped: no space or revision written', await persisted(), { spaces: [], rendered: [], rev: 1 });
      await empty.locator('[data-hp="create-space"]').click();
      await form.waitFor();
      check('manual: empty name and no import controls',
        await name.inputValue() === '' && await skip.count() === 0 && !(await title.innerText()).includes('Floor'));
      await name.fill('   ');
      check('manual: whitespace name is not valid', await save.isDisabled());
      await name.fill('Manual plan');
      await save.click();
      await form.waitFor({ state: 'detached' });
      expected.push('Manual plan');
      check('manual: one write', await writes(), 1);
    }
    await waitForWrites();
    const beforeReload = await persisted();
    await page.reload();
    await mount(actions.length === 1);
    const after = await persisted();
    check(`${label}: persisted names and no background image`,
      after.spaces.map(([,floor,url]) => [floor, url]), expected.map(floor => [floor, null]));
    check(`${label}: reload restores exactly the persisted spaces`, after.rendered, after.spaces);
    check(`${label}: distinct space IDs`, new Set(after.spaces.map(([id]) => id)).size, expected.length);
    check(`${label}: reload keeps the last stored revision`, after.rev, beforeReload.rev);
    check(`${label}: reload is read-only`, await writes(), 0);
  }
} finally {
  await finish(browser);
}
