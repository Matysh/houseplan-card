/**
 * Device filtering and icon rules.
 *
 * Icon rules are DATA, not code: the built-in defaults below can be overridden
 * per instance via `config.settings.icon_rules` (edited in the card UI).
 * A rule is `{ pattern, icon }`; patterns are case-insensitive regexes matched
 * against "<device name> <model>", first match wins. Invalid user regexes are
 * skipped silently at compile time (and flagged in the rules editor).
 */

/** Integration domains whose devices are hidden by default (filtering). */
export const EXCLUDED_DOMAINS = new Set([
  'hacs', 'sun', 'backup', 'hassio', 'met', 'telegram_bot', 'mobile_app',
  'systemmonitor', 'better_thermostat', 'adaptive_lighting', 'yandex_pogoda',
  'upnp_serial_number',
]);

export interface IconRule {
  pattern: string;
  icon: string;
}

/**
 * Built-in defaults, bilingual (EN + RU device-name vocabularies).
 * Kept as plain strings so the UI editor can display and clone them.
 */
export const DEFAULT_ICON_RULES: IconRule[] = [
  { pattern: 'протечк|leak|water sensor', icon: 'mdi:water-alert' },
  { pattern: 'клапан|valve', icon: 'mdi:pipe-valve' },
  { pattern: 'дым|smoke', icon: 'mdi:smoke-detector' },
  { pattern: 'термоголов|trv|radiator', icon: 'mdi:radiator' },
  { pattern: 'чайник|kettle|термопот', icon: 'mdi:kettle' },
  { pattern: 'сауна|sauna|harvia|парная|парилк', icon: 'mdi:hot-tub' },
  { pattern: 'температ|temperature|climate sensor', icon: 'mdi:thermometer' },
  { pattern: 'qingping|air monitor|молекул|air quality', icon: 'mdi:air-filter' },
  { pattern: 'штор|curtain|blind|shade', icon: 'mdi:roller-shade' },
  { pattern: 'розетк|plug|socket|outlet', icon: 'mdi:power-socket-de' },
  { pattern: 'выключат|switch', icon: 'mdi:light-switch' },
  { pattern: 'лампа|лампочк|bulb|gx53|светильник|rgb|lamp|light strip', icon: 'mdi:lightbulb' },
  { pattern: 'камер|camera', icon: 'mdi:cctv' },
  { pattern: 'замок|ttlock|lock|sn609|sn9161', icon: 'mdi:lock' },
  { pattern: 'ворота|garage|gate', icon: 'mdi:garage-variant' },
  { pattern: 'калитк|door|открыт|contact', icon: 'mdi:door' },
  { pattern: 'счётчик|счетчик|kws|meter', icon: 'mdi:meter-electric' },
  { pattern: 'вводный автомат|breaker|wifimcbn', icon: 'mdi:electric-switch' },
  { pattern: 'myheat|котёл|котел|boiler|отоплен|heating', icon: 'mdi:water-boiler' },
  { pattern: 'холодильник|fridge', icon: 'mdi:fridge' },
  { pattern: 'стиральн|washer|washing', icon: 'mdi:washing-machine' },
  { pattern: 'сушилк|dryer', icon: 'mdi:tumble-dryer' },
  { pattern: 'пылесос|vacuum|dreame|roborock', icon: 'mdi:robot-vacuum' },
  { pattern: 'soundbar', icon: 'mdi:soundbar' },
  { pattern: 'колонк|станц|speaker|яндекс|yandex|алиса|alice', icon: 'mdi:speaker' },
  { pattern: 'tv|телевизор|hyundaitv|mitv|television', icon: 'mdi:television' },
  { pattern: 'keenetic|роутер|router|mesh|access point', icon: 'mdi:router-wireless' },
  { pattern: 'ибп|ups|kirpich', icon: 'mdi:battery-charging-high' },
  { pattern: 'slzb|координат|zigbee|coordinator', icon: 'mdi:zigbee' },
  { pattern: 'motion|движен|presence|присутств', icon: 'mdi:motion-sensor' },
  { pattern: 'humidity|влажн', icon: 'mdi:water-percent' },
];

export interface CompiledIconRule {
  re: RegExp;
  icon: string;
}

/** Compile rules, silently skipping invalid regexes (user input!). */
export function compileIconRules(rules: IconRule[]): CompiledIconRule[] {
  const res: CompiledIconRule[] = [];
  for (const r of rules) {
    if (!r || typeof r.pattern !== 'string' || !r.icon) continue;
    try {
      res.push({ re: new RegExp(r.pattern, 'i'), icon: r.icon });
    } catch {
      /* invalid user regex — skipped; the rules editor highlights it */
    }
  }
  return res;
}

/** Whether a single rule pattern is a valid regex (for the editor UI). */
export function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_COMPILED = compileIconRules(DEFAULT_ICON_RULES);

/** Fallback by entity device_class / domain when no name rule matched. */
const DEVICE_CLASS_ICONS: Record<string, string> = {
  temperature: 'mdi:thermometer',
  humidity: 'mdi:water-percent',
  motion: 'mdi:motion-sensor',
  occupancy: 'mdi:motion-sensor',
  door: 'mdi:door',
  window: 'mdi:window-closed',
  garage_door: 'mdi:garage-variant',
  smoke: 'mdi:smoke-detector',
  moisture: 'mdi:water-alert',
  gas: 'mdi:gas-cylinder',
  power: 'mdi:meter-electric',
  energy: 'mdi:meter-electric',
  illuminance: 'mdi:brightness-5',
  co2: 'mdi:molecule-co2',
  pm25: 'mdi:air-filter',
  battery: 'mdi:battery',
};

export const FALLBACK_ICON = 'mdi:chip';

/** Pick an MDI icon by device name/model using the given (or default) rules. */
export function iconFor(name?: string, model?: string, rules?: CompiledIconRule[]): string {
  const s = ((name || '') + ' ' + (model || '')).toLowerCase();
  for (const { re, icon } of rules ?? DEFAULT_COMPILED) {
    if (re.test(s)) return icon;
  }
  return FALLBACK_ICON;
}

/** Icon from entity device_class attributes (used when name rules gave the fallback). */
export function iconFromDeviceClasses(deviceClasses: string[]): string | null {
  for (const dc of deviceClasses) {
    const icon = DEVICE_CLASS_ICONS[dc];
    if (icon) return icon;
  }
  return null;
}

/** Priority of domains for picking a device's "primary" entity (more-info). */
export const DOMAIN_PRIORITY = [
  'light', 'switch', 'cover', 'valve', 'lock', 'climate', 'fan',
  'media_player', 'camera', 'vacuum', 'humidifier', 'water_heater',
  'alarm_control_panel', 'sensor', 'binary_sensor', 'event', 'button',
  'number', 'select', 'update',
];
