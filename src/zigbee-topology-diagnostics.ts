import { mapTopologyNodes, resolveProviderUplinks, type ZigbeeTopology, type ZigbeeTopologyWarning, type ZigbeeUplink } from './zigbee-topology';
import type { ZigbeeProviderState, ZigbeeTopologyErrorCode } from './zigbee-topology-runtime';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';

export type ZigbeeDiagnosticCode = 'invalid_payload' | 'duplicate_link' | 'self_link' | 'provider_scan_failure' | 'provider_unavailable'
  | 'unmatched_device' | 'registry_missing' | 'registry_ambiguous' | 'placement_missing' | 'ambiguous_placement'
  | 'route_missing' | 'route_conflict' | 'route_unresolved' | 'route_cycle' | 'route_unknown_role' | 'provider_partial';
export interface ZigbeeDiagnosticReason {
  code: ZigbeeDiagnosticCode;
  /** Provider-scoped identity; a label is never used for matching. */
  nodeKey?: string;
  nodeLabel?: string;
  failedStages?: string[];
  unknownStage?: boolean;
}
export interface ZigbeeTopologyDiagnostics {
  loaded: boolean;
  partial: boolean;
  hasKnownRoute: boolean;
  reasons: ZigbeeDiagnosticReason[];
  refreshError?: ZigbeeTopologyErrorCode;
  /** Visibility intent is informational, independent of provider completeness. */
  hidden?: Array<{ nodeKey: string; nodeLabel: string; shown: boolean }>;
}

/** Read-only projection of exactly the settings status' existing partial rule. */
export function describeZigbeeTopology(options: {
  current?: ZigbeeProviderState;
  topology?: ZigbeeTopology;
  devices: readonly DevItem[];
  registry?: HaRegistrySnapshot;
}): ZigbeeTopologyDiagnostics {
  const { current, topology, devices, registry } = options;
  const loaded = current?.obtainedAt !== undefined;
  if (!loaded) return { loaded: false, partial: false, hasKnownRoute: false, reasons: [] };
  const placement = topology && registry ? mapTopologyNodes(topology, devices, registry) : undefined;
  const mapping = placement?.warnings || [];
  const nodes = new Map(topology?.nodes.map(node => [node.key, node]));
  const label = (key: string): string => {
    const node = nodes.get(key);
    return node ? (node.name ? `${node.name} (${node.ieee})` : node.ieee) : key;
  };
  const hidden = [...(placement?.hiddenPlacements || [])].map(([nodeKey, visibility]) =>
    ({ nodeKey, nodeLabel: label(nodeKey), shown: visibility === 'shown' }));
  const visibility = hidden.length ? { hidden } : {};
  const routes = topology ? resolveProviderUplinks(topology) : new Map<string, ZigbeeUplink>();
  const hasKnownRoute = [...routes.values()].some(route => route.kind === 'known');
  const partial = !!current?.partial || mapping.length > 0
    || [...routes.values()].some(route => route.kind === 'unknown');
  if (!partial) return { loaded, partial: false, hasKnownRoute, reasons: [], ...visibility };
  const reasons = new Map<string, ZigbeeDiagnosticReason>();
  const add = (code: ZigbeeDiagnosticCode, nodeKey?: string, detail?: ZigbeeTopologyWarning): void => {
    const key = `${code}\0${nodeKey ?? ''}`;
    const nodeLabel = nodeKey ? label(nodeKey) : undefined;
    const previous = reasons.get(key);
    const stages = [...new Set([...(previous?.failedStages || []), ...(detail?.failedStages || [])])];
    reasons.set(key, { code, ...(nodeKey ? { nodeKey, nodeLabel } : {}),
      ...(stages.length ? { failedStages: stages } : {}),
      ...(previous?.unknownStage || detail?.unknownStage ? { unknownStage: true } : {}) });
  };
  for (const warning of [...(topology?.warnings || []), ...mapping]) {
    const route = warning.nodeKey ? routes.get(warning.nodeKey) : undefined;
    if (warning.code === 'route_unknown' && route?.kind === 'unknown') continue;
    if (warning.code === 'route_unresolved' && route?.kind === 'unknown' && route.reason === 'unresolved') continue;
    const code: ZigbeeDiagnosticCode = warning.code === 'unmatched_device'
      ? warning.mappingReason === 'registry-missing' ? 'registry_missing'
        : warning.mappingReason === 'registry-ambiguous' ? 'registry_ambiguous'
          : warning.mappingReason === 'placement-missing' ? 'placement_missing' : 'unmatched_device'
      : warning.code === 'route_unknown' ? 'route_missing'
        : warning.code === 'provider_scan_failure' && topology?.provider === 'zha'
          && nodes.get(warning.nodeKey || '')?.available === false ? 'provider_unavailable' : warning.code;
    add(code, warning.nodeKey, warning);
  }
  for (const [key, route] of routes) if (route.kind === 'unknown') {
    const code: ZigbeeDiagnosticCode = route.reason === 'missing' ? 'route_missing'
      : route.reason === 'conflict' ? 'route_conflict' : route.reason === 'cycle' ? 'route_cycle'
        : route.reason === 'unknown-role' ? 'route_unknown_role' : 'route_unresolved';
    add(code, key);
  }
  // An opaque provider flag is still unexplained even if placement has other,
  // independently known issues. Do not silently attribute that flag to them.
  if ((current?.partial && !topology?.warnings.length) || !reasons.size) add('provider_partial');
  return { loaded, partial, hasKnownRoute, reasons: [...reasons.values()], ...visibility,
    ...(current?.phase === 'error' && current.error ? { refreshError: current.error } : {}) };
}
