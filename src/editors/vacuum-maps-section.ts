/**
 * Device editor: "Maps and floors" for a multi-floor robot (#162).
 *
 * Lives outside the editor runtime on purpose. The runtime is at its size
 * ceiling (test/core-file-budget.test.mjs), and this block is only ever needed
 * with an opened device dialog, so it belongs in the lazy editor graph rather
 * than in a core file.
 */
import { TemplateResult, html, nothing } from 'lit';
import { langOf } from '../i18n';
import { supportT, type SupportI18nKey } from '../i18n/support';
import { VacuumMapRoute, effectiveRoutes, observedMapIds, resolveRoute } from '../vacuum-routes';
import {
  addRoute, changeRouteSpace, convertLegacyRoutes, newRouteId, removeRoute,
} from '../vacuum-route-edit';

export interface VacuumMapsHost {
  host: any;
  _saveConfig: () => void;
  _vacAutoCalibrate: (dev: any) => void;
  _vacStartFit: (dev: any, routeId?: string) => void;
}

const spaceName = (host: any, spaceId: string): string => {
  const space = (host._serverCfg?.spaces || []).find((item: any) => item?.id === spaceId);
  return String(space?.name || space?.id || spaceId);
};

/**
 * Render the block, and own every routing edit it offers.
 *
 * `setVac` is the same patch writer the rest of the vacuum section uses, so a
 * routing change goes through one save path with everything else.
 */
