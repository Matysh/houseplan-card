// #140: opening and physical-object properties share the existing medium
// dialog shell.  Measure real localized buttons rather than merely checking
// the `wide` attribute, because the contract is usable spare width plus safe
// wrapping when the viewport becomes narrow.
import { launch, checkAll, finish } from './serve.mjs';

const DESKTOP_WIDTH = 1000;
const NARROW_WIDTH = 320;
const { page, browser } = await launch({ width: DESKTOP_WIDTH, height: 820 }, 1);

const desktop = await page.evaluate(async () => {
  const card = window.__card;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const settleLanguage = async (language) => {
    for (let attempt = 0; language === 'de' && card._t('btn.save') !== 'Speichern'
      && attempt < 50; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  };
  card._serverStorage = true;
  card._serverCfg = {
    spaces: [{
      id: 'dialog-layout', title: 'Dialog layout', cell_cm: 5,
      view_box: [0, 0, 1, 1], rooms: [], settings: {},
    }],
    markers: [], settings: {},
  };
  card._space = 'dialog-layout';
  card._mode = 'plan';
  card._modelCache = null;
  card._saveConfig = () => {};
  await settle();

  const layout = (kind, language) => {
    const root = card.shadowRoot || card.renderRoot;
    const dialog = root.querySelector('hp-dialog');
    const surface = dialog?.shadowRoot?.querySelector('.surface');
    const footer = dialog?.querySelector('.dialog-action-footer');
    const danger = footer?.querySelector('.dialog-action-danger');
    const commit = footer?.querySelector('.dialog-action-commit');
    const surfaceRect = surface?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const dangerRect = danger?.getBoundingClientRect();
    const commitRect = commit?.getBoundingClientRect();
    const buttons = [...(footer?.querySelectorAll('button') || [])];
    const innerWidth = footerRect && footerStyle
      ? footerRect.width - parseFloat(footerStyle.paddingLeft) - parseFloat(footerStyle.paddingRight)
      : 0;
    const contentWidth = (dangerRect?.width || 0) + (commitRect?.width || 0);
    return {
      kind,
      language,
      widePreset: dialog?.wide === true && dialog.hasAttribute('wide'),
      surfaceWidth: Number((surfaceRect?.width || 0).toFixed(2)),
      innerWidth: Number(innerWidth.toFixed(2)),
      contentWidth: Number(contentWidth.toFixed(2)),
      spareWidth: Number((innerWidth - contentWidth).toFixed(2)),
      buttons: buttons.length,
      oneRow: !!dangerRect && !!commitRect && Math.abs(dangerRect.top - commitRect.top) <= 1,
      noHorizontalOverflow: !!surface && !!footer
        && surface.scrollWidth <= surface.clientWidth + 1
        && footer.scrollWidth <= footer.clientWidth + 1,
    };
  };

  const open = async (kind, language) => {
    card._config = { ...(card._config || {}), language };
    card._openingDialog = null;
    card._physicalDialog = null;
    card._spaceDialog = null;
    if (kind === 'opening') {
      card._openingDialog = {
        id: 'opening-1', type: 'door', lengthCm: 90,
        contact: '', lock: '', invert: false, flipH: false, flipV: false,
        x: 200, y: 200, angle: 0,
      };
    } else if (kind === 'physical') {
      card._physicalDialog = {
        kind: 'partition', id: 'partition-1', cm: '12', length: '1 m',
      };
    } else {
      card._openSpaceDialog('edit', 'dialog-layout');
    }
    await settle();
    await settleLanguage(language);
    const result = layout(kind, language);
    card._openingDialog = null;
    card._physicalDialog = null;
    card._spaceDialog = null;
    await settle();
    return result;
  };

  const metrics = [];
  for (const language of ['en', 'ru', 'de']) {
    metrics.push(await open('opening', language));
    metrics.push(await open('physical', language));
  }
  const space = await open('space', 'ru');
  return { metrics, space };
});

await page.setViewportSize({ width: NARROW_WIDTH, height: 820 });

const narrow = await page.evaluate(async () => {
  const card = window.__card;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const settleLanguage = async (language) => {
    for (let attempt = 0; language === 'de' && card._t('btn.save') !== 'Speichern'
      && attempt < 50; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  };
  const measure = async (kind, language = 'ru') => {
    card._config = { ...(card._config || {}), language };
    card._openingDialog = null;
    card._physicalDialog = null;
    card._spaceDialog = null;
    if (kind === 'opening') {
      card._openingDialog = {
        id: 'opening-1', type: 'door', lengthCm: 90,
        contact: '', lock: '', invert: false, flipH: false, flipV: false,
        x: 200, y: 200, angle: 0,
      };
    } else if (kind === 'physical') {
      card._physicalDialog = {
        kind: 'partition', id: 'partition-1', cm: '12', length: '1 m',
      };
    } else if (kind === 'draft') {
      card._physicalDialog = {
        kind: 'draft', id: 'draft-1', segment: 0, cm: '12', length: '1 m',
      };
    } else {
      card._openSpaceDialog('edit', 'dialog-layout');
    }
    await settle();
    await settleLanguage(language);
    const root = card.shadowRoot || card.renderRoot;
    const dialog = root.querySelector('hp-dialog');
    const surface = dialog?.shadowRoot?.querySelector('.surface');
    const footer = dialog?.querySelector('.dialog-action-footer');
    const danger = footer?.querySelector('.dialog-action-danger');
    const commit = footer?.querySelector('.dialog-action-commit');
    const surfaceRect = surface?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const dangerRect = danger?.getBoundingClientRect();
    const commitRect = commit?.getBoundingClientRect();
    const innerLeft = footerRect && footerStyle
      ? footerRect.left + parseFloat(footerStyle.paddingLeft) : 0;
    const innerRight = footerRect && footerStyle
      ? footerRect.right - parseFloat(footerStyle.paddingRight) : 0;
    const buttons = [...(footer?.querySelectorAll('button') || [])];
    const result = {
      kind,
      language,
      surfaceWidth: Number((surfaceRect?.width || 0).toFixed(2)),
      insideViewport: !!surfaceRect && surfaceRect.left >= -1
        && surfaceRect.right <= innerWidth + 1,
      noHorizontalOverflow: !!surface && !!footer
        && surface.scrollWidth <= surface.clientWidth + 1
        && footer.scrollWidth <= footer.clientWidth + 1,
      buttonsContained: !!footerRect && buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= innerLeft - 1 && rect.right <= innerRight + 1
          && rect.top >= footerRect.top - 1 && rect.bottom <= footerRect.bottom + 1;
      }),
      wrapped: !!dangerRect && !!commitRect && commitRect.top >= dangerRect.bottom - 1,
      buttons: buttons.length,
    };
    card._openingDialog = null;
    card._physicalDialog = null;
    card._spaceDialog = null;
    await settle();
    return result;
  };
  return {
    opening: await measure('opening'),
    physical: await measure('physical'),
    draft: await measure('draft'),
    space: await measure('space'),
    opening_de: await measure('opening', 'de'),
    physical_de: await measure('physical', 'de'),
    space_de: await measure('space', 'de'),
  };
});

