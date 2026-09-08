import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 820 });
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.renderRoot;
  const current = card._space;
  const roomId = card._curSpaceCfg.rooms[0].id;
  card._serverCfg = {
    ...card._serverCfg,
    spaces: card._serverCfg.spaces.map((space) => space.id !== current ? space : ({
      ...space,
      settings: { ...(space.settings || {}), fill_mode: 'temp', temp_min: 20, temp_max: 25 },
      rooms: space.rooms.map((room) => room.id !== roomId ? room : ({
        ...room, settings: { ...(room.settings || {}), temp_min: 18 },
      })),
    })),
  };
  card._setMode('plan');
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 300));
  card._openRoomEdit(card._curSpaceCfg.rooms.find((room) => room.id === roomId));
  await card.updateComplete;

  const dialog = root().querySelector('hp-dialog.roomdialog');
  let fields = [...dialog.querySelectorAll('.roomtemprange-fields input')];
  const out = {
    visibleForInheritedTemp: fields.length === 2,
    partialDraftRestored: fields[0]?.value === '18' && fields[1]?.value === '',
    placeholdersFollowSpace: fields[0]?.placeholder === '20' && fields[1]?.placeholder === '25',
    narrowHasNoHorizontalScroll: dialog.scrollWidth <= dialog.clientWidth + 1,
  };

  card._roomTempMin = '0'; card._roomTempMax = '';
  card.requestUpdate(); await card.updateComplete;
  out.zeroIsValid = !root().querySelector('hp-dialog.roomdialog .btn.on')?.disabled;
  card._roomTempMin = 'broken'; card.requestUpdate(); await card.updateComplete;
  out.invalidBlocksSave = root().querySelector('hp-dialog.roomdialog .btn.on')?.disabled === true;

  card._roomTempMin = '19'; card._roomTempMax = '23'; card._roomFill = 'none';
  card.requestUpdate(); await card.updateComplete;
  out.hiddenOutsideTemp = !root().querySelector('.roomtemprange');
  out.hiddenDraftRetained = card._roomTempMin === '19' && card._roomTempMax === '23'
    && card._roomSettingsFromDialog().temp_min === 19
    && card._roomSettingsFromDialog().temp_max === 23;

  card._roomFill = 'temp'; card.requestUpdate(); await card.updateComplete;
  root().querySelector('.roomtemprange-fields .btn')?.click();
  await card.updateComplete;
  fields = [...root().querySelectorAll('.roomtemprange-fields input')];
  out.resetRestoresInheritance = card._roomTempMin === '' && card._roomTempMax === ''
    && fields.every((input) => input.value === '');
  return out;
});

checkAll(result);
await finish(browser, result);
