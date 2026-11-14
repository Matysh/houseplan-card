import { planHostOf } from '../../test-build/ha-plan-host.js';

/** A stable provider lets legacy fake HA snapshots exercise the same port epoch
 * as the real card, without recursively reading the fixture's planHost getter. */
export function attachPlanHost(host) {
  const provider = { get hass() { return host.hass; } };
  Object.defineProperty(host, 'planHost', { get: () => planHostOf(provider), configurable: true });
  Object.defineProperty(host, '_presentation', { get: () => host.planHost.environment.presentation, configurable: true });
  return host;
}