const checks = {};
for (const metric of desktop.metrics) {
  const key = `${metric.kind}_${metric.language}`;
  checks[`${key}_medium_shell`] = metric.widePreset
    && metric.surfaceWidth >= 499 && metric.surfaceWidth <= 501;
  checks[`${key}_three_actions_one_row`] = metric.buttons === 3 && metric.oneRow;
  checks[`${key}_positive_localization_headroom`] = metric.spareWidth > 0;
  checks[`${key}_no_horizontal_overflow`] = metric.noHorizontalOverflow;
}
checks.space_dialog_still_uses_medium_shell = desktop.space.widePreset
  && desktop.space.surfaceWidth >= 499 && desktop.space.surfaceWidth <= 501;
checks.space_dialog_footer_not_regressed = desktop.space.buttons === 3
  && desktop.space.oneRow && desktop.space.noHorizontalOverflow;

for (const kind of ['opening', 'physical', 'opening_de', 'physical_de']) {
  const metric = narrow[kind];
  checks[`${kind}_narrow_fits_viewport`] = metric.surfaceWidth <= NARROW_WIDTH * 0.94 + 1
    && metric.insideViewport && metric.noHorizontalOverflow && metric.buttonsContained;
  checks[`${kind}_narrow_keeps_responsive_wrap`] = metric.buttons === 3 && metric.wrapped;
}
checks.draft_four_actions_remain_contained = narrow.draft.buttons === 4
  && narrow.draft.insideViewport && narrow.draft.noHorizontalOverflow
  && narrow.draft.buttonsContained;
checks.space_narrow_not_regressed = narrow.space.buttons === 3
  && narrow.space.insideViewport && narrow.space.noHorizontalOverflow
  && narrow.space.buttonsContained;
checks.space_de_narrow_not_regressed = narrow.space_de.buttons === 3
  && narrow.space_de.insideViewport && narrow.space_de.noHorizontalOverflow
  && narrow.space_de.buttonsContained;

checkAll(checks);
await finish(browser, {
  checks,
  desktop: {
    dialogs: desktop.metrics,
    longest: desktop.metrics.reduce((longest, metric) => (
      metric.contentWidth > longest.contentWidth ? metric : longest
    )),
    space: desktop.space,
  },
  narrow,
});
