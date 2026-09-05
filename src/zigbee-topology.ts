import type { DevItem } from './types';
import type { HaRegistrySnapshot } from './ha-binding-status';
import { normalizeZ2mBaseTopic } from './zigbee-topology-settings';

export type ZigbeeProvider = 'zha' | 'z2m';
export type ZigbeeRole = 'coordinator' | 'router' | 'end' | 'unknown';

export interface ZigbeeDirectionalObservation {
  lqi?: number;
  relationship?: string;
  activeRoute?: boolean;
}

export interface ZigbeeTopologyNode {
  key: string;
  ieee: string;
  deviceId?: string;
  role: ZigbeeRole;
  available?: boolean;
}

export interface ZigbeeTopologyLink {
  a: string;
  b: string;
  aToB?: ZigbeeDirectionalObservation;
  bToA?: ZigbeeDirectionalObservation;
}

export type ZigbeeTopologyWarningCode =
  | 'invalid_payload'
  | 'duplicate_link'
  | 'self_link'
  | 'unmatched_device'
  | 'ambiguous_placement'
  | 'provider_scan_failure';

export interface ZigbeeTopologyWarning {
  code: ZigbeeTopologyWarningCode;
  nodeKey?: string;
}

export interface ZigbeeTopology {
  provider: ZigbeeProvider;
  instanceId: string;
  obtainedAt: number;
  freshness: 'provider-cache' | 'fresh-scan';
  nodes: ZigbeeTopologyNode[];
  links: ZigbeeTopologyLink[];
  warnings: ZigbeeTopologyWarning[];
}

export interface ZigbeeHoverLine {
  neighborMarkerId: string;
  lqi?: number;
  routeDirection?: 'toward-neighbor' | 'toward-origin';
}

export type ZigbeeParentTarget =
  | { kind: 'remote-space'; spaceId: string }
  | { kind: 'unplaced-device' }
  | { kind: 'unplaced-coordinator' };

export interface ZigbeeRouteTree {
  coordinatorKey?: string;
  distances: Map<string, number>;
  parents: Map<string, string>;
}

export interface ZigbeeHoverResolution {
  lines: ZigbeeHoverLine[];
  remoteCount: number;
  omittedCount: number;
  parentTargets: ZigbeeParentTarget[];
}

export const TOPOLOGY_STALE_MS = 5 * 60 * 1000;
export const TOPOLOGY_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const TOPOLOGY_MAX_NODES = 1000;
export const TOPOLOGY_MAX_LINKS = 6000;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function normalizeIeee(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let text = String(value).trim().toLowerCase();
  if (/^0x[0-9a-f]{16}$/.test(text)) text = text.slice(2);
  else text = text.replace(/[:-]/g, '');
  return /^[0-9a-f]{16}$/.test(text) ? text : null;
}

function nodeKey(provider: ZigbeeProvider, instanceId: string, ieee: string): string {
  return `${provider}:${instanceId}:${ieee}`;
}

function roleOf(value: unknown): ZigbeeRole {
  const role = String(value || '').toLowerCase().replace(/[ _-]/g, '');
  if (role.includes('coordinator')) return 'coordinator';
  if (role.includes('router')) return 'router';
  if (role.includes('enddevice') || role === 'end') return 'end';
  return 'unknown';
}

function lqiOf(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 255 ? Math.round(n) : undefined;
}

const Z2M_RELATIONSHIPS = ['parent', 'child', 'sibling', 'none', 'previous_child'] as const;

function relationshipOf(value: unknown): string | undefined {
  if (typeof value === 'number') return Z2M_RELATIONSHIPS[value];
  if (typeof value !== 'string') return undefined;
  const compact = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return compact === 'previouschild' ? 'previous_child' : compact.slice(0, 40) || undefined;
}

function observation(value: unknown): ZigbeeDirectionalObservation {
  const record = recordOf(value);
  const lqi = lqiOf(record?.lqi ?? record?.linkquality ?? record?.link_quality);
  const relationship = relationshipOf(record?.relationship);
  return { ...(lqi === undefined ? {} : { lqi }), ...(relationship ? { relationship } : {}) };
}

function boundedArray(value: unknown, max: number): unknown[] | null {
  return Array.isArray(value) && value.length <= max ? value : null;
}

function safePayload(value: unknown): boolean {
  if (typeof value === 'string') return value.length <= TOPOLOGY_MAX_PAYLOAD_BYTES;
  try { return JSON.stringify(value).length <= TOPOLOGY_MAX_PAYLOAD_BYTES; } catch { return false; }
}

