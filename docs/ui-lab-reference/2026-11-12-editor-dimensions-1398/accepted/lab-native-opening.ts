/** Unapproved UI Lab proposal. Activated only by the local workbench bootstrap. */
import { html, nothing } from 'lit';
import { selectControl } from './settings-select-control';

export const labNativeEnabled = (): boolean => (globalThis as any).__hpNativePrototypes === true;
const KEY = 'houseplan-ui-lab:native-openings:1024:v1';
type Leaf = { contact: string; invert: boolean; hinge: string; side: string; shutters: boolean; shutterSource: string; shutterState: string; shutterContact: string; shutterInvert: boolean };
type State = { leaves: Leaf[]; selected: string; movement: string; direction: string; _reduce?: number };
let saved: Record<string, State> | undefined;
const data = () => { if (!saved) { try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; } } return saved!; };
const key = (h: any, id: string) => `${h._space}:${id}`;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const freshLeaf = (d: any, i: number): Leaf => ({ contact: i < 2 ? d.contact || '' : '', invert: !!d.invert, hinge: i === 1 ? 'right' : 'left', side: d.flipV ? 'back' : 'front', shutters: false, shutterSource: 'manual', shutterState: 'open', shutterContact: '', shutterInvert: false });
const draft = (h: any, d: any): State => d._labOpening ||= copy(data()[key(h, d.id || '')] || { leaves: [freshLeaf(d, 0), freshLeaf(d, 1)], selected: 'all', movement: 'swing', direction: 'right' });
const bool = (label: string, value: boolean, change: (v: boolean) => void, id: string) => html`<label class="hpf-check hpf-check-wrap srcrow"><input type="checkbox" data-field=${id} .checked=${value} @change=${(e: Event) => change((e.target as HTMLInputElement).checked)}><span>${label}</span></label>`;
const field = (name: string, label: string, value: string, options: [string, string][], change: (v: string) => void) => html`<label>${label}</label>${selectControl({ name: `lab-${name}`, value, options: options.map(([value, label]) => ({ value, label })), onChange: change })}`;

export function labOpeningFields(h: any, d: any) {
  if (!labNativeEnabled() || d.type === 'passage') return nothing;
  const s = draft(h, d);
  const update = () => h.requestUpdate();
  if (d.type !== 'window') return html`${field('movement', 'Тип движения', s.movement, [['swing', 'Распашной'], ['slide', 'Откатной']], v => { s.movement = v; update(); })}
    ${s.movement === 'slide' ? field('direction', 'Направление движения', s.direction, [['left', '← Вдоль стены к началу'], ['right', 'Вдоль стены к концу →']], v => { s.direction = v; update(); }) : nothing}`;
  const picked = () => s.selected === 'all' ? s.leaves : [s.leaves[Number(s.selected)]];
  const common = (k: keyof Leaf) => { const values = picked().map(v => v[k]); return values.every(v => v === values[0]) ? values[0] : 'mixed'; };
  const change = (k: keyof Leaf, v: any) => { picked().forEach(l => (l as any)[k] = v); update(); };
  const choices = (k: keyof Leaf, label: string, list: [string, string][]) => field(k, label, String(common(k)), common(k) === 'mixed' ? [['mixed', 'Разные'], ...list] : list, v => { if (v !== 'mixed') change(k, v); });
  const check = (k: keyof Leaf, label: string) => common(k) === 'mixed'
    ? field(k, label, 'mixed', [['mixed', 'Разные'], ['yes', 'Да'], ['no', 'Нет']], v => { if (v !== 'mixed') change(k, v === 'yes'); })
    : bool(label, common(k) === true, v => change(k, v), `lab-${k}`);
  const candidates: [string, string][] = [['', 'Не назначен'], ...(h._editorRuntime?._contactCandidates?.() || []).map((v: any) => [v.value, v.label])];
  const status = (contact: string, invert: boolean) => {
    if (!contact) return 'Датчик не назначен';
    const value = h.hass?.states?.[contact]?.state;
    if (!['on', 'off'].includes(value)) return 'Нет данных от датчика';
    return (value === 'on') !== invert ? 'Открыто' : 'Закрыто';
  };
  const reduce = (n: number) => {
    if (n >= s.leaves.length) { while (s.leaves.length < n) s.leaves.push(freshLeaf({ ...d, contact: '', invert: false }, s.leaves.length)); update(); return; }
    s._reduce = n; update();
  };
  return html`
    ${field('leaf-count', 'Количество створок', String(s.leaves.length), [1, 2, 3, 4].map(n => [String(n), String(n)]), v => reduce(Number(v)))}
    ${s.leaves.length > 1 ? field('leaf', 'Настройки створок', s.selected, [['all', 'Все створки'], ...s.leaves.map((_, i): [string, string] => [String(i), `Створка ${i + 1}`])], v => { s.selected = v; update(); }) : nothing}
    ${choices('contact', 'Датчик открытия', candidates)}
    ${s.selected !== 'all' || s.leaves.length === 1 ? html`<div class="muted" style="font-size:12px">${status(String(common('contact')), common('invert') === true)}</div>` : nothing}
    ${check('invert', 'Инвертировать состояние')}
    ${choices('hinge', 'Петли', [['left', 'Слева'], ['right', 'Справа']])}
    ${choices('side', 'Открывание', [['front', 'Как на плане'], ['back', 'В обратную сторону']])}
    ${check('shutters', 'Есть ставни')}
    ${common('shutters') === true ? html`
      ${choices('shutterSource', 'Состояние ставней', [['manual', 'Вручную'], ['contact', 'Датчик открытия']])}
      ${common('shutterSource') === 'manual' ? choices('shutterState', 'Положение ставней', [['open', 'Открыто'], ['closed', 'Закрыто']]) : html`
        ${choices('shutterContact', 'Датчик ставней', candidates)}${check('shutterInvert', 'Инвертировать состояние ставней')}`}
      <div class="rhint">Закрытые ставни не пропускают свет через свою створку. На плане ставни не отображаются.</div>` : nothing}
    ${(s as any)._reduce ? html`<hp-dialog alert form-shell settings-layout compact class="ui-dialog" .hass=${h.hass} title="Уменьшить количество створок?" @hp-close=${() => { delete (s as any)._reduce; update(); }}>
      <div class="body">Будут удалены створки ${s.leaves.slice((s as any)._reduce).map((l, i) => `${(s as any)._reduce + i + 1}${l.contact ? ` (${h.hass?.states?.[l.contact]?.attributes?.friendly_name || l.contact})` : ''}${l.shutters ? ', со ставнями' : ''}`).join('; ')}.</div>
      <div class="row dialog-action-footer" slot="footer"><button class="btn ghost" @click=${() => { delete (s as any)._reduce; update(); }}>Отмена</button><button class="btn on" @click=${() => { s.leaves.length = (s as any)._reduce; s.selected = 'all'; delete (s as any)._reduce; update(); }}>Уменьшить</button></div>
    </hp-dialog>` : nothing}`;
}

