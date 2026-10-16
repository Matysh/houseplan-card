import { EasyInputError } from './easy-read.mjs';
import { numberAt } from './easy-geometry.mjs';
import { angleOf, itemReadingPool, markerTap, readingToken, stringAt, validEntity } from './easy-style.mjs';
import { noteFields, reportRemainder, textDecor } from './easy-content.mjs';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
function inside(point, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x, y] = poly[i], [px, py] = poly[j];
    if ((y > point[1]) !== (py > point[1]) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) result = !result;
  }
  return result;
}

export function convertItems(items, rooms, spaceId, context) {
  const { ids, frame, cmPerUnit, color, notes } = context;
  const markers = [], layout = {}, decor = [], strips = [];
  for (const [index, item] of items.entries()) {
    const id = ids('device', item.id, index);
    if (item.readings !== undefined && (!Array.isArray(item.readings)
      || item.readings.some(row => !row || typeof row !== 'object' || Array.isArray(row))))
      throw new EasyInputError('easy_invalid_readings', id);
    const entity = validEntity(item.entity) ? item.entity : null;
    const point = frame.point([numberAt(item.x, `${id}.x`), numberAt(item.y, `${id}.y`)]);
    const marker = { id, binding: entity ? `entity:${entity}` : 'virtual', space: spaceId,
      name: stringAt(item.name, `${id}.name`, entity || 'Device'), ...markerTap(item, notes),
      display: item.display === 'iconRipple' || item.display === 'ripple' ? 'icon_ripple' : 'badge',
      size: clamp(numberAt(item.size, `${id}.size`, 34) / 34, 0.5, 3),
      angle: angleOf(numberAt(item.angle, `${id}.angle`, 0)), is_light: item.glow === true,
      value_badge: { enabled: false, position: ({ below: 'bottom', left: 'left', right: 'right' })[item.labelPosition] || 'bottom' } };
    if (item.entity && !entity) notes.push({ code: 'binding_virtualized', id });
    if (item.icon !== undefined) {
      const icon = stringAt(item.icon, `${id}.icon`);
      if (/^mdi:[a-z0-9-]{1,100}$/.test(icon)) marker.icon = icon;
      else notes.push({ code: 'icon_skipped', id });
    }
    const owners = rooms.filter(room => inside(point, room.poly));
    if (owners.length === 1) {
      if (owners[0].area) marker.area = owners[0].area;
      else marker.room_id = owners[0].id;
    } else if (owners.length > 1) notes.push({ code: 'device_room_ambiguous', id });
    const readings = itemReadingPool(item);
    if (readings.length < 1 + (item.readings?.length || 0) + (item.secondaryEntity || item.secondaryAttribute ? 1 : 0))
      notes.push({ code: 'reading_skipped', id });
    if (item.entity && !readings.some(row => row.origin === 'primary')) notes.push({ code: 'reading_skipped', id });
    const primary = readings.find(row => row.origin === 'primary');
    const content = item.badgeContent ?? (item.showIcon === false ? 'none' : 'icon');
    let selected = readings.find(row => row.origin === (item.badgeEntity === 'secondary' ? 0 : item.badgeEntity));
    if (item.badgeEntity === 'primary') selected = primary;
    if (!selected && content === 'value') selected = primary || readings[0];
    if (content === 'value' && item.badgeEntity !== 'primary' && !readings.some(row => row.origin ===
        (item.badgeEntity === 'secondary' ? 0 : item.badgeEntity))) notes.push({ code: 'badge_selection_approximate', id });
    if (selected && content === 'value') { marker.display = 'value'; marker.value_source = selected.source; }
    if (content === 'none' || item.display === 'ripple') notes.push({ code: 'device_face_approximate', id });
    const visible = readings.filter(row => row.visible && !(content === 'value' && row === selected));
    if (visible.length) {
      marker.value_badge.enabled = true; marker.value_badge.source = visible[0].source;
      const extra = visible.slice(1).map(row => readingToken(row.source));
      if (extra.length) {
        const distance = (numberAt(item.size, `${id}.size`, 34) / 2 + 20);
        // Construct the bounded template from already validated entities only.
        const template = extra.join(' · ');
        if (template.length > 200) throw new EasyInputError('easy_text_too_long', id);
        decor.push({ id: ids('text', `${item.id ?? index}-readings`), kind: 'text',
          x: point[0], y: frame.point([item.x, item.y + distance])[1],
          size_cm: clamp(numberAt(item.labelSize, `${id}.labelSize`, 12) * cmPerUnit, 0.1, 2000),
          color: '#808080', text: template });
        notes.push({ code: 'extra_readings_as_text', id, count: extra.length });
      }
    }
    if (item.showName === true) {
      const label = textDecor({ id: `${item.id ?? index}-name`, x: item.x, y: item.y - 30,
        text: marker.name, size: numberAt(item.labelSize, `${id}.labelSize`, 12) }, context);
      if (label) decor.push(label);
      notes.push({ code: 'device_name_as_text', id });
    }
    if (item.glow === true) {
      const wanted = numberAt(item.glowRadius, `${id}.glowRadius`, 140) * cmPerUnit;
      marker.glow_radius_cm = clamp(wanted, 10, 10000);
      if (wanted !== marker.glow_radius_cm) notes.push({ code: 'glow_radius_clamped', id });
      if (item.glowColor !== undefined) {
        const c = color(item.glowColor);
        if (c) marker.glow_color = { c };
        else notes.push({ code: 'color_fallback', id });
      }
      notes.push({ code: 'light_runtime_semantics', id });
      const length = numberAt(item.stripLength, `${id}.stripLength`, 0);
      if (length > 0) {
        const rad = numberAt(item.stripAngle, `${id}.stripAngle`, 0) * Math.PI / 180;
        strips.push({ id: ids('led', item.id, index), marker: id, active: true,
          points: [-1, 1].map(sign => frame.point([item.x + sign * length * Math.cos(rad) / 2,
            item.y + sign * length * Math.sin(rad) / 2])) });
        if (item.stripSide && item.stripSide !== 'both') notes.push({ code: 'led_side_skipped', id });
      }
    }
    if (item.rippleColor !== undefined) {
      const c = color(item.rippleColor);
      if (c) marker.ripple_color = c; else notes.push({ code: 'color_fallback', id });
    }
    if (item.rippleSize !== undefined) marker.ripple_size = clamp(numberAt(item.rippleSize, `${id}.rippleSize`) / 34, 1, 10);
    noteFields(item, ['stateColor', 'activeColor', 'inactiveColor', 'disableLabelColor', 'labelCustomColor',
      'iconAnimation', 'rippleDirection', 'rippleWidth', 'conditions', 'locked'], 'device_behavior_skipped', id, notes);
    reportRemainder(item, ['id', 'entity', 'x', 'y', 'kind', 'name', 'icon', 'display', 'size', 'angle', 'showName', 'showState',
      'attribute', 'secondaryEntity', 'secondaryAttribute', 'readings', 'badgeContent', 'badgeEntity', 'showIcon', 'labelPosition', 'labelSize',
      'glow', 'glowRadius', 'glowColor', 'stripLength', 'stripAngle', 'stripSide', 'rippleColor', 'rippleSize', 'tap_action', 'hold_action',
      'double_tap_action', 'stateColor', 'activeColor', 'inactiveColor', 'disableLabelColor', 'labelCustomColor', 'iconAnimation',
      'rippleDirection', 'rippleWidth', 'conditions', 'locked'], id, notes);
    markers.push(marker); layout[id] = { s: spaceId, x: point[0], y: point[1] };
  }
  return { markers, layout, decor, strips };
}
