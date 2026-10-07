import type { DevItem } from './types';
import type { HaRegistrySnapshot } from './ha-binding-status';
import {
  normalizeIeee, recordOf, resolveProviderUplinks, suppressUplinkCycles, topologyName,
  type ZigbeeTopology, type ZigbeeTopologyNode, type ZigbeeTopologyWarning, type ZigbeeUplink,
} from './zigbee-provider-routes';
export * from './zigbee-provider-routes';

export interface ZigbeeHoverLine {
  neighborMarkerId: string;
  lqi?: number;
  routeDirection: 'toward-neighbor' | 'toward-origin';
}
export type ZigbeeParentTarget = (
  | { kind: 'remote-space'; spaceId: string }
  | { kind: 'unplaced-device' }
  | { kind: 'unplaced-coordinator' }
) & { nodeKey: string; deviceName?: string; lqi?: number };
export interface ZigbeeHoverResolution {
  lines: ZigbeeHoverLine[];
  remoteCount: number;
  omittedCount: number;
  parentTargets: ZigbeeParentTarget[];
  outgoing: 'known' | 'unknown' | 'root' | 'not-zigbee';
  partial: boolean;
  showIncomplete: boolean;
  obtainedAt?: number;
}
export type ZigbeeNodePlacement = { markerId: string; space: string };
export type ZigbeeMappedTopology = {
  topology: ZigbeeTopology;
  placements: Map<string, ZigbeeNodePlacement>;
  routes: Map<string, ZigbeeUplink>;
  nodes: Map<string, ZigbeeTopologyNode>;
  names: Map<string, string>;
  identities: Map<string, string>;
  partial: boolean;
};

function ieeeFromRegistryIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const direct = normalizeIeee(value);
  if (direct) return direct;
  const match = value.toLowerCase().match(/^zigbee2mqtt(?:_bridge)?_(.+)$/);
  return match ? normalizeIeee(match[1]) : null;
}
function deviceIdsForNode(node: ZigbeeTopologyNode, registry: HaRegistrySnapshot): string[] {
  if (node.deviceId && registry.devices[node.deviceId]) return [node.deviceId];
  const ids = new Set<string>();
  for (const [id, rawDevice] of Object.entries(registry.devices as Record<string, unknown>)) {
    const device = recordOf(rawDevice);
    const identifiers = Array.isArray(device?.identifiers) ? device.identifiers : [];
    if (identifiers.some((pair: unknown) => Array.isArray(pair)
      && ieeeFromRegistryIdentifier(pair[1]) === node.ieee)) ids.add(id);
  }
  if (ids.size) return [...ids];
  for (const rawEntity of Object.values(registry.entities as Record<string, unknown>)) {
    const entity = recordOf(rawEntity);
    if (typeof entity?.device_id !== 'string' || typeof entity.unique_id !== 'string') continue;
    if (ieeeFromRegistryIdentifier(entity.unique_id) === node.ieee) ids.add(entity.device_id);
  }
  return [...ids];
}
function drawable(device: DevItem): boolean {
  return !device.hidden && !device.virtual && device.bindingStatus?.kind !== 'ha_disabled'
    && device.bindingStatus?.kind !== 'orphaned' && device.bindingStatus?.kind !== 'unverified';
}

/** Exact registry binding only; names, models and friendly names are never identities. */
export function mapTopologyNodes(
  topology: ZigbeeTopology, devices: readonly DevItem[], registry: HaRegistrySnapshot,
): { placements: Map<string, ZigbeeNodePlacement>; warnings: ZigbeeTopologyWarning[] } {
  const placements = new Map<string, ZigbeeNodePlacement>();
  const warnings: ZigbeeTopologyWarning[] = [];
  for (const node of topology.nodes) {
    if (node.available === false) { warnings.push({ code: 'provider_scan_failure', nodeKey: node.key }); continue; }
    const deviceIds = deviceIdsForNode(node, registry);
    if (deviceIds.length !== 1) { warnings.push({ code: 'unmatched_device', nodeKey: node.key }); continue; }
    const deviceId = deviceIds[0];
    let candidates = devices.filter((item) => drawable(item)
      && item.bindingKind === 'device' && item.bindingRef === deviceId);
    if (!candidates.length) candidates = devices.filter((item) => drawable(item)
      && item.bindingKind === 'entity' && !!item.bindingRef
      && registry.entities[item.bindingRef]?.device_id === deviceId);
    if (candidates.length === 1) placements.set(node.key, {
      markerId: candidates[0].id, space: candidates[0].space,
    });
    else warnings.push({ code: candidates.length > 1 ? 'ambiguous_placement' : 'unmatched_device', nodeKey: node.key });
  }
  return { placements, warnings };
}

/** Cross-provider authority is exact HA ownership, even for an unplaced device. */
function reconcileSources(mapped: ZigbeeMappedTopology[]): void {
  const groups = new Map<string, Array<{ map: ZigbeeMappedTopology; key: string; route: ZigbeeUplink }>>();
  for (const map of mapped) for (const [key, route] of map.routes) {
    const identity = map.identities.get(key)!;
    const group = groups.get(identity) || []; group.push({ map, key, route }); groups.set(identity, group);
  }
  const combined = new Map<string, ZigbeeUplink>();
  for (const [identity, group] of groups) {
    const known = group.filter((item) => item.route.kind === 'known');
    const hardUnknown = group.find(({ route }) => route.kind === 'unknown'
      && route.reason !== 'missing' && route.reason !== 'unknown-role');
    const root = group.some(({ route }) => route.kind === 'root');
    const targets = new Set(known.map(({ map, route }) => route.kind === 'known'
      ? map.identities.get(route.targetKey) : undefined));
    if (hardUnknown || targets.size > 1 || (root && known.length)) {
      combined.set(identity, { kind: 'unknown', reason: 'conflict' });
    } else if (known.length) {
      const first = known[0].route;
      if (first.kind === 'known') combined.set(identity, { ...first, targetKey: [...targets][0]! });
    } else combined.set(identity, root ? { kind: 'root' } : { kind: 'unknown', reason: 'missing' });
  }
  suppressUplinkCycles(combined);
  for (const [identity, group] of groups) {
    const resolved = combined.get(identity)!;
    if (resolved.kind === 'unknown' && resolved.reason !== 'missing') {
      for (const { map, key } of group) { map.routes.set(key, resolved); map.partial = true; }
    }
  }
}

