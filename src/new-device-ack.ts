import { supersedeDeferredWrite, type ConfigAdoption, type DeferredConfigWrite } from './config-adoption';
import type { ServerConfig } from './types';
import type { OptimisticAttempt } from './serialized-write-queue';

interface AckHost {
  _adoption: ConfigAdoption;
  _saveConfigDebounced: DeferredConfigWrite;
  _writeConfig(attempt: OptimisticAttempt<ServerConfig>): Promise<void>;
  _rollbackOptimistic(attempt: OptimisticAttempt<ServerConfig>): boolean;
  _reloadConfigOnly(): Promise<void>;
  requestUpdate(): void;
}

/** One explicit visit owns one ack. Rejection restores attention, never auto-retries the ack. */
export async function acknowledgeNewDevice(host: AckHost, id: string): Promise<void> {
  const previous = host._adoption.config;
  if (!previous || !previous.settings?.new_device_ids?.includes(id)) return;
  const candidate: ServerConfig = { ...previous, settings: {
    ...previous.settings, new_device_ids: previous.settings.new_device_ids.filter((item) => item !== id),
  } };
  const attempt = host._adoption.beginOptimistic(previous, candidate);
  const epoch = host._adoption.adoptionEpoch;
  const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
  host._adoption.stageLocalConfig(candidate);
  host.requestUpdate();
  try {
    await host._writeConfig(attempt);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'conflict') await host._reloadConfigOnly().catch(() => undefined);
    else {
      const rolledBack = host._rollbackOptimistic(attempt);
      if (!rolledBack && host._adoption.configRev === attempt.revision && host._adoption.adoptionEpoch === epoch) {
        // A newer local discovery/edit is independent: restore only our ID, not its document.
        const current = host._adoption.config;
        if (current && !current.settings?.new_device_ids?.includes(id)) host._adoption.stageLocalConfig({
          ...current, settings: { ...current.settings, new_device_ids: [...(current.settings?.new_device_ids ?? []), id] },
        });
      }
      restoreDeferred(rolledBack);
    }
  }
  host.requestUpdate();
}
