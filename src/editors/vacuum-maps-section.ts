/**
 * Device editor: "Maps and floors" for a multi-floor robot (#162).
 *
 * Lives outside the editor runtime on purpose. The runtime is at its size
 * ceiling (test/core-file-budget.test.mjs), and this block is only ever needed
 * with an opened device dialog, so it belongs in the lazy editor graph rather
 * than in a core file.
 */
import { TemplateResult, html, nothing } from 'lit';
import type { HpConfirmRequest } from '../danger-confirm';
import type { DevItem, Marker, ServerConfig } from '../types';
import type { VacSourceCandidate, VacSourceResolution } from '../vacuum';
import { langOf, type I18nKey } from '../i18n';
import { supportT, type SupportI18nKey } from '../i18n/support';
import { VacuumMapRoute, effectiveRoutes, observedMapIds, resolveRoute } from '../vacuum-routes';
import {
  beginVacuumRouteDraft, changeRouteSpace, chooseVacuumRouteSpace,
  commitVacuumRouteDraft, convertLegacyRoutes, newRouteId, removeRoute,
  type VacuumRouteDraft,
} from '../vacuum-route-edit';
import { optimisticAttempt, rollbackOptimistic } from '../serialized-write-queue';
import { contentFingerprint } from '../visual-continuity';

interface SpaceRow { id?: unknown; name?: unknown }

/** The narrow slice of the card this block reads and writes through. */
export interface VacuumMapsCardHost {
  hass?: { states?: Record<string, unknown> } | null;
  _config?: { language?: string | null } | null;
  _serverCfg: (ServerConfig & { spaces: SpaceRow[] }) | null;
  _cfgContentFingerprint: string;
  _cfgRev: number;
  _saveConfigDebounced: { pending: () => boolean; cancel: () => void };
  _regSignature: string;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  _errText: (error: unknown) => string;
  _maybeRebuildDevices: () => void;
  _showToast: (message: string) => void;
  _vacSource: (dev: DevItem) => string | null;
  _vacObservedMapId: (dev: DevItem, source: string) => string | undefined;
  _confirmDanger: (request: HpConfirmRequest) => Promise<boolean>;
  requestUpdate: () => void;
}

export interface VacuumMapsHost {
  host: VacuumMapsCardHost;
  _saveConfigNow: () => Promise<void>;
  _vacAutoCalibrate: (dev: DevItem) => void;
  _vacStartFit: (dev: DevItem, routeId?: string) => void;
}

const pendingRoute = new WeakMap<VacuumMapsHost, VacuumRouteDraft & { saving?: boolean }>();

const spaceName = (host: VacuumMapsCardHost, spaceId: string): string => {
  const space = (host._serverCfg?.spaces || []).find((item) => item?.id === spaceId);
  return String(space?.name || space?.id || spaceId);
};

/**
 * Render the block, and own every routing edit it offers.
 *
 * Additions stay in module-owned UI state until the floor is valid; accepted
 * edits use the card's serialized config writer and roll back on rejection.
 */