function pushDirectionalLink(
  links: Map<string, ZigbeeTopologyLink>, warnings: ZigbeeTopologyWarning[],
  from: string, to: string, value: unknown,
): void {
  if (from === to) { warnings.push({ code: 'self_link', nodeKey: from }); return; }
  const forward = from < to;
  const pair = forward ? `${from}|${to}` : `${to}|${from}`;
  const current = links.get(pair) || { a: forward ? from : to, b: forward ? to : from };
  const field = forward ? 'aToB' : 'bToA';
  if (current[field]) warnings.push({ code: 'duplicate_link', nodeKey: from });
  else current[field] = observation(value);
  links.set(pair, current);
}

/** Normalize cached ZHA neighbors. Route destinations deliberately do not create edges. */
export function normalizeZhaTopology(payload: unknown, now = Date.now()): ZigbeeTopology {
  const warnings: ZigbeeTopologyWarning[] = [];
  const rows = safePayload(payload) ? boundedArray(payload, TOPOLOGY_MAX_NODES) : null;
  if (!rows) return { provider: 'zha', instanceId: 'zha', obtainedAt: now,
    freshness: 'provider-cache', nodes: [], links: [], warnings: [{ code: 'invalid_payload' }] };
  const nodes = new Map<string, ZigbeeTopologyNode>();
  const links = new Map<string, ZigbeeTopologyLink>();
  for (const row of rows) {
    const record = recordOf(row);
    const ieee = normalizeIeee(record?.ieee ?? record?.ieee_address);
    if (!ieee) { warnings.push({ code: 'invalid_payload' }); continue; }
    const key = nodeKey('zha', 'zha', ieee);
    nodes.set(key, {
      key, ieee,
      ...(typeof record?.device_reg_id === 'string' ? { deviceId: record.device_reg_id } : {}),
      role: roleOf(record?.device_type ?? record?.type),
      ...(typeof record?.available === 'boolean' ? { available: record.available } : {}),
    });
  }
  for (const row of rows) {
    const record = recordOf(row);
    const ieee = normalizeIeee(record?.ieee ?? record?.ieee_address);
    if (!ieee) continue;
    const from = nodeKey('zha', 'zha', ieee);
    const neighbors = boundedArray(record?.neighbors, TOPOLOGY_MAX_LINKS);
    if (!neighbors) { if (record?.neighbors != null) warnings.push({ code: 'invalid_payload', nodeKey: from }); continue; }
    for (const neighbor of neighbors) {
      if (links.size >= TOPOLOGY_MAX_LINKS) { warnings.push({ code: 'invalid_payload' }); break; }
      const neighborRecord = recordOf(neighbor);
      const otherIeee = normalizeIeee(neighborRecord?.ieee ?? neighborRecord?.ieee_address);
      if (!otherIeee) { warnings.push({ code: 'invalid_payload', nodeKey: from }); continue; }
      const to = nodeKey('zha', 'zha', otherIeee);
      if (!nodes.has(to)) nodes.set(to, { key: to, ieee: otherIeee, role: roleOf(neighborRecord?.device_type) });
      pushDirectionalLink(links, warnings, from, to, neighbor);
    }
  }
  return { provider: 'zha', instanceId: 'zha', obtainedAt: now,
    freshness: 'provider-cache', nodes: [...nodes.values()], links: [...links.values()], warnings };
}

