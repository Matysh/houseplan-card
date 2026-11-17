import { createIfcEngine } from '../vendor/ifc/engine.mjs';
import { IFC_WORKER_SOURCE } from './ifc-worker.generated.mjs';
import { MAX_IFC_BYTES } from '../ifc-errors.mjs';

/** One worker/model per input. Cancellation invalidates closures and results. */
export function ifcController({ text, language, onBusy, onResult, onError, onCancel }) {
  let active = null, sequence = 0, stem = '';
  const catalog = document.getElementById('ifc-catalog');
  const stop = () => {
    sequence++;
    if (active) { active.worker.terminate(); URL.revokeObjectURL(active.url); active = null; }
    catalog.hidden = true; catalog.replaceChildren();
  };
  const node = (tag, content) => { const item = document.createElement(tag); if (content !== undefined) item.textContent = content; return item; };
  return {
    stop,
    read(file) {
      stop();
      if (file.size > MAX_IFC_BYTES) { onError('ifc_file_too_large'); return; }
      stem = file.name.replace(/\.ifc$/i, '').replace(/[^\p{L}\p{N}_.-]+/gu, '-').slice(0, 80) || 'plan';
      const generation = sequence;
      try {
        const source = `globalThis.__HOUSEPLAN_IFC_ENGINE__ = (${createIfcEngine.toString()});\n${IFC_WORKER_SOURCE}`;
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        let worker;
        try { worker = new Worker(url); } catch (error) { URL.revokeObjectURL(url); throw error; }
        active = { worker, url };
        const current = () => active?.worker === worker && generation === sequence;
        worker.onerror = event => { if (current()) { event.preventDefault(); stop(); onError('ifc_worker_failed'); } };
        worker.onmessage = ({ data }) => {
          if (!current() || data.generation !== generation) return;
          if (data.phase === 'error') { stop(); onError(data.code, data.detail); return; }
          if (data.phase === 'result') {
            const result = { ...data.result, stem };
            stop(); onResult(result); return;
          }
          if (data.phase !== 'catalog') { onBusy(data.phase); return; }
          onBusy(null); catalog.replaceChildren(); catalog.hidden = false;
          catalog.append(node('h3', text('ifc.select_floors')));
          const choices = [];
          for (const floor of data.floors) {
            const label = node('label'), input = node('input'); input.type = 'checkbox'; input.value = floor.id;
            input.checked = floor.count > 0; input.disabled = floor.count === 0; choices.push(input);
            const elevation=Number.isFinite(floor.elevation)?floor.elevation.toFixed(2)+' m':text('ifc.elevation_unknown');
            label.append(input, node('span', `${floor.building ? floor.building + ' · ' : ''}${floor.title} (${elevation})${floor.count ? '' : ' — ' + text('ifc.empty')}`));
            catalog.append(label);
          }
          const convert = node('button', text('ifc.convert')); convert.className = 'btn primary';
          const update = () => { convert.disabled = false; convert.textContent=text(choices.some(c=>c.checked)?'ifc.convert':'ifc.report_only'); };
          choices.forEach(c => c.addEventListener('change', update)); update();
          convert.addEventListener('click', () => {
            if (!current() || convert.disabled) return;
            catalog.hidden = true; onBusy('converting');
            worker.postMessage({ action: 'convert', generation, options: { floorIds: choices.filter(c => c.checked).map(c => c.value), language: language() } });
          });
          catalog.append(convert);
          const cancel = node('button', text('ifc.cancel')); cancel.className = 'btn'; cancel.addEventListener('click', onCancel); catalog.append(cancel);
        };
        onBusy('reading'); worker.postMessage({ action: 'read', file, generation });
      } catch { stop(); onError('ifc_worker_failed'); }
    },
  };
}

export function ifcPreview(document_, level, text) {
  const space = document_.payload.config.spaces[0], ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const box = space.view_box || [0, 0, 1, 1];
  svg.setAttribute('viewBox', box.join(' ')); svg.setAttribute('class', 'ifc-preview');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', text('ifc.preview'));
  const shape = (tag, attributes) => {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
    svg.append(el); return el;
  };
  const cmUnit = space.cell_cm * 240;
  const labels=[];
  for (const room of space.rooms || []) {
    shape('polygon', { points: room.poly.map(p => p.join(',')).join(' '), fill: '#3ea6ff25' });
    const centre = room.poly.reduce((p, q) => [p[0] + q[0] / room.poly.length, p[1] + q[1] / room.poly.length], [0,0]);
    labels.push({name:room.name,centre});
  }
  const walls = [...(space.wall_segments || []), ...(space.partitions || [])];
  for (const wall of walls) if (wall.cm > 0) shape('line', { x1: wall.a[0], y1: wall.a[1], x2: wall.b[0], y2: wall.b[1],
    stroke: '#93a7bf', 'stroke-width': wall.cm / cmUnit, 'stroke-linecap': 'butt' });
  for (const opening of space.openings || []) {
    const a = opening.angle * Math.PI / 180, dx = Math.cos(a) * opening.length / 2, dy = Math.sin(a) * opening.length / 2;
    const wall = walls.find(w => w.id === opening.host?.id);
    shape('line', { x1: opening.x - dx, y1: opening.y - dy, x2: opening.x + dx, y2: opening.y + dy,
      stroke: opening.type === 'door' ? '#ffb454' : '#3ea6ff', 'stroke-width': Math.max((wall?.cm || 8) / cmUnit, box[2] / 250) });
  }
  for(const {name,centre} of labels) {
    const label=shape('text',{x:centre[0],y:centre[1],'text-anchor':'middle','font-size':box[2]/45,fill:'currentColor',
      'paint-order':'stroke',stroke:'var(--bg,#0b1220)','stroke-width':box[2]/500});label.textContent=name;
  }
  svg.highlightSource = id => {
    for (const el of svg.querySelectorAll('[data-ifc-highlight]')) el.remove();
    const source = level.previewSources?.find(s => String(s.sourceId) === String(id));
    if (!source) return false;
    for (const points of source.shapes) shape('polyline', { points: points.map(p => p.join(',')).join(' '),
      fill: 'none', stroke: '#ff5d5d', 'stroke-width': box[2]/180, 'data-ifc-highlight': 'true' });
    return true;
  };
  return svg;
}