export function renderVacuumMapsSection(
  runtime: VacuumMapsHost, dev: any, setVac: (patch: Record<string, unknown>) => void,
): TemplateResult | typeof nothing {
  const host = runtime.host;
  const lang = langOf(host.hass, host._config?.language);
  const t = (key: string, vars?: Record<string, string>) => supportT(
    lang, key as SupportI18nKey, vars);
  const vacuum = dev.marker?.vacuum || {};
  const explicit = Array.isArray(vacuum.map_routes) && vacuum.map_routes.length > 0;
  const rootSource: string = host._vacSource(dev) || '';
  const routes: VacuumMapRoute[] = effectiveRoutes(dev.id, vacuum, dev.space, rootSource);
  const spaces: Array<{ id: string; name: string }> = (host._serverCfg?.spaces || [])
    .filter((space: any) => typeof space?.id === 'string' && space.id)
    .map((space: any) => ({ id: space.id, name: String(space.name || space.id) }));
  const spaceIds = new Set(spaces.map((space) => space.id));
  const observed = observedMapIds(routes, [rootSource],
    (source) => host._vacObservedMapId(dev, source));
  const resolution = resolveRoute({ routes, observed, spaceIds });
  const activeId = (resolution.kind === 'ready' || resolution.kind === 'needs_calibration'
    || resolution.kind === 'missing_space') ? resolution.route.id : '';
  const currentMapId = rootSource ? observed[rootSource] : undefined;

  /** Every routing edit converts legacy data first — all of it, or none. */
  const writeRoutes = (next: (current: VacuumMapRoute[]) => VacuumMapRoute[]): boolean => {
    let base: VacuumMapRoute[] | null = explicit ? vacuum.map_routes : null;
    if (!base) {
      base = convertLegacyRoutes(vacuum, dev.space, rootSource,
        (taken) => newRouteId(taken)) ?? [];
      if (!rootSource && Object.keys(vacuum.calibration || {}).length) return false;
    }
    setVac({ map_routes: next(base), calibration: undefined });
    return true;
  };
  const takenIds = () => new Set(routes.map((route) => route.id));

  const addCurrent = () => {
    if (!rootSource || currentMapId === undefined) return;
    writeRoutes((current) => addRoute(
      current,
      {
        source: rootSource,
        map_id: currentMapId,
        space: current.length ? '' : dev.space,
      },
      newRouteId(takenIds()),
    ));
  };

  const retarget = async (route: VacuumMapRoute, space: string) => {
    if (!space || space === route.space) return;
    const accepted = await host._confirmDanger({
      key: 'vacuum_route_space',
      kind: 'warning',
      title: t('vac.route_space_title'),
      message: t('vac.route_space_body'),
      objectName: route.map_id || t('vac.route_map_default'),
      confirmLabel: t('vac.route_space_confirm'),
      cancelLabel: host._t('btn.cancel'),
    });
    if (!accepted) return;
    writeRoutes((current) => changeRouteSpace(current, route.id, space, newRouteId(takenIds())));
  };

  const drop = async (route: VacuumMapRoute) => {
    const accepted = await host._confirmDanger({
      key: 'vacuum_route_delete',
      kind: 'danger',
      title: t('vac.route_delete_title'),
      message: t('vac.route_delete_body'),
      objectName: route.map_id || t('vac.route_map_default'),
      confirmLabel: t('vac.route_delete_confirm'),
      cancelLabel: host._t('btn.cancel'),
    });
    if (!accepted) return;
    writeRoutes((current) => removeRoute(current, route.id));
  };

  // Space order, then map id, then source: a stable reading order that never
  // depends on the order the routes happen to be stored in.
  const order = new Map(spaces.map((space, index) => [space.id, index]));
  const rows = [...routes].sort((a, b) => (order.get(a.space) ?? 1e6) - (order.get(b.space) ?? 1e6)
    || a.map_id.localeCompare(b.map_id) || a.source.localeCompare(b.source));

  const statusOf = (route: VacuumMapRoute): string => {
    if (!spaceIds.has(route.space)) return t('vac.route_status_missing_space');
    if (!route.calibration) return t('vac.route_status_needs_calibration');
    if (resolution.kind === 'ambiguous' && resolution.routeIds.includes(route.id)) {
      return t('vac.route_status_ambiguous');
    }
    return t('vac.route_status_ready');
  };

  const canAddCurrent = !!rootSource && currentMapId !== undefined
    && !routes.some((route) => route.source === rootSource && route.map_id === currentMapId);

  return html`
    <label>${t('vac.routes_section')}</label>
    <div class="bindbox vacroutes">
      <div class="vacdiag" role="status">
        <div><span>${t('vac.routes_current_map')}</span><b>${currentMapId === undefined
          ? t('vac.routes_no_map') : (currentMapId || t('vac.route_map_default'))}</b></div>
        <div><span>${t('vac.routes_status')}</span><b>${t(`vac.routes_state_${resolution.kind}`)}</b></div>
      </div>
      ${rows.length ? html`<ul class="vacroute-list">
        ${rows.map((route) => html`
          <li class="vacroute ${route.id === activeId ? 'on' : ''}">
            <div class="vacroute-head">
              <b>${route.map_id || t('vac.route_map_default')}</b>
              ${route.id === activeId
                ? html`<span class="vacroute-active">${t('vac.route_active')}</span>` : nothing}
            </div>
            <small>${route.source}</small>
            <div class="vacroute-status">${statusOf(route)}</div>
            <label class="srcrow">
              <span>${t('vac.route_space')}</span>
              <select class="areasel" @change=${(event: Event) => {
                const select = event.target as HTMLSelectElement;
                const next = select.value;
                select.value = route.space;
                void retarget(route, next);
              }}>
                <option value="" ?selected=${!route.space}>${t('vac.route_space_none')}</option>
                ${spaces.map((space) => html`
                  <option value=${space.id} ?selected=${space.id === route.space}>${space.name}</option>`)}
              </select>
            </label>
            <div class="vacbtns">
              <button type="button" class="btn ghostbtn"
                @click=${() => runtime._vacStartFit(dev, route.id)}>${host._t('vac.fit')}</button>
              <button type="button" class="btn ghostbtn danger"
                @click=${() => void drop(route)}>${t('vac.route_delete')}</button>
            </div>
          </li>`)}
      </ul>` : html`<div class="rhint">${t('vac.routes_empty')}</div>`}
      <div class="vacbtns">
        <button type="button" class="btn" ?disabled=${!canAddCurrent}
          @click=${addCurrent}>${t('vac.route_add_current')}</button>
      </div>
      ${rows.some((route) => !spaceIds.has(route.space)) ? html`
        <div class="warn">${t('vac.route_missing_space_hint')}</div>` : nothing}
      ${routes.some((route) => route.map_id === 'default') ? html`
        <div class="rhint">${t('vac.route_default_hint')}</div>` : nothing}
      ${rows.length ? html`<div class="rhint">${t('vac.route_target_hint', {
        space: spaceName(host, dev.space),
      })}</div>` : nothing}
    </div>`;
}
