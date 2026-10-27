import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { ViewRuntimeCode, assertViewRuntimeFingerprint } from './view-runtime-boundary';
import { viewRuntimeRetryUrl } from './view-runtime-retry';
import type { LiveRuntime } from './live-interaction-runtime';
import type { MarkerAlertViewRuntime } from './marker-alert-view-runtime';

export const liveRuntimeCode = new ViewRuntimeCode<object, LiveRuntime>(async attempt => {
  const module = attempt === 0 ? await import('./live-interaction-runtime')
    : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_LIVE_RETRY_ASSET__', import.meta.url)) as typeof import('./live-interaction-runtime');
  assertViewRuntimeFingerprint(module.LIVE_RUNTIME_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
  return host => new module.LiveRuntime(host);
});

export const zigbeeOverlayCode = new ViewRuntimeCode<object, true>(async attempt => {
  const module = attempt === 0 ? await import('./hp-zigbee-topology-overlay')
    : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_ZIGBEE_OVERLAY_RETRY_ASSET__', import.meta.url)) as typeof import('./hp-zigbee-topology-overlay');
  assertViewRuntimeFingerprint(module.ZIGBEE_OVERLAY_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
  return () => module.installZigbeeTopologyOverlay();
});

export const converterInfoCode = new ViewRuntimeCode<object, true>(async attempt => {
  const module = attempt === 0 ? await import('./hp-plan-converter-info')
    : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_CONVERTER_INFO_RETRY_ASSET__', import.meta.url)) as typeof import('./hp-plan-converter-info');
  assertViewRuntimeFingerprint(module.CONVERTER_INFO_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
  return () => module.installPlanConverterInfo();
});

export const markerAlertCode = new ViewRuntimeCode<object, MarkerAlertViewRuntime>(async attempt => {
  const module = attempt === 0 ? await import('./marker-alert-view-runtime')
    : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_MARKER_ALERT_RETRY_ASSET__', import.meta.url)) as typeof import('./marker-alert-view-runtime');
  assertViewRuntimeFingerprint(module.MARKER_ALERT_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
  return host => new module.MarkerAlertViewRuntime(host);
});
