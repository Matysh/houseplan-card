import { normalizeZ2mBaseTopic } from './zigbee-topology-settings';

export type ZigbeeProvider = 'zha' | 'z2m';
export type ZigbeeRole = 'coordinator' | 'router' | 'end' | 'unknown';
export interface ZigbeeDirectionalObservation { lqi?: number; relationship?: string }
export interface ZigbeeTopologyNode {
  key: string; ieee: string; deviceId?: string; role: ZigbeeRole;
  available?: boolean; nwk?: number; name?: string;
}
export interface ZigbeeTopologyLink {
  a: string; b: string; aToB?: ZigbeeDirectionalObservation; bToA?: ZigbeeDirectionalObservation;
}
export type ZigbeeTopologyWarningCode = 'invalid_payload' | 'duplicate_link' | 'self_link'
  | 'unmatched_device' | 'ambiguous_placement' | 'provider_scan_failure' | 'route_unknown' | 'route_unresolved';
export interface ZigbeeTopologyWarning { code: ZigbeeTopologyWarningCode; nodeKey?: string }
export interface ZigbeeUplinkEvidence {
  from: string;
  /** Missing target deliberately preserves an unresolvable claim, rather than discarding a conflict. */
  to?: string;
  kind: 'end-parent' | 'route-to-coordinator';
  lqi?: number;
}
export type ZigbeeUplink =
  | { kind: 'known'; targetKey: string; evidence: ZigbeeUplinkEvidence['kind']; lqi?: number }
  | { kind: 'unknown'; reason: 'missing' | 'conflict' | 'unresolved' | 'cycle' | 'unknown-role' }
  | { kind: 'root' };
export interface ZigbeeTopology {
  provider: ZigbeeProvider; instanceId: string; obtainedAt: number;
  freshness: 'provider-cache' | 'fresh-scan';
  nodes: ZigbeeTopologyNode[]; links: ZigbeeTopologyLink[];
  uplinkEvidence: ZigbeeUplinkEvidence[]; warnings: ZigbeeTopologyWarning[];
}
export const TOPOLOGY_STALE_MS = 5 * 60 * 1000;
export const TOPOLOGY_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const TOPOLOGY_MAX_NODES = 1000;
export const TOPOLOGY_MAX_LINKS = 6000;

