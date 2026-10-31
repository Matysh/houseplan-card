import { html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { headerNavigationGroup, headerNavigationItem } from './header-navigation-kit';

interface SpaceChoice { id: string; title: string }

/** CSS pixels, without transform scaling or clientWidth's integer rounding. */
export function headerContentWidth(style: Pick<CSSStyleDeclaration,
  'width' | 'boxSizing' | 'paddingLeft' | 'paddingRight' | 'borderLeftWidth' | 'borderRightWidth'>): number {
  const width = Number.parseFloat(style.width);
  if (!Number.isFinite(width)) return 0;
  const inset = style.boxSizing === 'border-box'
    ? [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
      .reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0) : 0;
  return Math.max(0, width - inset);
}

interface HeaderSpaceNavigation {
  spaces: readonly SpaceChoice[];
  current: string;
  mode: string;
  compact: boolean;
  panel?: boolean;
  labels: { spaces: string; configure: string; add: string };
  reorderable: boolean;
  drag: { id: string; moved: boolean; targetId: string | null; placement: 'before' | 'after' | null } | null;
  pick: (id: string) => void;
  tabClick: (id: string) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerDown: (event: PointerEvent, id: string) => void;
  pointerUp: (event: PointerEvent) => void;
  cancelDrag: () => void;
  configure: ((id: string) => void) | null;
  create: (() => void) | null;
}

/** Restore the accepted value before the existing navigation/dirty guard runs. */
export function chooseHeaderSpace(
  select: { value: string }, current: string, pick: (id: string) => void,
): void {
  const requested = select.value;
  select.value = current;
  pick(requested);
}

/** Shared UI Kit control without importing the editor form or style graph. */
export function renderHeaderSpaceSelect(
  spaces: readonly SpaceChoice[], current: string, label: string, pick: (id: string) => void, panel = false,
): TemplateResult {
  return html`<hp-settings-select class="compact-space-select" variant=${panel ? 'header-panel' : 'header'} data-hp="space-select"
      title=${spaces.find(space => space.id === current)?.title || ''}>
    <select data-hp="space-select-value" data-field="header-space" .value=${current} aria-label=${label}
      @change=${(event: Event) => chooseHeaderSpace(event.currentTarget as HTMLSelectElement, current, pick)}>
      ${spaces.map(space => html`<option value=${space.id} ?selected=${space.id === current}>${space.title}</option>`)}
    </select>
  </hp-settings-select>`;
}

/** One navigation owner for compact selection and the established wide tabs. */
export function renderHeaderSpaceNavigation(nav: HeaderSpaceNavigation): TemplateResult {
  const { spaces, current, compact, labels, drag } = nav;
  return html`<nav class=${headerNavigationGroup(compact)} aria-label=${labels.spaces}
      @pointermove=${nav.pointerMove}>
    ${compact ? keyed(nav.mode, renderHeaderSpaceSelect(spaces, current, labels.spaces, nav.pick, nav.panel))
      : spaces.map(space => html`<button data-hp="space-tab" data-space=${space.id} data-id=${space.id}
          class="${headerNavigationItem} ${current === space.id ? 'active' : ''}${drag?.moved && drag.id === space.id ? ' dragging' : ''}${
            drag?.moved && drag.targetId === space.id ? ` drop-${drag.placement}` : ''}"
          ?data-reorderable=${nav.reorderable}
          aria-current=${current === space.id ? 'page' : nothing}
          @pointerdown=${(event: PointerEvent) => nav.pointerDown(event, space.id)}
          @pointerup=${nav.pointerUp} @pointercancel=${nav.cancelDrag} @click=${() => nav.tabClick(space.id)}>
        <span class="tabtitle">${space.title}</span>${nav.configure
          ? html`<ha-icon class="tabedit" icon="mdi:cog-outline" data-hp="space-settings" data-id=${space.id}
              title=${labels.configure} @click=${(event: Event) => {
                event.stopPropagation(); nav.configure?.(space.id);
              }}></ha-icon>` : nothing}
      </button>`)}
    ${compact && nav.configure ? html`<button class="${headerNavigationItem} tabedit compact-space-settings"
        data-hp="space-settings" data-id=${current} title=${labels.configure} aria-label=${labels.configure}
        @click=${() => nav.configure?.(current)}><ha-icon icon="mdi:cog-outline"></ha-icon></button>` : nothing}
    ${nav.create ? html`<button class="${headerNavigationItem} tabadd" data-hp="space-add" title=${labels.add}
        @click=${nav.create}><ha-icon icon="mdi:plus"></ha-icon></button>` : nothing}
  </nav>`;
}
