import { html, nothing, type TemplateResult } from 'lit';

export type EditorSecondaryKind =
  | 'selection'
  | 'operation'
  | 'tool'
  | 'mixed'
  | 'group'
  | 'palette';

export interface EditorSecondaryModel {
  contextId: string;
  kind: EditorSecondaryKind;
  ariaLabel: string;
  visibleLabel?: string;
  content: TemplateResult;
  launcherId?: string;
  dismissPolicy?: 'outside' | 'stay-open-on-canvas';
  dismiss?: () => void;
}

export interface EditorToolbarGroupItem {
  id: string;
  label: string;
  icon: string;
  role?: 'tool' | 'command' | 'toggle';
  disabled?: boolean;
  disabledReason?: string;
  closePolicy?: 'on-activate' | 'stay-open';
  invoke: () => void;
}

export interface EditorToolbarGroup {
  id: string;
  label: string;
  icon: string;
  activeItemId?: string;
  items: EditorToolbarGroupItem[];
}

export interface EditorSecondaryCopy {
  groupActive(group: string, item: string): string;
  openGroup(group: string): string;
  disabledAction(action: string, reason: string): string;
}

type EditorSecondaryRoot = ParentNode & {
  activeElement?: Element | null;
};

export interface EditorSecondaryHost {
  root(): EditorSecondaryRoot;
  requestUpdate(): void;
  updateComplete(): Promise<unknown>;
  clearTip(): void;
}

const isElementTarget = (target: EventTarget | null): target is Element =>
  !!target && typeof (target as Element).matches === 'function';

const eventPathHas = (event: Event, predicate: (element: Element) => boolean): boolean =>
  (event.composedPath?.() || [event.target]).some((target) =>
    isElementTarget(target) && predicate(target));

/** Shared lifecycle and rendering for the one contextual editor surface.
 *
 * Product-specific model builders and actions deliberately stay in the card.
 * This controller owns only the generic popover contract: one open group,
 * stale-context protection, focus restoration, outside-dismiss and the stable
 * light-DOM template used by the existing CSS and browser smokes.
 */
export class EditorSecondaryController {
  private _openGroupId: string | null = null;
  private _groupGeneration = 0;
  private _renderedContext = '';
  private _contentAnimation?: Animation;
  private _focusOwned = false;
  private _currentModel: EditorSecondaryModel | null = null;
  private _blocked = false;
  private _dismissPointerTarget: EventTarget | null = null;
  private _dismissTimer?: number;
  private _globalDismissListening = false;
  private readonly _globalDismissGuard = (event: Event): void => {
    this.handleOutsideDismiss(event);
  };

  constructor(private readonly host: EditorSecondaryHost) {}

  get hasOpenGroup(): boolean {
    return this._openGroupId !== null;
  }

  get groupGeneration(): number {
    return this._groupGeneration;
  }

  activeGroup(groups: readonly EditorToolbarGroup[]): EditorToolbarGroup | null {
    if (!this._openGroupId) return null;
    return groups.find((group) => group.id === this._openGroupId) || null;
  }

  reset(): void {
    this._openGroupId = null;
    this._contentAnimation?.cancel();
    this._contentAnimation = undefined;
    this._renderedContext = '';
    this._focusOwned = false;
    this._currentModel = null;
    this._blocked = false;
    this._dismissPointerTarget = null;
    clearTimeout(this._dismissTimer);
    this._dismissTimer = undefined;
    this._syncGlobalDismissListener();
  }

  closeForNavigation(): void {
    const dismissPalette = this._currentModel?.kind === 'palette'
      ? this._currentModel.dismiss : undefined;
    const changed = !!this._openGroupId || !!dismissPalette;
    this._openGroupId = null;
    dismissPalette?.();
    if (dismissPalette) this._currentModel = null;
    // Navigation is an explicit, higher-priority command. Never leave the
    // synthetic-click tail of an earlier outside dismissal armed: it could
    // otherwise consume the first click on the editor Close control.
    this._clearDismissClick();
    if (changed) this.host.requestUpdate();
    this._syncGlobalDismissListener();
  }