export function labSaveOpening(h: any, d: any, opening: any) {
  if (!labNativeEnabled() || !d._labOpening) return;
  data()[key(h, opening.id)] = copy(d._labOpening);
  delete (data()[key(h, opening.id)] as any)._reduce;
  localStorage.setItem(KEY, JSON.stringify(data()));
  h._cfgEpoch++;
  h._sunRaysCache = null; h._isoSunCache = null; h._lightBarrierPool?.clear();
  (globalThis as any).__hpLabOpeningRevision = ((globalThis as any).__hpLabOpeningRevision || 0) + 1;
}
export function labSliding(d: any): boolean { return labNativeEnabled() && d._labOpening?.movement === 'slide'; }

export function labOpeningVisual(h: any, o: any): any {
  if (!labNativeEnabled()) return undefined;
  const s = data()[key(h, o.id)]; if (!s) return undefined;
  return { movement: s.movement, direction: s.direction, leaves: s.leaves.map(l => {
    const st = h.hass?.states?.[l.contact]?.state;
    return { hinge: l.hinge, side: l.side, amount: ['on', 'off'].includes(st) ? Number((st === 'on') !== l.invert) : 0, active: !!l.contact && ['on', 'off'].includes(st) };
  }) };
}
export function labShutterSegments(h: any): { a: number[]; b: number[] }[] {
  if (!labNativeEnabled()) return [];
  return (h._openingsR || []).flatMap((o: any) => {
    const s = data()[key(h, o.id)]; if (o.type !== 'window' || !s) return [];
    const rad = o.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), len = o.rlen / s.leaves.length;
    return s.leaves.flatMap((l, i) => {
      const st = h.hass?.states?.[l.shutterContact]?.state;
      const closed = l.shutterSource === 'manual' ? l.shutterState === 'closed' : ['on', 'off'].includes(st) && ((st === 'off') !== l.shutterInvert);
      if (!l.shutters || !closed) return [];
      const start = -o.rlen / 2 + i * len, end = start + len;
      return [{ a: [o.rx + ux * start, o.ry + uy * start], b: [o.rx + ux * end, o.ry + uy * end] }];
    });
  });
}
export function labSolarWindows(h: any, windows: any[]): any[] {
  if (!labNativeEnabled()) return windows;
  return windows.flatMap(w => {
    const s = data()[key(h, w.id)]; if (!s) return [w];
    const rad = w.angle * Math.PI / 180, len = w.length / s.leaves.length;
    const blocked = s.leaves.map(l => {
      const st = h.hass?.states?.[l.shutterContact]?.state;
      return l.shutters && (l.shutterSource === 'manual' ? l.shutterState === 'closed' : ['on', 'off'].includes(st) && ((st === 'off') !== l.shutterInvert));
    });
    if (!blocked.some(Boolean)) return [w];
    const result: any[] = [];
    for (let i = 0; i < blocked.length;) {
      if (blocked[i]) { i++; continue; }
      const start = i; while (i < blocked.length && !blocked[i]) i++;
      const offset = -w.length / 2 + (start + i) / 2 * len;
      result.push({ ...w, id: `${w.id}:leaf:${start}`, x: w.x + Math.cos(rad) * offset, y: w.y + Math.sin(rad) * offset, length: (i - start) * len });
    }
    return result;
  });
}