export function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function normalizeIeee(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let text = String(value).trim().toLowerCase();
  if (/^0x[0-9a-f]{16}$/.test(text)) text = text.slice(2);
  else text = text.replace(/[:-]/g, '');
  return /^[0-9a-f]{16}$/.test(text) ? text : null;
}
export function normalizeZigbeeNwk(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string'
      || !/^(?:0x[0-9a-f]{1,4}|\d+)$/i.test(value.trim()))) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 0xffff ? number : undefined;
}
function lqiOf(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string'
      || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 255 ? Math.round(number) : undefined;
}
export function topologyName(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim().slice(0, 255) || undefined : undefined;
}
function roleOf(value: unknown): ZigbeeRole {
  const role = String(value || '').toLowerCase().replace(/[ _-]/g, '');
  return role === 'coordinator' ? 'coordinator' : role === 'router' ? 'router'
    : role === 'enddevice' || role === 'end' ? 'end' : 'unknown';
}
function relationshipOf(value: unknown): string | undefined {
  if (typeof value === 'number') return ['parent', 'child', 'sibling', 'none', 'previous_child'][value];
  const compact = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s_-]+/g, '') : '';
  return compact === 'previouschild' ? 'previous_child' : compact.slice(0, 40) || undefined;
}
function observation(value: Record<string, unknown>): ZigbeeDirectionalObservation {
  return { lqi: lqiOf(value.lqi ?? value.linkquality ?? value.link_quality),
    relationship: relationshipOf(value.relationship) };
}
function safePayload(value: unknown): boolean {
  try { return (typeof value === 'string' ? value : JSON.stringify(value)).length <= TOPOLOGY_MAX_PAYLOAD_BYTES; }
  catch { return false; }
}
function boundedArray(value: unknown, max: number): unknown[] | null {
  return Array.isArray(value) && value.length <= max ? value : null;
}
function topologyOf(provider: ZigbeeProvider, instanceId: string, now: number): ZigbeeTopology {
  return { provider, instanceId, obtainedAt: now, freshness: provider === 'zha' ? 'provider-cache' : 'fresh-scan',
    nodes: [], links: [], uplinkEvidence: [], warnings: [] };
}
function warn(topology: ZigbeeTopology, code: ZigbeeTopologyWarningCode, nodeKey?: string): void {
  if (topology.warnings.length < TOPOLOGY_MAX_LINKS) topology.warnings.push({ code, ...(nodeKey ? { nodeKey } : {}) });
  else if (code === 'route_unresolved') topology.warnings[topology.warnings.length - 1] = { code };
}
function keyOf(topology: ZigbeeTopology, ieee: string): string {
  return `${topology.provider}:${topology.instanceId}:${ieee}`;
}
function addNode(topology: ZigbeeTopology, nodes: Map<string, ZigbeeTopologyNode>, node: ZigbeeTopologyNode): void {
  const previous = nodes.get(node.key);
  if (!previous) { nodes.set(node.key, node); return; }
  if (previous.role !== node.role || previous.nwk !== node.nwk || previous.deviceId !== node.deviceId) {
    // Conflicting identity metadata must not pick a source role or serve as a valid target.
    warn(topology, 'route_unresolved', node.key);
    previous.role = 'unknown'; previous.nwk = undefined; previous.deviceId = undefined;
  }
}
function indexAddresses(nodes: Iterable<ZigbeeTopologyNode>): Map<number, Set<string>> {
  const addresses = new Map<number, Set<string>>();
  for (const node of nodes) if (node.nwk !== undefined) {
    const keys = addresses.get(node.nwk) || new Set<string>();
    keys.add(node.key); addresses.set(node.nwk, keys);
  }
  return addresses;
}
function uniqueAddress(addresses: Map<number, Set<string>>, nwk: number | undefined): string | undefined {
  const keys = nwk === undefined ? undefined : addresses.get(nwk);
  return keys?.size === 1 ? [...keys][0] : undefined;
}
function pushEvidence(topology: ZigbeeTopology, evidence: ZigbeeUplinkEvidence): void {
  if (topology.uplinkEvidence.length < TOPOLOGY_MAX_LINKS) topology.uplinkEvidence.push(evidence);
  else warn(topology, 'route_unresolved');
}
function pushNeighbor(topology: ZigbeeTopology, links: Map<string, ZigbeeTopologyLink>,
  reporter: string, neighbor: string, row: Record<string, unknown>): void {
  if (reporter === neighbor) {
    warn(topology, 'self_link', reporter);
    const relationship = relationshipOf(row.relationship);
    if (relationship === 'parent' || relationship === 'child') {
      pushEvidence(topology, { from: reporter, kind: 'end-parent' });
    }
    return;
  }
  const forward = reporter < neighbor;
  const pair = forward ? `${reporter}|${neighbor}` : `${neighbor}|${reporter}`;
  const link = links.get(pair) || { a: forward ? reporter : neighbor, b: forward ? neighbor : reporter };
  const field = forward ? 'aToB' : 'bToA';
  const obs = observation(row);
  if (link[field]) warn(topology, 'duplicate_link', reporter);
  else link[field] = obs;
  links.set(pair, link);
  if (obs.relationship === 'parent') pushEvidence(topology, { from: reporter, to: neighbor, kind: 'end-parent', lqi: obs.lqi });
  if (obs.relationship === 'child') pushEvidence(topology, { from: neighbor, to: reporter, kind: 'end-parent', lqi: obs.lqi });
}