function z2mValue(payload: unknown): unknown {
  let value = payload;
  if (typeof value === 'string') {
    if (value.length > TOPOLOGY_MAX_PAYLOAD_BYTES) return null;
    try { value = JSON.parse(value); } catch { return null; }
  }
  const envelope = recordOf(value);
  const data = recordOf(envelope?.data);
  value = data?.value ?? envelope?.value ?? envelope?.data ?? value;
  if (typeof value === 'string') {
    if (value.length > TOPOLOGY_MAX_PAYLOAD_BYTES) return null;
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value;
}

function endpointIeee(value: unknown, nodeById: Map<string, string>): string | null {
  const record = recordOf(value);
  const direct = normalizeIeee(
    record?.ieeeAddr ?? record?.ieee_address ?? record?.ieee ?? value,
  );
  if (direct) return direct;
  for (const id of [record?.id, record?.networkAddress, record?.network_address, value]) {
    if (id != null) {
      const ieee = nodeById.get(String(id));
      if (ieee) return ieee;
    }
  }
  return null;
}

/** Normalize one explicit Zigbee2MQTT raw network-map response. */
export function normalizeZ2mTopology(payload: unknown, baseTopic: string, now = Date.now()): ZigbeeTopology {
  const warnings: ZigbeeTopologyWarning[] = [];
  const topic = normalizeZ2mBaseTopic(baseTopic) || 'invalid';
  const raw = safePayload(payload) ? z2mValue(payload) : null;
  const rawRecord = recordOf(raw);
  const rows = boundedArray(rawRecord?.nodes, TOPOLOGY_MAX_NODES);
  const rawLinks = boundedArray(rawRecord?.links, TOPOLOGY_MAX_LINKS);
  if (!rows || !rawLinks) return { provider: 'z2m', instanceId: topic, obtainedAt: now,
    freshness: 'fresh-scan', nodes: [], links: [], warnings: [{ code: 'invalid_payload' }] };
  const nodes = new Map<string, ZigbeeTopologyNode>();
  const nodeById = new Map<string, string>();
  for (const row of rows) {
    const record = recordOf(row);
    const ieee = normalizeIeee(record?.ieeeAddr ?? record?.ieee_address ?? record?.ieee);
    if (!ieee) { warnings.push({ code: 'invalid_payload' }); continue; }
    const key = nodeKey('z2m', topic, ieee);
    nodes.set(key, { key, ieee, role: roleOf(record?.type ?? record?.device_type),
      ...(typeof record?.failed === 'boolean' ? { available: !record.failed } : {}) });
    for (const id of [record?.id, record?.networkAddress, record?.network_address]) {
      if (id != null) nodeById.set(String(id), ieee);
    }
  }
  const links = new Map<string, ZigbeeTopologyLink>();
  for (const row of rawLinks) {
    const record = recordOf(row);
    const fromIeee = normalizeIeee(record?.sourceIeeeAddr)
      ?? endpointIeee(record?.source, nodeById);
    const toIeee = normalizeIeee(record?.targetIeeeAddr)
      ?? endpointIeee(record?.target, nodeById);
    if (!fromIeee || !toIeee) { warnings.push({ code: 'invalid_payload' }); continue; }
    const from = nodeKey('z2m', topic, fromIeee);
    const to = nodeKey('z2m', topic, toIeee);
    if (!nodes.has(from)) nodes.set(from, { key: from, ieee: fromIeee, role: 'unknown' });
    if (!nodes.has(to)) nodes.set(to, { key: to, ieee: toIeee, role: 'unknown' });
    pushDirectionalLink(links, warnings, from, to, row);
  }
  return { provider: 'z2m', instanceId: topic, obtainedAt: now,
    freshness: 'fresh-scan', nodes: [...nodes.values()], links: [...links.values()], warnings };
}

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

export type ZigbeeNodePlacement = { markerId: string; space: string };
export type ZigbeeMappedTopology = {
  topology: ZigbeeTopology;
  placements: Map<string, ZigbeeNodePlacement>;
  routes: ZigbeeRouteTree;
};

type ZigbeeAdjacentLink = { neighborKey: string; observation?: ZigbeeDirectionalObservation };

function adjacencyOf(topology: ZigbeeTopology): Map<string, ZigbeeAdjacentLink[]> {
  const nodeKeys = new Set(topology.nodes.map((node) => node.key));
  const adjacency = new Map<string, ZigbeeAdjacentLink[]>();
  for (const key of [...nodeKeys].sort()) adjacency.set(key, []);
  for (const link of [...topology.links].sort((left, right) => (
    `${left.a}\u0000${left.b}`.localeCompare(`${right.a}\u0000${right.b}`)
  ))) {
    if (!nodeKeys.has(link.a) || !nodeKeys.has(link.b)) continue;
    adjacency.get(link.a)!.push({ neighborKey: link.b, observation: link.aToB });
    adjacency.get(link.b)!.push({ neighborKey: link.a, observation: link.bToA });
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.neighborKey.localeCompare(right.neighborKey));
  }
  return adjacency;
}

/** Build one deterministic shortest-path uplink tree without trusting stale provider direction. */
export function buildZigbeeRouteTree(topology: ZigbeeTopology): ZigbeeRouteTree {
  const distances = new Map<string, number>();
  const parents = new Map<string, string>();
  const coordinators = topology.nodes.filter((node) => node.role === 'coordinator')
    .map((node) => node.key).sort();
  if (coordinators.length !== 1) return { distances, parents };
  const coordinatorKey = coordinators[0];
  const adjacency = adjacencyOf(topology);
  if (!adjacency.has(coordinatorKey)) return { distances, parents };
  distances.set(coordinatorKey, 0);
  const queue = [coordinatorKey];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const nextDistance = distances.get(current)! + 1;
    for (const { neighborKey } of adjacency.get(current) || []) {
      if (distances.has(neighborKey)) continue;
      distances.set(neighborKey, nextDistance);
      queue.push(neighborKey);
    }
  }
  for (const nodeKey of [...distances.keys()].sort()) {
    const distance = distances.get(nodeKey)!;
    if (distance === 0) continue;
    const candidates = (adjacency.get(nodeKey) || [])
      .filter(({ neighborKey }) => distances.get(neighborKey) === distance - 1)
      .sort((left, right) => {
        const leftParent = left.observation?.relationship === 'parent' ? 1 : 0;
        const rightParent = right.observation?.relationship === 'parent' ? 1 : 0;
        if (leftParent !== rightParent) return rightParent - leftParent;
        const leftLqi = left.observation?.lqi ?? -1;
        const rightLqi = right.observation?.lqi ?? -1;
        return rightLqi - leftLqi || left.neighborKey.localeCompare(right.neighborKey);
      });
    if (candidates[0]) parents.set(nodeKey, candidates[0].neighborKey);
  }
  return { coordinatorKey, distances, parents };
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