/** Normalization and source reconciliation are memoized by the overlay's snapshot revision. */
export function mapTopologies(
  topologies: readonly ZigbeeTopology[], devices: readonly DevItem[], registry: HaRegistrySnapshot,
): ZigbeeMappedTopology[] {
  const mapped = topologies.map((topology): ZigbeeMappedTopology => {
    const placement = mapTopologyNodes(topology, devices, registry);
    const names = new Map<string, string>(); const identities = new Map<string, string>();
    for (const node of topology.nodes) {
      const ids = deviceIdsForNode(node, registry);
      const id = ids.length === 1 ? ids[0] : undefined;
      const device = id ? recordOf(registry.devices[id]) : null;
      identities.set(node.key, id ? `ha:${id}` : node.key);
      const name = topologyName(device?.name_by_user) ?? topologyName(device?.name) ?? node.name;
      if (name) names.set(node.key, name);
    }
    return { topology, placements: placement.placements, routes: resolveProviderUplinks(topology),
      nodes: new Map(topology.nodes.map((node) => [node.key, node])), names, identities,
      partial: topology.warnings.length > 0 || placement.warnings.length > 0 };
  });
  reconcileSources(mapped);
  return mapped;
}

/** Project only confirmed edges incident to the hovered marker, never neighbor observations. */
export function resolveMappedTopologyHover(
  mappedTopologies: readonly ZigbeeMappedTopology[], currentSpace: string, hoveredMarkerId: string,
): ZigbeeHoverResolution {
  const lines = new Map<string, ZigbeeHoverLine>(); const remote = new Set<string>();
  const targets = new Map<string, ZigbeeParentTarget>(); const omitted = new Set<string>();
  let outgoing: ZigbeeHoverResolution['outgoing'] = 'not-zigbee';
  let partial = false; let isCoordinator = false; let obtainedAt: number | undefined;
  for (const map of mappedTopologies) {
    const hovered = new Set([...map.placements].filter(([, placement]) => (
      placement.markerId === hoveredMarkerId && placement.space === currentSpace
    )).map(([key]) => key));
    if (!hovered.size) continue;
    partial ||= map.partial;
    obtainedAt = obtainedAt === undefined ? map.topology.obtainedAt : Math.min(obtainedAt, map.topology.obtainedAt);
    for (const key of hovered) {
      isCoordinator ||= map.nodes.get(key)?.role === 'coordinator';
      const route = map.routes.get(key);
      if (route?.kind === 'known') outgoing = 'known';
      else if (route?.kind === 'root' && outgoing !== 'known') outgoing = 'root';
      else if (outgoing === 'not-zigbee') outgoing = 'unknown';
    }
    for (const [from, route] of map.routes) {
      if (route.kind !== 'known') continue;
      const isOutgoing = hovered.has(from); const isIncoming = hovered.has(route.targetKey);
      if (!isOutgoing && !isIncoming) continue;
      const otherKey = isOutgoing ? route.targetKey : from;
      const other = map.placements.get(otherKey);
      const identity = map.identities.get(otherKey)!;
      if (other?.markerId === hoveredMarkerId) continue;
      if (other?.space === currentSpace) {
        const line = lines.get(other.markerId);
        if (!line) lines.set(other.markerId, { neighborMarkerId: other.markerId,
          lqi: route.lqi, routeDirection: isOutgoing ? 'toward-neighbor' : 'toward-origin' });
        else if (line.lqi === undefined) line.lqi = route.lqi;
      } else if (isOutgoing) {
        const extra = { nodeKey: otherKey, deviceName: map.names.get(otherKey), lqi: route.lqi };
        const existing = targets.get(identity);
        if (!existing) targets.set(identity, other
          ? { kind: 'remote-space', spaceId: other.space, ...extra }
          : { kind: map.nodes.get(otherKey)?.role === 'coordinator' ? 'unplaced-coordinator' : 'unplaced-device', ...extra });
        else if (existing.lqi === undefined) existing.lqi = route.lqi;
        if (!other) omitted.add(identity);
      } else if (other) remote.add(identity);
      else omitted.add(identity);
    }
  }
  return { lines: [...lines.values()], remoteCount: remote.size, omittedCount: omitted.size,
    parentTargets: [...targets.values()], outgoing, partial,
    showIncomplete: partial && outgoing === 'unknown' && !isCoordinator,
    ...(obtainedAt === undefined ? {} : { obtainedAt }) };
}
export function resolveTopologyHover(
  topologies: readonly ZigbeeTopology[], devices: readonly DevItem[],
  registry: HaRegistrySnapshot, currentSpace: string, hoveredMarkerId: string,
): ZigbeeHoverResolution {
  return resolveMappedTopologyHover(mapTopologies(topologies, devices, registry), currentSpace, hoveredMarkerId);
}