  openPalette(): void {
    if (this._openGroupId) this.closeGroup(false);
  }

  toggleGroup(groups: readonly EditorToolbarGroup[], id: string): void {
    if (this._openGroupId === id) {
      this.closeGroup(false);
      return;
    }
    if (!groups.some((group) => group.id === id)) return;
    if (this._currentModel?.kind === 'palette') this._currentModel.dismiss?.();
    this._groupGeneration += 1;
    this._openGroupId = id;
    this.host.clearTip();
    this.host.requestUpdate();
    this._syncGlobalDismissListener();
  }

  closeGroup(restoreFocus: boolean): void {
    const id = this._openGroupId;
    this._openGroupId = null;
    this.host.requestUpdate();
    this._syncGlobalDismissListener();
    if (!restoreFocus || !id) return;
    void this.host.updateComplete().then(() => {
      const root = this.host.root();
      const launchers = [...root.querySelectorAll<HTMLButtonElement>('[data-editor-group]')];
      const launcher = launchers.find((button) =>
        button.dataset.editorGroup === id && button.offsetParent !== null);
      (launcher || root.querySelector<HTMLElement>('.editbar-tools'))?.focus?.();
    });
  }

  renderGroupLauncher(
    group: EditorToolbarGroup,
    groups: readonly EditorToolbarGroup[],
    copy: EditorSecondaryCopy,
  ): TemplateResult {
    const open = this._openGroupId === group.id;
    const activeItem = group.items.find((item) =>
      item.id === group.activeItemId && !item.disabled);
    return html`<button class="btn editor-group-launcher ${open || activeItem ? 'on' : ''}"
      data-editor-group=${group.id} aria-expanded=${open ? 'true' : 'false'}
      aria-pressed=${activeItem ? 'true' : 'false'}
      aria-controls="hp-editor-secondary" @click=${() => this.toggleGroup(groups, group.id)}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        if (!open) this.toggleGroup(groups, group.id);
        void this.host.updateComplete().then(() =>
          this.host.root()
            .querySelector<HTMLButtonElement>('.editor-group-item:not([disabled])')?.focus());
      }}
      title=${activeItem ? copy.groupActive(group.label, activeItem.label) : group.label}>
      <ha-icon icon=${group.icon}></ha-icon><span class="ml">${group.label}</span>
      <ha-icon class="group-chevron" icon="mdi:chevron-down"></ha-icon>
    </button>`;
  }

  renderGroupModel(
    group: EditorToolbarGroup,
    contextId: string,
    copy: EditorSecondaryCopy,
  ): EditorSecondaryModel {
    const firstEnabled = group.items.find((item) => !item.disabled)?.id;
    const activeItemId = group.items.some((item) =>
      item.id === group.activeItemId && !item.disabled) ? group.activeItemId : undefined;
    return {
      contextId,
      kind: 'group',
      ariaLabel: copy.openGroup(group.label),
      visibleLabel: group.label,
      content: html`<div class="editor-group-items"
        @keydown=${(event: KeyboardEvent) => this._groupKeydown(event)}>
        ${group.items.map((item) => html`<button
          class="btn editor-group-item ${activeItemId === item.id ? 'on' : ''}"
          data-group-item=${item.id} ?disabled=${!!item.disabled}
          tabindex=${item.id === (activeItemId || firstEnabled) ? '0' : '-1'}
          aria-label=${item.disabled && item.disabledReason
            ? copy.disabledAction(item.label, item.disabledReason) : item.label}
          aria-pressed=${item.role === 'tool' || item.role === 'toggle'
            ? (activeItemId === item.id ? 'true' : 'false') : nothing}
          title=${item.disabled ? item.disabledReason || item.label : item.label}
          @click=${(event: MouseEvent) => this._activateGroupItem(group, item.id, event)}>
          <ha-icon icon=${item.icon}></ha-icon><span>${item.label}</span>
        </button>`)}
      </div>`,
    };
  }

