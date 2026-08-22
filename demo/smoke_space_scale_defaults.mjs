// Issue #239: defaults, unit projection and lossless canonical cell_cm edits.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 920, height: 820 });

const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.renderRoot;
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  };
  const setLocale = async (length, language = 'en') => {
    card.hass = {
      ...card.hass,
      language,
      locale: { ...(card.hass.locale || {}), language },
      config: {
        ...(card.hass.config || {}),
        unit_system: { ...(card.hass.config?.unit_system || {}), length },
      },
    };
    await update();
  };
  const fieldState = () => {
    const input = root().querySelector('hp-dialog .colorrow input.namein.tempin');
    const unit = input?.parentElement?.querySelector('.opl');
    return {
      value: input?.value,
      min: input?.getAttribute('min'),
      max: input?.getAttribute('max'),
      unit: unit?.textContent?.trim(),
      canonical: card._spaceDialog?.cellCm,
      touched: card._spaceDialog?.cellCmTouched,
    };
  };
  const openCreate = async () => {
    card._spaceDialog = null;
    card._openSpaceDialog('create');
    await update();
  };
  const saveCreate = async (title) => {
    card._spaceDialog = { ...card._spaceDialog, title, source: 'draw' };
    await card._saveSpaceDialog();
    await update();
    return card._serverCfg.spaces.find((space) => space.title === title)?.cell_cm;
  };
  const saveImportPair = async (prefix) => {
    card._spaceDialog = null;
    card._importQueue = [`${prefix} A`, `${prefix} B`];
    card._importTotal = 2;
    card._openNextImport();
    await update();
    const firstDraft = card._spaceDialog?.cellCm;
    card._spaceDialog = { ...card._spaceDialog, source: 'draw' };
    await card._saveSpaceDialog();
    await update();
    const secondDraft = card._spaceDialog?.cellCm;
    card._spaceDialog = { ...card._spaceDialog, source: 'draw' };
    await card._saveSpaceDialog();
    await update();
    return {
      drafts: [firstDraft, secondDraft],
      saved: [`${prefix} A`, `${prefix} B`].map((title) =>
        card._serverCfg.spaces.find((space) => space.title === title)?.cell_cm),
    };
  };

  await setLocale('km', 'en');
  await openCreate();
  const metricEn = fieldState();
  const metricCanonicalBeforeLanguage = card._spaceDialog.cellCm;
  await setLocale('km', 'ru');
  const metricRu = fieldState();
  const metricLanguageLossless = card._spaceDialog.cellCm === metricCanonicalBeforeLanguage;
  await setLocale('km', 'en');
  const metricManualSaved = await saveCreate('Scale metric manual');
  const metricFloors = await saveImportPair('Scale metric floor');

  await setLocale('mi', 'en');
  await openCreate();
  const imperialEn = fieldState();
  const input = root().querySelector('hp-dialog .colorrow input.namein.tempin');
  input.value = '2';
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await update();
  const imperialInput = fieldState();
  await openCreate();
  const imperialManualSaved = await saveCreate('Scale imperial manual');
  const imperialFloors = await saveImportPair('Scale imperial floor');

  const exact = 3.141592653589793;
  card._serverCfg.spaces.push(
    { id: 'scale-existing-five', title: 'Existing five', plan_url: null, view_box: [0, 0, 1, 1], rooms: [], cell_cm: 5 },
    { id: 'scale-existing-fraction', title: 'Existing fraction', plan_url: null, view_box: [0, 0, 1, 1], rooms: [], cell_cm: exact },
    { id: 'scale-existing-missing', title: 'Existing missing', plan_url: null, view_box: [0, 0, 1, 1], rooms: [] },
  );

  const editAndSave = async (id, languageRerender = false) => {
    card._openSpaceDialog('edit', id);
    await update();
    const opened = fieldState();
    const canonicalBefore = card._spaceDialog.cellCm;
    if (languageRerender) {
      await setLocale('mi', 'ru');
      await setLocale('mi', 'en');
    }
    const canonicalAfterLanguage = card._spaceDialog.cellCm;
    await card._saveSpaceDialog();
    await update();
    return {
      opened,
      canonicalStableAcrossLanguage: canonicalAfterLanguage === canonicalBefore,
      saved: card._serverCfg.spaces.find((space) => space.id === id)?.cell_cm,
    };
  };
  const existingFive = await editAndSave('scale-existing-five');
  const existingFraction = await editAndSave('scale-existing-fraction', true);
  const existingMissing = await editAndSave('scale-existing-missing');

  return {
    metricEnglishField: metricEn.value === '1' && metricEn.min === '0.1'
      && metricEn.max === '1000' && metricEn.unit === 'cm per cell'
      && metricEn.canonical === 1 && metricEn.touched === false,
    metricRussianField: metricRu.value === '1' && metricRu.unit === 'см на клетку',
    metricLanguageRerenderKeepsCanonical: metricLanguageLossless,
    metricManualCreateStoresOneCm: metricManualSaved === 1,
    metricFloorImportUsesOneCm: JSON.stringify(metricFloors) === JSON.stringify({
      drafts: [1, 1], saved: [1, 1],
    }),
    imperialEnglishField: imperialEn.value === '1' && imperialEn.min === '0.03937'
      && imperialEn.max === '393.700787' && imperialEn.unit === 'in per cell'
      && imperialEn.canonical === 2.54 && imperialEn.touched === false,
    imperialInputConvertsToCanonicalCm: imperialInput.value === '2'
      && imperialInput.canonical === 5.08 && imperialInput.touched === true,
    imperialManualCreateStoresOneInch: imperialManualSaved === 2.54,
    imperialFloorImportUsesOneInch: JSON.stringify(imperialFloors) === JSON.stringify({
      drafts: [2.54, 2.54], saved: [2.54, 2.54],
    }),
    existingFiveUntouchedIsLossless: existingFive.opened.value === '1.968504'
      && existingFive.opened.touched === false && existingFive.saved === 5,
    existingFractionUntouchedIsLossless: existingFraction.opened.value === '1.236848'
      && existingFraction.opened.touched === false
      && existingFraction.canonicalStableAcrossLanguage && existingFraction.saved === exact,
    missingCellUsesLegacyFiveAndMaterializesFive: existingMissing.opened.canonical === 5
      && existingMissing.opened.value === '1.968504' && existingMissing.saved === 5,
  };
});

checkAll(out);
await finish(browser, out);