/** Suppress only cycle members; a known earlier hop does not promise the whole chain. */
export function suppressUplinkCycles(routes: Map<string, ZigbeeUplink>): void {
  const done = new Set<string>();
  for (const start of routes.keys()) {
    const path: string[] = []; const positions = new Map<string, number>();
    let key = start;
    while (!done.has(key)) {
      const seen = positions.get(key);
      if (seen !== undefined) {
        for (const member of path.slice(seen)) routes.set(member, { kind: 'unknown', reason: 'cycle' });
        break;
      }
      const route = routes.get(key);
      if (route?.kind !== 'known') break;
      positions.set(key, path.length); path.push(key); key = route.targetKey;
    }
    for (const member of path) done.add(member);
  }
}

/** Accept provider claims only. No shortest-path, signal ranking or role inference. */
export function resolveProviderUplinks(topology: ZigbeeTopology): Map<string, ZigbeeUplink> {
  const nodes = new Map(topology.nodes.map((node) => [node.key, node]));
  const candidates = new Map<string, ZigbeeUplinkEvidence[]>();
  for (const evidence of topology.uplinkEvidence) {
    const role = nodes.get(evidence.from)?.role;
    if ((role === 'end' && evidence.kind === 'end-parent')
        || (role === 'router' && evidence.kind === 'route-to-coordinator')) {
      const list = candidates.get(evidence.from) || []; list.push(evidence); candidates.set(evidence.from, list);
    }
  }
  const routes = new Map<string, ZigbeeUplink>();
  const truncated = topology.warnings.some((item) => item.code === 'route_unresolved' && !item.nodeKey);
  for (const node of topology.nodes) {
    if (node.role === 'coordinator') { routes.set(node.key, { kind: 'root' }); continue; }
    const evidence = candidates.get(node.key) || [];
    const targets = new Set(evidence.map((item) => item.to));
    const targetKey = [...targets][0];
    const target = targetKey ? nodes.get(targetKey) : undefined;
    if (truncated || topology.warnings.some((item) => item.code === 'route_unresolved' && item.nodeKey === node.key)) {
      routes.set(node.key, { kind: 'unknown', reason: 'unresolved' });
    } else if (node.role === 'unknown') routes.set(node.key, { kind: 'unknown', reason: 'unknown-role' });
    else if (!evidence.length) routes.set(node.key, { kind: 'unknown', reason: 'missing' });
    else if (targets.has(undefined) || !target || (target.role !== 'router' && target.role !== 'coordinator')) {
      routes.set(node.key, { kind: 'unknown', reason: 'unresolved' });
    } else if (targets.size !== 1) routes.set(node.key, { kind: 'unknown', reason: 'conflict' });
    else routes.set(node.key, { kind: 'known', targetKey: target.key, evidence: evidence[0].kind,
      lqi: evidence.find((item) => item.lqi !== undefined)?.lqi });
  }
  suppressUplinkCycles(routes);
  return routes;
}
function finish(topology: ZigbeeTopology, nodes: Map<string, ZigbeeTopologyNode>, links: Map<string, ZigbeeTopologyLink>): ZigbeeTopology {
  topology.nodes = [...nodes.values()]; topology.links = [...links.values()];
  // A route can be reported without an LQI observation in that direction.
  const pairs = new Map(topology.links.map((link) => [`${link.a}|${link.b}`, link]));
  for (const evidence of topology.uplinkEvidence) if (evidence.lqi === undefined && evidence.to) {
    const forward = evidence.from < evidence.to;
    const pair = pairs.get(forward ? `${evidence.from}|${evidence.to}` : `${evidence.to}|${evidence.from}`);
    evidence.lqi = (forward ? pair?.aToB?.lqi : pair?.bToA?.lqi)
      ?? (forward ? pair?.bToA?.lqi : pair?.aToB?.lqi);
  }
  for (const [key, route] of resolveProviderUplinks(topology)) {
    if (route.kind === 'unknown') warn(topology, 'route_unknown', key);
  }
  return topology;
}

