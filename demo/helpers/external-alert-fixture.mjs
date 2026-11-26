/** Synthetic frames use the same private subscription as HA. */
export async function installExternalAlertFixture(page, cardName = '__card') {
  await page.evaluate(name => {
    const card = window[name];
    const original = card.hass.connection;
    const listeners = new Set();
    let frame = { signals: [] };
    const connection = {
      ...original,
      async subscribeMessage(receive, command, options) {
        if (command.type !== 'houseplan/external_alerts/subscribe') {
          return original.subscribeMessage?.(receive, command, options) || (() => {});
        }
        listeners.add(receive);
        receive(frame);
        return () => listeners.delete(receive);
      },
    };
    card.hass = { ...card.hass, connection, config: { ...card.hass.config, time_zone: 'UTC' } };
    window.__publishExternalAlerts = signals => {
      frame = { signals };
      for (const listener of listeners) listener(frame);
    };
  }, cardName);
}

export function externalSignal(markerId, level, binding = `device:${markerId}`) {
  return { id: 'synthetic/signal', owners: [{ id: markerId, binding }], level,
    message: 'Температура выше порога', changed_at: '2026-01-01T12:00:00Z' };
}