  runContext(capturedContext: string, currentContext: string, action: () => void): void {
    if (capturedContext === currentContext) action();
  }

  render(model: EditorSecondaryModel | null, blocked: boolean): TemplateResult {
    this._currentModel = model;
    this._blocked = blocked;
    const kind = model?.kind || 'hidden';
    return html`<div
      class="editor-secondary-host kind-${kind} ${model ? 'open' : 'closed'} ${blocked ? 'blocked' : ''}"
      aria-hidden=${model ? 'false' : 'true'}>
      <div id="hp-editor-secondary" class="editor-secondary kind-${kind}"
        data-context-id=${model?.contextId || ''} role="toolbar"
        aria-label=${model?.ariaLabel || ''} ?inert=${!model || blocked}
        @focusin=${() => (this._focusOwned = true)}
        @focusout=${(event: FocusEvent) => {
          const next = event.relatedTarget as Node | null;
          if (!next || !(event.currentTarget as HTMLElement).contains(next))
            this._focusOwned = false;
        }}
        @pointerenter=${() => this.host.clearTip()}
        @pointerdown=${stopPropagation}
        @pointerup=${stopPropagation}
        @pointercancel=${stopPropagation}
        @click=${stopPropagation}
        @dblclick=${stopPropagation}
        @wheel=${stopPropagation}>
        ${model?.visibleLabel
          ? html`<span class="editor-context-label">${model.visibleLabel}</span>` : nothing}
        <div class="editor-secondary-content">${model?.content || nothing}</div>
      </div>
    </div>`;
  }

