// #500: test hosts mirror the card's delegation — identity lives in a real
// `ConfigAdoption`, the six host fields are accessors over it, bodies may be
// staged through the setters exactly as production code does.
import { createConfigAdoption } from '../../test-build/config-adoption.js';

/**
 * Install `_adoption` and the delegating accessors on a plain host stub.
 * `identity` seeds config/layout with revisions; fingerprints are computed.
 */
export function installAdoption(host, { config = null, layout = {}, configRev = 0, layoutRev = 0 } = {}) {
  const adoption = createConfigAdoption();
  if (config) {
    adoption.restoreCached({ config, rev: configRev, layout, layout_rev: layoutRev });
  } else {
    adoption.stageLocalLayout(layout);
    adoption.noteLayoutRevision(layoutRev);
  }
  Object.defineProperties(host, {
    _adoption: { value: adoption, enumerable: true },
    _serverCfg: {
      get: () => adoption.config,
      set: (next) => adoption.stageLocalConfig(next),
      enumerable: true,
    },
    _layout: {
      get: () => adoption.layout,
      set: (next) => adoption.stageLocalLayout(next),
      enumerable: true,
    },
    _cfgRev: { get: () => adoption.configRev, enumerable: true },
    _layoutRev: { get: () => adoption.layoutRev, enumerable: true },
    _cfgContentFingerprint: { get: () => adoption.configFingerprint, enumerable: true },
    _layoutContentFingerprint: { get: () => adoption.layoutFingerprint, enumerable: true },
    _rollbackOptimistic: {
      value: (attempt) => {
        const rolledBack = adoption.rollbackOptimistic(attempt);
        if (rolledBack) host.requestUpdate?.();
        return rolledBack;
      },
      enumerable: true,
    },
  });
  return adoption;
}
