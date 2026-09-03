// #162: карты робота живут на разных этажах, док — на своём.
//
// Смок проверяет ровно то, чего не мог проверить ни один прежний: раньше
// маркер робота отбирался по пространству дока, поэтому на другом этаже
// оверлея не существовало в принципе.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const out = await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const sr = () => c.shadowRoot || c.renderRoot;
  const M1 = [0.5, 0, 0, 0, 0.5, 0];
  const M2 = [0.25, 0, 0, 0, 0.25, 0];
  const attrs = (mapName) => ({ vacuum_position: { x: 600, y: 800, a: 45 }, map_name: mapName });

  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'vacuum.robo': { entity_id: 'vacuum.robo', platform: 'demo', disabled_by: null },
      'camera.robo_map': { entity_id: 'camera.robo_map', platform: 'demo', disabled_by: null } },
    states: { ...c.hass.states,
      'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Робот' } },
      'camera.robo_map': { state: 'idle', attributes: attrs('m1') },
    } };
  const cfg = c._serverCfg;
  cfg.markers = cfg.markers || [];
  cfg.markers.push({
    id: 'e_vacuum_robo', binding: 'entity:vacuum.robo', space: 'f1',
    vacuum: {
      source: 'camera.robo_map',
      map_routes: [
        { id: 'vr1', source: 'camera.robo_map', map_id: 'm1', space: 'f1', calibration: M1 },
        { id: 'vr2', source: 'camera.robo_map', map_id: 'm2', space: 'garden', calibration: M2 },
      ],
    },
  });
  c._layout['e_vacuum_robo'] = { s: 'f1', x: 0.1, y: 0.1 };
  c._regSignature = '';
  c._setMode('view');
  c._space = 'f1';
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));

  const puck = () => sr().querySelector('.vacpuck');
  const dock = () => sr().querySelector('.dev[data-id="e_vacuum_robo"]');
  const warn = () => sr().querySelector('.vacwarn');

  // Карта m1 → первый этаж: робот и док на одном этаже, как и раньше.
  o.floor1DockThere = !!dock();
  o.floor1PuckThere = !!puck();
  o.floor1NoWarning = !warn();

  // Робот переехал на карту m2 → второй этаж.
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: attrs('m2') } } };
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.floor1DockStays = !!dock();
  o.floor1PuckGone = !puck();

  c._space = 'garden';
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.floor2PuckThere = !!puck();
  o.floor2NoDock = !dock();

  // Возврат на m1 возвращает картину без единой правки конфигурации.
  const before = JSON.stringify(c._serverCfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum);
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: attrs('m1') } } };
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.floor2PuckGoneAfterReturn = !puck();
  c._space = 'f1';
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.floor1PuckBack = !!puck();
  o.routesUntouched = JSON.stringify(
    c._serverCfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum) === before;

  // Несопоставленная карта: нигде не рисуем, но у дока говорим почему.
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: attrs('m9') } } };
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.unmappedNoPuck = !puck();
  o.unmappedWarns = !!warn();
  o.unmappedWarnLabelled = !!warn()?.getAttribute('aria-label');
  c._space = 'garden';
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.unmappedNoGhostOnOtherFloor = !puck();

  // Донастройка матрицы с высоким residual обязана открыться на этаже
  // МАРШРУТА: она решалась против его геометрии, а не геометрии дока.
  c._space = 'f1';
  c._setMode('devices');
  await c.updateComplete; await new Promise((r) => setTimeout(r, 120));
  c._vacCalConfirm = {
    markerId: 'e_vacuum_robo', source: 'camera.robo_map', mapId: 'm2',
    routeId: 'vr2', space: 'garden', matrix: M2, rooms: 3, error: '80 см',
  };
  await c.updateComplete;
  c._vacApplyCalibrationProposal(true);
  await c.updateComplete; await new Promise((r) => setTimeout(r, 80));
  o.manualFitSwitchedToRouteSpace = c._space === 'garden';
  o.manualFitKeepsRoute = c._vacFit?.routeId === 'vr2';
  c._vacFit = null;
  c._setMode('view');
  c._space = 'f1';
  await c.updateComplete; await new Promise((r) => setTimeout(r, 80));

  // Робот встал — предупреждение снимается: тревожить нечем.
  c._space = 'f1';
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Робот' } } } };
  await c.updateComplete; await new Promise((r) => setTimeout(r, 60));
  o.dockedNoWarning = !warn();

  return o;
});

checkAll(out, {
  floor1DockThere: true, floor1PuckThere: true, floor1NoWarning: true,
  floor1DockStays: true, floor1PuckGone: true,
  floor2PuckThere: true, floor2NoDock: true,
  floor2PuckGoneAfterReturn: true, floor1PuckBack: true, routesUntouched: true,
  unmappedNoPuck: true, unmappedWarns: true, unmappedWarnLabelled: true,
  unmappedNoGhostOnOtherFloor: true,
  manualFitSwitchedToRouteSpace: true, manualFitKeepsRoute: true,
  dockedNoWarning: true,
});
await finish(browser);
