import { html, type TemplateResult } from 'lit';

interface SpaceChoice { id: string; title: string }

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
  spaces: readonly SpaceChoice[], current: string, label: string, pick: (id: string) => void,
): TemplateResult {
  return html`<hp-settings-select class="compact-space-select" data-hp="space-select"
      title=${spaces.find(space => space.id === current)?.title || ''}>
    <select data-hp="space-select-value" data-field="header-space" .value=${current} aria-label=${label}
      @change=${(event: Event) => chooseHeaderSpace(event.currentTarget as HTMLSelectElement, current, pick)}>
      ${spaces.map(space => html`<option value=${space.id} ?selected=${space.id === current}>${space.title}</option>`)}
    </select>
  </hp-settings-select>`;
}