export function mapTopologies(
  topologies: readonly ZigbeeTopology[], devices: readonly DevItem[], registry: HaRegistrySnapshot,
): ZigbeeMappedTopology[] {
  return topologies.map((topology) => ({
    topology,
    placements: mapTopologyNodes(topology, devices, registry).placements,
    routes: buildZigbeeRouteTree(topology),
  }));
}

export function resolveMappedTopologyHover(
  mappedTopologies: readonly ZigbeeMappedTopology[], currentSpace: string, hoveredMarkerId: string,
): ZigbeeHoverResolution {
  const lines = new Map<string, { line: ZigbeeHoverLine;
    directions: Set<NonNullable<ZigbeeHoverLine['routeDirection']>> }>();
  const remote = new Set<string>();
  const parentTargets = new Map<string, ZigbeeParentTarget>();
  let omittedCount = 0;
  for (const { topology, placements, routes } of mappedTopologies) {
    const hoveredNodes = new Set([...placements]
      .filter(([, placement]) => placement.markerId === hoveredMarkerId && placement.space === currentSpace)
      .map(([key]) => key));
    if (!hoveredNodes.size) continue;
    for (const hoveredNode of hoveredNodes) {
      const parentKey = routes.parents.get(hoveredNode);
      if (!parentKey) continue;
      const parentPlacement = placements.get(parentKey);
      if (parentPlacement?.space === currentSpace) continue;
      let target: ZigbeeParentTarget;
      if (parentPlacement) target = { kind: 'remote-space', spaceId: parentPlacement.space };
      else target = topology.nodes.find((node) => node.key === parentKey)?.role === 'coordinator'
        ? { kind: 'unplaced-coordinator' } : { kind: 'unplaced-device' };
      const targetKey = target.kind === 'remote-space' ? `${target.kind}:${target.spaceId}` : target.kind;
      parentTargets.set(targetKey, target);
    }
    for (const link of topology.links) {
      const fromA = hoveredNodes.has(link.a);
      const fromB = hoveredNodes.has(link.b);
      if (!fromA && !fromB) continue;
      const hoveredNode = fromA ? link.a : link.b;
      const otherKey = fromA ? link.b : link.a;
      const other = placements.get(otherKey);
      if (!other || other.markerId === hoveredMarkerId) { omittedCount++; continue; }
      const isParent = routes.parents.get(hoveredNode) === otherKey;
      if (other.space !== currentSpace) {
        if (!isParent) remote.add(other.markerId);
        continue;
      }
      const obs = fromA ? link.aToB : link.bToA;
      const direction = isParent ? 'toward-neighbor'
        : routes.parents.get(otherKey) === hoveredNode ? 'toward-origin' : undefined;
      const existing = lines.get(other.markerId);
      if (!existing) {
        lines.set(other.markerId, { line: { neighborMarkerId: other.markerId, lqi: obs?.lqi },
          directions: new Set(direction ? [direction] : []) });
      } else {
        if (existing.line.lqi === undefined && obs?.lqi !== undefined) existing.line.lqi = obs.lqi;
        if (direction) existing.directions.add(direction);
      }
    }
  }
  return {
    lines: [...lines.values()].map(({ line, directions }) => directions.size === 1
      ? { ...line, routeDirection: [...directions][0] } : line),
    remoteCount: remote.size,
    omittedCount,
    parentTargets: [...parentTargets.values()],
  };
}

/** Resolve only the edges incident to the marker currently under the mouse. */
export function resolveTopologyHover(
  topologies: readonly ZigbeeTopology[], devices: readonly DevItem[],
  registry: HaRegistrySnapshot, currentSpace: string, hoveredMarkerId: string,
): ZigbeeHoverResolution {
  return resolveMappedTopologyHover(
    mapTopologies(topologies, devices, registry), currentSpace, hoveredMarkerId,
  );
}