/** ZHA neighbors belong to each reporting row; route addresses are its routing table. */
export function normalizeZhaTopology(payload: unknown, now = Date.now()): ZigbeeTopology {
  const topology = topologyOf('zha', 'zha', now);
  const rows = safePayload(payload) ? boundedArray(payload, TOPOLOGY_MAX_NODES) : null;
  if (!rows) { warn(topology, 'invalid_payload'); return topology; }
  const nodes = new Map<string, ZigbeeTopologyNode>(); const links = new Map<string, ZigbeeTopologyLink>();
  for (const row of rows) {
    const value = recordOf(row); const ieee = normalizeIeee(value?.ieee ?? value?.ieee_address);
    if (!ieee || !value) { warn(topology, 'invalid_payload'); continue; }
    const key = keyOf(topology, ieee);
    addNode(topology, nodes, { key, ieee, role: roleOf(value.device_type ?? value.type), nwk: normalizeZigbeeNwk(value.nwk),
      name: topologyName(value.user_given_name) ?? topologyName(value.name),
      ...(typeof value.device_reg_id === 'string' ? { deviceId: value.device_reg_id } : {}),
      ...(typeof value.available === 'boolean' ? { available: value.available } : {}) });
  }
  let neighborsRead = 0;
  for (const row of rows) {
    const value = recordOf(row); const ieee = normalizeIeee(value?.ieee ?? value?.ieee_address);
    if (!ieee || !value) continue;
    const reporter = keyOf(topology, ieee);
    const neighbors = boundedArray(value.neighbors, TOPOLOGY_MAX_LINKS);
    if (!neighbors) {
      if (Array.isArray(value.neighbors)) warn(topology, 'route_unresolved');
      else if (value.neighbors != null) warn(topology, 'invalid_payload', reporter);
      continue;
    }
    for (const neighbor of neighbors) {
      if (++neighborsRead > TOPOLOGY_MAX_LINKS) { warn(topology, 'route_unresolved'); break; }
      const item = recordOf(neighbor); const other = normalizeIeee(item?.ieee ?? item?.ieee_address);
      if (!other || !item) {
        warn(topology, 'invalid_payload', reporter);
        if (relationshipOf(item?.relationship) === 'parent') pushEvidence(topology, { from: reporter, kind: 'end-parent' });
        continue;
      }
      const key = keyOf(topology, other);
      if (!nodes.has(key)) {
        if (nodes.size >= TOPOLOGY_MAX_NODES) { warn(topology, 'route_unresolved'); continue; }
        nodes.set(key, { key, ieee: other, role: roleOf(item.device_type), nwk: normalizeZigbeeNwk(item.nwk), name: topologyName(item.name) });
      }
      pushNeighbor(topology, links, reporter, key, item);
    }
  }
  const addresses = indexAddresses(nodes.values()); let routesRead = 0;
  for (const row of rows) {
    const value = recordOf(row); const ieee = normalizeIeee(value?.ieee ?? value?.ieee_address);
    if (!ieee || !value) continue;
    const from = keyOf(topology, ieee); const routes = boundedArray(value.routes, TOPOLOGY_MAX_LINKS);
    if (!routes) { if (value.routes != null) warn(topology, 'route_unresolved', from); continue; }
    for (const rawRoute of routes) {
      if (++routesRead > TOPOLOGY_MAX_LINKS) { warn(topology, 'route_unresolved'); break; }
      const route = recordOf(rawRoute);
      if (route?.route_status !== 'Active') continue;
      const destination = normalizeZigbeeNwk(route.dest_nwk);
      if (destination !== 0 && destination !== undefined) continue;
      pushEvidence(topology, { from, kind: 'route-to-coordinator', to: destination === undefined ? undefined
        : uniqueAddress(addresses, normalizeZigbeeNwk(route.next_hop)) });
    }
  }
  return finish(topology, nodes, links);
}

