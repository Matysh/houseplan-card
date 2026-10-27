/** Picture-elements actions translated into the existing, closed marker action model. */
import { validEntity } from './easy-style.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const only = (value, keys) => Object.keys(value).every(key => keys.includes(key));
const own = (value, key) => Object.hasOwn(value, key);
const RESERVED_SCRIPT_SERVICES = new Set(['script.turn_on', 'script.turn_off', 'script.toggle', 'script.reload']);

function targetOf(value) {
  if (value === undefined) return { entity: null, empty: true };
  if (!record(value) || !only(value, ['entity_id'])) return null;
  if (!own(value, 'entity_id')) return { entity: null, empty: true };
  const entity = Array.isArray(value.entity_id) && value.entity_id.length === 1
    ? value.entity_id[0] : value.entity_id;
  return validEntity(entity) ? { entity, empty: false } : null;
}

function runTarget(action) {
  if (!only(action, ['action', 'service', 'perform_action', 'data', 'service_data', 'target', 'confirmation'])) return null;
  const names = [action.service, action.perform_action].filter(value => value !== undefined);
  if (names.some(value => typeof value !== 'string')
      || action.service && action.perform_action && action.service !== action.perform_action) return null;
  // HA accepts both names/data aliases for either action spelling. Keep only
  // unambiguous literal requests, irrespective of the legacy spelling.
  const service = action.perform_action || action.service;
  if (typeof service !== 'string' || !validEntity(service)) return null;
  if (own(action, 'data') && own(action, 'service_data')) return null;
  const data = action.data ?? action.service_data;
  const selected = targetOf(action.target), supplied = targetOf(data);
  if (!selected || !supplied || selected.entity && supplied.entity && selected.entity !== supplied.entity) return null;
  const entity = selected.entity || supplied.entity;
  const domain = { 'automation.trigger': 'automation', 'script.turn_on': 'script', 'scene.turn_on': 'scene' }[service];
  if (domain) return entity?.startsWith(`${domain}.`) ? entity : null;
  // Named scripts are services themselves. Reserved services must never fall
  // through here and acquire a fictitious script entity or different action.
  if (!service.startsWith('script.') || RESERVED_SCRIPT_SERVICES.has(service) || !supplied.empty) return null;
  return !selected.entity || selected.entity === service ? service : null;
}

/** No dispatch, HA access or new service authority: output is only stored marker fields. */
export function pictureTap(element, id, entity, notes) {
  const fallback = () => {
    notes.push({ code: entity ? 'action_fallback_info' : 'action_fallback_none', id });
    return { tap_action: entity ? 'info' : 'none' };
  };
  if (own(element, 'hold_action') || own(element, 'double_tap_action'))
    notes.push({ code: 'secondary_actions_skipped', id });

  let action = element.tap_action;
  if (element.type === 'service-button') {
    // The legacy HA element reads service/service_data, not tap_action.
    // https://github.com/home-assistant/frontend/blob/20240710.0/src/panels/lovelace/elements/hui-service-button-element.ts
    if (own(element, 'tap_action')) notes.push({ code: 'button_tap_action_skipped', id });
    if (typeof element.service !== 'string') return fallback();
    action = { action: 'call-service', service: element.service,
      ...(own(element, 'service_data') ? { service_data: element.service_data } : {}) };
  } else if (action === undefined) {
    // Picture elements default to more-info, including lights. Reusing Easy's
    // toggle default here would introduce actuation absent in the source.
    action = { action: entity ? 'more-info' : 'none' };
  }
  if (!record(action) || typeof action.action !== 'string') return fallback();
  const confirmation = action.confirmation;
  if (confirmation !== undefined && typeof confirmation !== 'boolean' && !record(confirmation)) return fallback();
  const confirmed = confirmation === true || record(confirmation);
  const confirmFields = () => {
    if (record(confirmation)) notes.push({ code: 'confirmation_simplified', id });
    if (confirmed && (action.action === 'more-info' || action.action === 'none'))
      notes.push({ code: 'confirmation_inactive', id });
    return confirmed ? { tap_confirm: true } : {};
  };
  if (action.action === 'none') {
    const fields = Object.keys(action).filter(key => key !== 'action' && key !== 'confirmation');
    if (fields.length) notes.push({ code: 'action_fields_skipped', id, fields: fields.join(', ') });
    return { tap_action: 'none', ...confirmFields() };
  }
  if (action.action === 'call-service' || action.action === 'perform-action') {
    const target = runTarget(action);
    return target ? { tap_action: 'run', tap_target: target, ...confirmFields() } : fallback();
  }
  if (!only(action, ['action', 'entity', 'confirmation']) || action.entity !== undefined && action.entity !== entity)
    return fallback();
  if (action.action === 'more-info') return entity ? { tap_action: 'info', ...confirmFields() } : fallback();
  if (action.action === 'toggle' && entity) {
    if (['lock', 'alarm_control_panel'].includes(entity.split('.')[0])) notes.push({ code: 'secure_toggle_inert', id });
    return { tap_action: 'toggle', ...confirmFields() };
  }
  return fallback();
}
