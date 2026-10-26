// Local beta.2 prototype. Keep the product menu, copy command and deletion flow.
import { deletePlanDevice } from '/assets/houseplan-assets/marker-deletion-DsI6Q5VP.js';

const bindingOf = device => device.marker?.binding || (device.bindingKind === 'virtual'
  ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`);

export function installDeviceContextActions(card, enabled) {
  const patched = new WeakSet();
  const render = card.render;
  card.render = function (...args) {
    const runtime = this._editorRuntime;
    const presentation = runtime?.deviceCopy?.presentation;
    if (presentation && !patched.has(presentation)) {
      patched.add(presentation);
      const controller = runtime.deviceCopy;
      const open = controller.open;
      const copy = controller.copy;
      // Remove the old copy-only menu's visibility restriction without
      // changing saved visibility. Keep its authority/revision/gesture guards.
      const commandView = id => new Proxy(controller, {
        get(target, key, receiver) {
          if (key === 'host') return new Proxy(card, {
            get(host, field) {
              if (field === '_devices') return host._devices.map(device => device.id === id
                ? { ...device, hidden: false, bindingStatus: { kind: 'active' } } : device);
              const value = Reflect.get(host, field, host);
              return typeof value === 'function' && !Object.hasOwn(host, field) ? value.bind(host) : value;
            },
          });
          return Reflect.get(target, key, receiver);
        },
      });
      controller.open = function (event, device) {
        return open.call(enabled() ? commandView(device.id) : this, event, device);
      };
      controller.copy = function (owner) {
        return copy.call(enabled() ? commandView(owner.id) : this, owner);
      };
      const menuRender = presentation.render;
      presentation.render = function (model) {
        if (enabled() && model?.hp === 'device-context-menu') {
          const owner = model.token;
          const device = () => card._devices.find(item => item.id === owner.id && item.space === owner.space);
          const invoke = action => () => {
            const current = device();
            if (current) void action(current);
          };
          const ru = (card._config?.language || card.hass.language || 'ru').startsWith('ru');
          const hidden = !!device()?.hidden;
          model = { ...model, items: [
            { key: 'settings', action: 'device-settings', label: ru ? 'Открыть настройки' : 'Open settings',
              invoke: invoke(current => runtime._openMarkerDialog(current)) },
            ...model.items.filter(item => item.key === 'copy'),
            { key: 'visibility', action: hidden ? 'device-show' : 'device-hide',
              label: hidden ? (ru ? 'Показывать на плане' : 'Show on plan') : card._t('marker.hide'),
              invoke: invoke(current => setDeviceHidden(runtime, card, current, !hidden)) },
            { key: 'delete', action: 'device-delete', label: card._t('btn.delete'),
              invoke: invoke(current => deletePlanDevice(runtime, current.id, bindingOf(current))) },
          ] };
        }
        return menuRender.call(this, model);
      };
    }
    return render.apply(this, args);
  };
}

async function setDeviceHidden(runtime, card, device, hidden) {
  const config = card._serverCfg;
  if (!config || !card._canEdit || card._kiosk) return;
  if (!hidden && device.bindingStatus?.kind === 'ha_disabled') {
    const key = device.bindingStatus.reason === 'entity'
      ? 'toast.ha_disabled_show_entity' : 'toast.ha_disabled_show_device';
    card._showToast(card._t(key), key);
    return;
  }
  const previous = config.markers || [];
  const binding = bindingOf(device);
  const marker = previous.find(item => !item.removed && (binding === 'virtual'
    ? item.id === device.id : item.binding === binding));
  if (binding === 'virtual' && !marker) return;
  config.markers = marker ? previous.map(item => item === marker ? { ...item, hidden } : item)
    : [...previous, { id: device.id, binding, hidden }];
  try {
    await runtime._saveConfigNow();
  } catch (error) {
    if (card._serverCfg === config) config.markers = previous;
    card._showToast(card._t('toast.error', { err: card._errText(error) }), 'toast.error');
  }
  card._regSignature = '';
  card._deviceInboxMemo = null;
  card._maybeRebuildDevices();
  card.requestUpdate();
}