function z2mValue(payload: unknown): unknown {
  try {
    let value = typeof payload === 'string' ? JSON.parse(payload) as unknown : payload;
    const envelope = recordOf(value); const data = recordOf(envelope?.data);
    value = data?.value ?? envelope?.value ?? envelope?.data ?? value;
    return typeof value === 'string' ? JSON.parse(value) as unknown : value;
  } catch { return null; }
}
/** Z2M source is the neighbor, target is the reporting/table-owning device. */
export function normalizeZ2mTopology(payload: unknown, baseTopic: string, now = Date.now()): ZigbeeTopology {
  const topology = topologyOf('z2m', normalizeZ2mBaseTopic(baseTopic) || 'invalid', now);
  const raw = recordOf(safePayload(payload) ? z2mValue(payload) : null);
  const rows = boundedArray(raw?.nodes, TOPOLOGY_MAX_NODES); const rawLinks = boundedArray(raw?.links, TOPOLOGY_MAX_LINKS);
  if (!rows || !rawLinks) { warn(topology, 'invalid_payload'); return topology; }
  const nodes = new Map<string, ZigbeeTopologyNode>(); const links = new Map<string, ZigbeeTopologyLink>();
  for (const row of rows) {
    const value = recordOf(row); const ieee = normalizeIeee(value?.ieeeAddr ?? value?.ieee_address ?? value?.ieee);
    if (!ieee || !value) { warn(topology, 'invalid_payload'); continue; }
    const key = keyOf(topology, ieee);
    addNode(topology, nodes, { key, ieee, role: roleOf(value.type ?? value.device_type),
      nwk: normalizeZigbeeNwk(value.networkAddress ?? value.network_address ?? value.id),
      name: topologyName(value.friendlyName ?? value.friendly_name),
      ...(typeof value.failed === 'boolean' ? { available: !value.failed } : {}) });
    if (Array.isArray(value.failed) && value.failed.length) warn(topology, 'provider_scan_failure', key);
  }
  const addresses = indexAddresses(nodes.values());
  const endpoint = (flat: unknown, value: unknown): string | undefined => {
    const record = recordOf(value);
    const ieee = normalizeIeee(flat) ?? normalizeIeee(record?.ieeeAddr ?? record?.ieee_address ?? record?.ieee ?? value);
    if (ieee) {
      const key = keyOf(topology, ieee);
      if (!nodes.has(key) && nodes.size < TOPOLOGY_MAX_NODES) nodes.set(key, { key, ieee, role: 'unknown' });
      return nodes.has(key) ? key : undefined;
    }
    return uniqueAddress(addresses, normalizeZigbeeNwk(record?.networkAddress ?? record?.network_address ?? record?.id ?? value));
  };
  let routesRead = 0;
  for (const rawLink of rawLinks) {
    const row = recordOf(rawLink); if (!row) { warn(topology, 'invalid_payload'); continue; }
    const source = endpoint(row.sourceIeeeAddr, row.source); const target = endpoint(row.targetIeeeAddr, row.target);
    if (source && target) pushNeighbor(topology, links, target, source, row);
    else {
      warn(topology, 'invalid_payload', target);
      const relation = relationshipOf(row.relationship);
      if (relation === 'parent' && target) pushEvidence(topology, { from: target, kind: 'end-parent' });
      if (relation === 'child' && source) pushEvidence(topology, { from: source, kind: 'end-parent' });
    }
    const routes = boundedArray(row.routes, TOPOLOGY_MAX_LINKS);
    if (!routes) { if (row.routes != null) warn(topology, 'route_unresolved', target); continue; }
    for (const rawRoute of routes) {
      if (++routesRead > TOPOLOGY_MAX_LINKS) { warn(topology, 'route_unresolved'); break; }
      const route = recordOf(rawRoute);
      if (route?.status !== 'ACTIVE' || !target) continue;
      const destination = normalizeZigbeeNwk(route.destinationAddress);
      if (destination !== 0 && destination !== undefined) continue;
      const hop = uniqueAddress(addresses, normalizeZigbeeNwk(route.nextHopAddress));
      pushEvidence(topology, { from: target, kind: 'route-to-coordinator',
        to: destination === 0 && source === hop ? hop : undefined, lqi: observation(row).lqi });
    }
  }
  return finish(topology, nodes, links);
}