  afterRender(): void {
    const root = this.host.root();
    if (this._blocked) {
      if (this._openGroupId) this.closeGroup(false);
      else if (this._currentModel?.kind === 'palette') this._currentModel.dismiss?.();
    }
    this._syncGlobalDismissListener();
    const secondary = root.querySelector<HTMLElement>('.editor-secondary');
    const previousContext = this._renderedContext;
    const context = secondary?.dataset.contextId || '';
    if (context && previousContext && context !== previousContext
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      this._contentAnimation?.cancel();
      this._contentAnimation = secondary
        ?.querySelector<HTMLElement>('.editor-secondary-content')
        ?.animate([
          { opacity: 0.35, transform: 'translateY(-4px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 100, easing: 'ease-out' });
    }
    this._renderedContext = context;
    if (previousContext && context !== previousContext && this._focusOwned) {
      const target = context
        ? secondary?.querySelector<HTMLElement>(
            '[tabindex="0"], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
          )
        : root.querySelector<HTMLElement>('.editbar-tools');
      target?.focus?.();
      this._focusOwned = !!context;
    }
    if (this._currentModel?.kind === 'palette' && this._currentModel.launcherId) {
      const paletteLauncher = [...root.querySelectorAll<HTMLElement>('[data-editor-palette]')]
        .find((element) => element.dataset.editorPalette === this._currentModel?.launcherId);
      if (!paletteLauncher || paletteLauncher.offsetParent === null) this._currentModel.dismiss?.();
    }
    if (!this._openGroupId) return;
    const launcher = [...root.querySelectorAll<HTMLButtonElement>('[data-editor-group]')]
      .find((button) => button.dataset.editorGroup === this._openGroupId);
    if (!launcher || launcher.offsetParent === null) this.closeGroup(true);
  }

  /** Consume the first outside press and its synthetic click while a group is open. */
  handleOutsideDismiss(event: Event): boolean {
    const onNavigation = eventPathHas(event, (element) =>
      (element as HTMLElement).hasAttribute('data-editor-navigation'));
    if (onNavigation) {
      // A close/editor-tab click is not an accidental canvas press. Collapse
      // the transient surface, but let the same pointer sequence continue to
      // the navigation handler so one deliberate click always navigates.
      if (event.type === 'pointerdown') this.closeForNavigation();
      else if (event.type === 'click' && this._dismissPointerTarget) this._clearDismissClick();
      return false;
    }
    if (event.type === 'click' && this._dismissPointerTarget) {
      const path = event.composedPath?.() || [event.target];
      if (!path.includes(this._dismissPointerTarget)) return false;
      this._clearDismissClick();
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
    const palette = !this._openGroupId && !this._blocked
      && this._currentModel?.kind === 'palette' ? this._currentModel : null;
    if (event.type === 'pointerdown' && (this._openGroupId || palette)) {
      const insideSecondary = eventPathHas(event, (element) =>
        element.classList.contains('editor-secondary'));
      const onGroupLauncher = eventPathHas(event, (element) =>
        !!(element as HTMLElement).dataset.editorGroup);
      const onPaletteLauncher = eventPathHas(event, (element) =>
        !!(element as HTMLElement).dataset.editorPalette);
      const insideStage = eventPathHas(event, (element) => element.classList.contains('stage'));
      const staysOpenOnCanvas = palette?.dismissPolicy === 'stay-open-on-canvas' && insideStage;
      if (!insideSecondary && !onGroupLauncher && !onPaletteLauncher && !staysOpenOnCanvas) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this._dismissPointerTarget = event.target;
        clearTimeout(this._dismissTimer);
        this._dismissTimer = window.setTimeout(() => {
          this._clearDismissClick();
        }, 800);
        if (this._openGroupId) this.closeGroup(false);
        else palette?.dismiss?.();
        this._syncGlobalDismissListener();
        return true;
      }
    }
    return false;
  }

  private _activateGroupItem(group: EditorToolbarGroup, itemId: string, event: MouseEvent): void {
    if (group.id !== this._openGroupId) return;
    const item = group.items.find((entry) => entry.id === itemId);
    if (!item || item.disabled) return;
    const stayOpen = item.role === 'toggle' && item.closePolicy === 'stay-open';
    const keyboardActivation = event.detail === 0;
    if (!stayOpen) {
      this._openGroupId = null;
      this.host.requestUpdate();
      this._syncGlobalDismissListener();
    }
    item.invoke();
    if (!stayOpen && keyboardActivation) {
      void this.host.updateComplete().then(() => {
        const launcher = [...this.host.root().querySelectorAll<HTMLButtonElement>('[data-editor-group]')]
          .find((button) => button.dataset.editorGroup === group.id && button.offsetParent !== null);
        launcher?.focus();
      });
    }
  }

  private _groupKeydown(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const rail = event.currentTarget as HTMLElement;
    const items = [...rail.querySelectorAll<HTMLButtonElement>('.editor-group-item:not([disabled])')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(this.host.root().activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowLeft' ? (current <= 0 ? items.length - 1 : current - 1)
      : (current + 1) % items.length;
    items[next]?.focus();
  }

  private _clearDismissClick(): void {
    this._dismissPointerTarget = null;
    clearTimeout(this._dismissTimer);
    this._dismissTimer = undefined;
    this._syncGlobalDismissListener();
  }

  private _syncGlobalDismissListener(): void {
    const explicitPalette = !this._blocked && this._currentModel?.kind === 'palette';
    const shouldListen = !!this._openGroupId || explicitPalette || !!this._dismissPointerTarget;
    if (shouldListen === this._globalDismissListening) return;
    this._globalDismissListening = shouldListen;
    if (shouldListen) {
      window.addEventListener('pointerdown', this._globalDismissGuard, true);
      window.addEventListener('click', this._globalDismissGuard, true);
    } else {
      window.removeEventListener('pointerdown', this._globalDismissGuard, true);
      window.removeEventListener('click', this._globalDismissGuard, true);
    }
  }
}

const stopPropagation = (event: Event): void => event.stopPropagation();