export function renderVacuumMapsSection(
  runtime: VacuumMapsHost, dev: DevItem, sources: VacSourceResolution,
): TemplateResult | typeof nothing {
  const host = runtime.host;
  const lang = langOf(host.hass, host._config?.language);
  const t = (key: string, vars?: Record<string, string>) => supportT(
    lang, key as SupportI18nKey, vars);
  const vacuum = dev.marker?.vacuum || {};
  const explicit = Array.isArray(vacuum.map_routes);
  const rootSource: string = host._vacSource(dev) || '';
  const routes: VacuumMapRoute[] = effectiveRoutes(dev.id, vacuum, dev.space, rootSource);
  const spaces: Array<{ id: string; name: string }> = (host._serverCfg?.spaces || [])
    .filter((space): space is { id: string; name?: unknown } =>
      typeof space?.id === 'string' && !!space.id)
    .map((space) => ({ id: space.id, name: String(space.name || space.id) }));
  const spaceIds = new Set(spaces.map((space) => space.id));
  const observed = observedMapIds(routes, [rootSource],
    (source) => host._vacObservedMapId(dev, source));
  const resolution = resolveRoute({ routes, observed, spaceIds });
  const activeId = (resolution.kind === 'ready' || resolution.kind === 'needs_calibration'
    || resolution.kind === 'missing_space') ? resolution.route.id : '';
  const currentMapId = rootSource ? observed[rootSource] : undefined;

  /** Persist route changes atomically, restoring the last accepted config on rejection. */
  const persistRoutes = async (nextRoutes: VacuumMapRoute[]): Promise<boolean> => {
    const previous = host._serverCfg;
    if (!previous) return false;
    const nextConfig = JSON.parse(JSON.stringify(previous)) as ServerConfig;
    nextConfig.markers = nextConfig.markers || [];
    let marker = nextConfig.markers.find((item) => item.id === dev.id);
    if (!marker) {
      if ((dev.bindingKind !== 'device' && dev.bindingKind !== 'entity') || !dev.bindingRef) return false;
      marker = {
        id: dev.id, binding: `${dev.bindingKind}:${dev.bindingRef}`,
        space: dev.space || null, area: dev.area || null, hidden: dev.hidden ? true : false,
      } as Marker;
      nextConfig.markers.push(marker);
    }
    marker.vacuum = { ...(marker.vacuum || {}), map_routes: nextRoutes };
    delete marker.vacuum.calibration;
    const attempt = optimisticAttempt(previous, nextConfig, host._cfgContentFingerprint,
      host._cfgRev, contentFingerprint);
    host._serverCfg = nextConfig;
    host._regSignature = '';
    host._maybeRebuildDevices();
    host.requestUpdate();
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.cancel();
    try {
      await runtime._saveConfigNow();
      return true;
    } catch (error) {
      rollbackOptimistic(host, attempt, contentFingerprint);
      host._regSignature = '';
      host._maybeRebuildDevices();
      host.requestUpdate();
      host._showToast(host._t('toast.cfg_save_failed', { err: host._errText(error) }));
      return false;
    }
  };

  /** Every routing edit converts legacy data first — all of it, or none. */
  const writeRoutes = async (
    next: (current: VacuumMapRoute[]) => VacuumMapRoute[] | null,
  ): Promise<boolean> => {
    let base: VacuumMapRoute[] | null = explicit ? (vacuum.map_routes ?? null) : null;
    if (!base) {
      base = convertLegacyRoutes(vacuum, dev.space, rootSource,
        (taken) => newRouteId(taken)) ?? [];
      if (!rootSource && Object.keys(vacuum.calibration || {}).length) return false;
    }
    const candidate = next(base);
    return candidate ? persistRoutes(candidate) : false;
  };
  const takenIds = () => new Set(routes.map((route) => route.id));

  const addCurrent = () => {
    if (!rootSource || currentMapId === undefined) return;
    pendingRoute.set(runtime,
      beginVacuumRouteDraft(dev.id, routes, dev.space, rootSource, currentMapId));
    host.requestUpdate();
  };

  /**
   * Second supported integration shape: one camera per map (spec 9.3).
   *
   * The map id is read from the picked source with the same fallback the rest
   * of the card uses. A source that names no map cannot be told apart from
   * another later, so no route is created and the reason is shown instead of
   * a route that could never resolve.
   */
  const addSource = (candidate: VacSourceCandidate) => {
    const mapId = host._vacObservedMapId(dev, candidate.entityId);
    if (mapId === undefined) return;
    pendingRoute.set(runtime,
      beginVacuumRouteDraft(dev.id, routes, dev.space, candidate.entityId, mapId));
    host.requestUpdate();
  };

  const spare = sources.candidates.filter((candidate) => candidate.entityId !== rootSource
    && !routes.some((route) => route.source === candidate.entityId));

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
    await writeRoutes((current) => changeRouteSpace(current, route.id, space, newRouteId(takenIds())));
  };

  const drop = async (route: VacuumMapRoute) => {
    const accepted = await host._confirmDanger({
      key: 'vacuum_route_delete',
      kind: 'destructive',
      title: t('vac.route_delete_title'),
      message: t('vac.route_delete_body'),
      objectName: route.map_id || t('vac.route_map_default'),
      confirmLabel: t('vac.route_delete_confirm'),
      cancelLabel: host._t('btn.cancel'),
    });
    if (!accepted) return;
    await writeRoutes((current) => removeRoute(current, route.id));
  };

  // Valid spaces keep their configured order. Missing-space routes form one
  // explicit group with a fully deterministic identity order (#443).
  const order = new Map(spaces.map((space, index) => [space.id, index]));
  const compareIdentity = (a: VacuumMapRoute, b: VacuumMapRoute): number =>
    a.map_id.localeCompare(b.map_id)
      || a.source.localeCompare(b.source)
      || a.id.localeCompare(b.id);
  const validRows = routes.filter((route) => spaceIds.has(route.space))
    .sort((a, b) => (order.get(a.space) ?? 0) - (order.get(b.space) ?? 0)
      || compareIdentity(a, b));
  const missingRows = routes.filter((route) => !spaceIds.has(route.space))
    .sort(compareIdentity);
  const rows = [...validRows, ...missingRows];

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

  let draft = pendingRoute.get(runtime);
  const draftSource = draft?.source || '';
  const draftMapId = draft?.mapId || '';
  const draftIdentityExists = draft
    ? routes.some((route) => route.source === draftSource && route.map_id === draftMapId)
    : false;
  if (draft && (draft.markerId !== dev.id
      || host._vacObservedMapId(dev, draft.source) !== draft.mapId
      || (draftIdentityExists && !draft.saving))) {
    pendingRoute.delete(runtime);
    draft = undefined;
  }
  if (draft?.space && !spaceIds.has(draft.space)) {
    draft = chooseVacuumRouteSpace(draft, '', spaceIds);
    pendingRoute.set(runtime, draft);
  }
  const selectDraftSpace = (space: string) => {
    const current = pendingRoute.get(runtime);
    if (!current || current.saving) return;
    pendingRoute.set(runtime, chooseVacuumRouteSpace(current, space, spaceIds));
    host.requestUpdate();
  };
  const cancelDraft = () => {
    if (pendingRoute.get(runtime)?.saving) return;
    pendingRoute.delete(runtime);
    host.requestUpdate();
  };
  const confirmDraft = async () => {
    const current = pendingRoute.get(runtime);
    if (!current || current.saving || !spaceIds.has(current.space)) return;
    pendingRoute.set(runtime, { ...current, saving: true });
    host.requestUpdate();
    const saved = await writeRoutes((base) => commitVacuumRouteDraft(
      base, current, spaceIds, newRouteId(new Set(base.map((route) => route.id))),
    ));
    const live = pendingRoute.get(runtime);
    if (live?.markerId === current.markerId && live.source === current.source
        && live.mapId === current.mapId) {
      if (saved) pendingRoute.delete(runtime);
      else pendingRoute.set(runtime, current);
    }
    host.requestUpdate();
  };

  const renderRoute = (route: VacuumMapRoute): TemplateResult => html`
    <li class="vacroute ${route.id === activeId ? 'on' : ''}" data-route-id=${route.id}>
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
    </li>`;
  const missingGroupTitleId = `vacroute-missing-${dev.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return html`
    <label>${t('vac.routes_section')}</label>
    <div class="bindbox vacroutes">
      <div class="vacdiag" role="status">
        <div><span>${t('vac.routes_current_map')}</span><b>${currentMapId === undefined
          ? t('vac.routes_no_map') : (currentMapId || t('vac.route_map_default'))}</b></div>
        <div><span>${t('vac.routes_status')}</span><b>${t(`vac.routes_state_${resolution.kind}`)}</b></div>
      </div>
      ${validRows.length || draft ? html`<ul class="vacroute-list">
        ${draft ? html`
          <li class="vacroute pending">
            <div class="vacroute-head"><b>${draft.mapId || t('vac.route_map_default')}</b></div>
            <small>${draft.source}</small>
            <label class="srcrow">
              <span>${t('vac.route_space')}</span>
              <select class="areasel vacroute-draft-space" ?disabled=${!!draft.saving}
                @change=${(event: Event) => selectDraftSpace((event.target as HTMLSelectElement).value)}>
                <option value="" ?selected=${!draft.space}>${t('vac.route_space_none')}</option>
                ${spaces.map((space) => html`
                  <option value=${space.id} ?selected=${space.id === draft!.space}>${space.name}</option>`)}
              </select>
            </label>
            <div class="vacbtns">
              <button type="button" class="btn ghostbtn" ?disabled=${!!draft.saving}
                @click=${cancelDraft}>${host._t('btn.cancel')}</button>
              <button type="button" class="btn vacroute-draft-save"
                ?disabled=${!!draft.saving || !spaceIds.has(draft.space)}
                @click=${() => void confirmDraft()}>${host._t('btn.save')}</button>
            </div>
          </li>` : nothing}
        ${validRows.map(renderRoute)}
      </ul>` : nothing}
      ${missingRows.length ? html`
        <section class="vacroute-missing-group" data-hp="vacuum-route-missing-group"
          aria-labelledby=${missingGroupTitleId}>
          <h4 class="vacroute-group-title" id=${missingGroupTitleId}>
            ${t('vac.route_missing_space_group')}
          </h4>
          <ul class="vacroute-list">${missingRows.map(renderRoute)}</ul>
        </section>` : nothing}
      ${!rows.length && !draft ? html`<div class="rhint">${t('vac.routes_empty')}</div>` : nothing}
      <div class="vacbtns">
        <button type="button" class="btn vacroute-add-current" ?disabled=${!canAddCurrent || !!draft}
          @click=${addCurrent}>${t('vac.route_add_current')}</button>
      </div>
      ${spare.length ? html`<details class="vacroute-sources">
        <summary class="btn ghostbtn">${t('vac.route_add_source')}</summary>
        <div class="rhint">${t('vac.route_add_source_hint')}</div>
        <div class="vacsource-list">
          ${spare.map((candidate) => {
            const mapId = host._vacObservedMapId(dev, candidate.entityId);
            return html`<button type="button" class="vacsource"
              ?disabled=${mapId === undefined || !!draft}
              @click=${() => addSource(candidate)}>
              <span><b>${candidate.name}</b><small>${candidate.entityId}</small></span>
              <span class="vacsource-meta">${mapId === undefined
                ? t('vac.route_source_no_map')
                : (mapId || t('vac.route_map_default'))}</span>
            </button>`;
          })}
        </div>
      </details>` : nothing}
      ${rows.some((route) => !spaceIds.has(route.space)) ? html`
        <div class="warn">${t('vac.route_missing_space_hint')}</div>` : nothing}
      ${routes.some((route) => route.map_id === 'default') ? html`
        <div class="rhint">${t('vac.route_default_hint')}</div>` : nothing}
      ${rows.length ? html`<div class="rhint">${t('vac.route_target_hint', {
        space: spaceName(host, dev.space),
      })}</div>` : nothing}
    </div>`;
}
