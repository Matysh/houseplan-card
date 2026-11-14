/** Optimize reconciliation reuses the ordinary authoritative reader and gated adopter. */
import type { GatedAdoptionInput, GatedAdoptionResult, LayoutResponse } from './config-adoption';
import type { LayoutWriteReload } from './layout-write-reload';
import { sameOptimizeSource, type OptimizeSource } from './optimize-source';
import type { AuthoritativeConfigResponse } from './version-recovery-card';
import type { UndoHass } from './plan-optimize-undo';
import { planHostOf, type PlanHostProvider } from './ha-plan-host';
import type { PlanHost } from './plan-host';

export type OptimizeReloadResult = 'adopted' | 'superseded' | 'failed';
interface OptimizeReloadPort extends PlanHostProvider {
  source(): OptimizeSource;
  pending(): boolean;
  layoutIO: LayoutWriteReload;
  read(input: UndoHass | PlanHost, current: () => boolean): Promise<AuthoritativeConfigResponse>;
  adopt(input: GatedAdoptionInput): Promise<GatedAdoptionResult>;
}

export async function reloadOptimizePair(port: OptimizeReloadPort): Promise<OptimizeReloadResult> {
  const source = port.source();
  const authority = () => source.authorityCurrent?.() !== false
    && port.source().connection === source.connection;
  const current = () => authority() && !port.pending() && sameOptimizeSource(source, port.source());
  if (!current()) return 'superseded';
  try {
    const result = await port.layoutIO.reconcile(() => Promise.all([
      port.read(planHostOf(port), current), planHostOf(port).request<LayoutResponse>({ type: 'houseplan/layout/get' }),
    ]), async ([cfgResp, layResp], pairCurrent) => {
      // A fulfilled void refresh or a local dirty overlay is not server evidence.
      if (!cfgResp?.config || !Array.isArray(cfgResp.config.spaces)
        || !Number.isSafeInteger(cfgResp.rev) || Number(cfgResp.rev) < source.configRev
        || !layResp?.layout || typeof layResp.layout !== 'object' || Array.isArray(layResp.layout)
        || !Number.isSafeInteger(layResp.rev) || Number(layResp.rev) < source.layoutRev)
        throw new Error('Incomplete authoritative Optimize pair');
      return port.adopt({ cfgResp, layResp, reason: 'structural-response', profile: 'reload', isCurrent: pairCurrent });
    }, current);
    // The adopter itself changes the baseline; only authority is checked after adoption.
    return result.status === 'adopted' && authority() ? 'adopted' : 'superseded';
  } catch {
    return authority() ? 'failed' : 'superseded';
  }
}
