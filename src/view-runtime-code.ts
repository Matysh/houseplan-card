import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { ViewRuntimeCode, assertViewRuntimeFingerprint } from './view-runtime-boundary';
import { viewRuntimeRetryUrl } from './view-runtime-retry';
import type { LiveRuntime } from './live-interaction-runtime';
import type { ViewDeviceMenu } from './view-device-menu';

export const deviceMenuCode = new ViewRuntimeCode<object, ViewDeviceMenu>(async attempt => {
  const module = attempt === 0 ? await import('./view-device-menu')
    : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_DEVICE_MENU_RETRY_ASSET__', import.meta.url)) as typeof import('./view-device-menu');
  assertViewRuntimeFingerprint(module.VIEW_DEVICE_MENU_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
  return host => new module.ViewDeviceMenu(host);
});

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
