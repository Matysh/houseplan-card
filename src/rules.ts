/**
 * Правила прототипа — перенесены 1-в-1 из index.html/build_data.py (см. DOCUMENTATION.md §4.2–4.5).
 */

/** Интеграции-домены, чьи устройства скрываются (курирование). */
export const EXCLUDED_DOMAINS = new Set([
  'hacs', 'sun', 'backup', 'hassio', 'met', 'telegram_bot', 'mobile_app',
  'systemmonitor', 'better_thermostat', 'adaptive_lighting', 'yandex_pogoda',
  'upnp_serial_number',
]);

const ICON_RULES: Array<[RegExp, string]> = [
  [/протечк/, 'mdi:water-alert'],
  [/клапан/, 'mdi:pipe-valve'],
  [/дым/, 'mdi:smoke-detector'],
  [/термоголов/, 'mdi:radiator'],
  [/температ/, 'mdi:thermometer'],
  [/qingping|air monitor|молекул/, 'mdi:air-filter'],
  [/штор/, 'mdi:roller-shade'],
  [/розетк|plug/, 'mdi:power-socket-de'],
  [/выключат|switch/, 'mdi:light-switch'],
  [/лампа|лампочк|bulb|gx53|светильник|rgb/, 'mdi:lightbulb'],
  [/камер|camera/, 'mdi:cctv'],
  [/замок|ttlock|lock|sn609|sn9161/, 'mdi:lock'],
  [/ворота|garage/, 'mdi:garage-variant'],
  [/калитк|door|открыт/, 'mdi:door'],
  [/счётчик|счетчик|kws|meter/, 'mdi:meter-electric'],
  [/вводный автомат|breaker|wifimcbn/, 'mdi:electric-switch'],
  [/myheat|котёл|котел|boiler|отоплен/, 'mdi:water-boiler'],
  [/холодильник|fridge/, 'mdi:fridge'],
  [/стиральн|washer/, 'mdi:washing-machine'],
  [/сушилк|dryer/, 'mdi:tumble-dryer'],
  [/пылесос|vacuum|dreame/, 'mdi:robot-vacuum'],
  [/soundbar|колонк|станц/, 'mdi:soundbar'],
  [/tv|телевизор|hyundaitv|mitv/, 'mdi:television'],
  [/keenetic|роутер|router/, 'mdi:router-wireless'],
  [/ибп|ups|kirpich/, 'mdi:battery-charging-high'],
  [/slzb|координат|zigbee/, 'mdi:zigbee'],
];

/** Подбор MDI-иконки по имени/модели устройства. */
export function iconFor(name?: string, model?: string): string {
  const s = ((name || '') + ' ' + (model || '')).toLowerCase();
  for (const [pat, icon] of ICON_RULES) {
    if (pat.test(s)) return icon;
  }
  return 'mdi:chip';
}

/** Приоритет доменов для выбора «первичной» сущности устройства (more-info). */
export const DOMAIN_PRIORITY = [
  'light', 'switch', 'cover', 'valve', 'lock', 'climate', 'fan',
  'media_player', 'camera', 'vacuum', 'humidifier', 'water_heater',
  'alarm_control_panel', 'sensor', 'binary_sensor', 'event', 'button',
  'number', 'select', 'update',
];
