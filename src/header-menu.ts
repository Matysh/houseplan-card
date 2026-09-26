/**
 * #616: компактная шапка на телефоне (≤ 480 px, docs/UX-MODES.md).
 *
 * В строке остаются вкладки пространств, зум и одна шестерёнка; всё прочее из
 * шапки — пункты её меню, в фиксированном порядке и ровно с теми же действиями,
 * что у прежних кнопок. Состав меню — чистая функция (`headerMenuItems`),
 * проверяется юнитом; раскрытие, закрытие и видимость активной вкладки —
 * `HeaderMenu`. На > 480 px кнопка и меню в разметке есть, но скрыты CSS
 * (`chrome.styles.ts`), прежние кнопки видны — поэтому поведение широкой
 * шапки не зависит от этого модуля.
 */
import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';

export type HeaderMode = 'view' | 'plan' | 'devices' | 'decor';

export type HeaderMenuItem = {
  /** Стабильный id пункта: `data-id` в разметке, ключ в тестах. */
  id: string;
  label: string;
  run: () => void;
  icon?: string;
  glyph?: TemplateResult;
  /** Переключатель: состояние для `aria-pressed`. */
  pressed?: boolean;
  /** Текущий редактор: `aria-current`. */
  current?: boolean;
};

export type HeaderMenuActions = {
  setMode(mode: Exclude<HeaderMode, 'view'>): void;
  configureSpace(): void;
  addSpace(): void;
  settings(): void;
  pdf(): void;
  support(): void;
};

export type HeaderMenuInput = {
  canEdit: boolean;
  kiosk: boolean;
  mode: HeaderMode;
  hasFixedFloor: boolean;
  /** Пункты сводной панели; мобильное меню добавляет их только в просмотре. */
  summary: HeaderMenuItem[];
  t: (key: I18nKey) => string;
  actions: HeaderMenuActions;
};

const EDITORS = [['plan', 'mdi:floor-plan'], ['devices', 'mdi:tune-variant'], ['decor', 'mdi:draw']] as const;

/**
 * Состав меню по роли и режиму (ТЗ #616 п.4). Условия — те же, что у
 * прежних кнопок шапки: редакторы, пространство и настройки — `canEdit`;
 * «Добавить пространство» — ещё и без фиксированного пространства; сводная
 * панель — только в просмотре; 2.5D включается в «Общих настройках» (#649), пункта в меню нет; в киоске меню нет.
 */
export function headerMenuItems(input: HeaderMenuInput): HeaderMenuItem[] {
  if (input.kiosk) return [];
  const { t, actions } = input;
  const items: HeaderMenuItem[] = [];
  if (input.canEdit) {
    for (const [mode, icon] of EDITORS) {
      items.push({
        id: `mode-${mode}`, icon, label: t(`mode.${mode}` as I18nKey),
        current: input.mode === mode, run: () => actions.setMode(mode),
      });
    }
    items.push({ id: 'space-settings', icon: 'mdi:cog-outline', label: t('title.configure_space'), run: actions.configureSpace });
    if (!input.hasFixedFloor) {
      items.push({ id: 'space-add', icon: 'mdi:plus', label: t('title.add_space'), run: actions.addSpace });
    }
    items.push(
      { id: 'settings', icon: 'mdi:cog-outline', label: t('title.general_settings'), run: actions.settings },
      { id: 'pdf', icon: 'mdi:printer-outline', label: t('title.export_pdf'), run: actions.pdf },
      { id: 'support', icon: 'mdi:help-circle-outline', label: t('support.title'), run: actions.support },
    );
  }
  if (input.mode === 'view') items.push(...input.summary);
  return items;
}

/** What the menu needs from the card: a re-render and its shadow root — not the editor host port. */
type MenuOwner = { requestUpdate(): void; renderRoot: ParentNode };

export class HeaderMenu {
  open = false;
  private revealedFor = '';
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.open) return;
    event.stopPropagation();
    this.close(true);
  };

  constructor(private readonly owner: MenuOwner) {}

  toggle(): void {
    if (this.open) this.close(false);
    else {
      this.open = true;
      window.addEventListener('keydown', this.onKey, true);
      this.owner.requestUpdate();
    }
  }

  close(focusButton: boolean): void {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('keydown', this.onKey, true);
    this.owner.requestUpdate();
    if (focusButton) {
      (this.owner.renderRoot.querySelector('[data-hp="header-menu"]') as HTMLElement | null)?.focus();
    }
  }

  disconnect(): void {
    this.open = false;
    window.removeEventListener('keydown', this.onKey, true);
  }

  /**
   * Вкладки на телефоне прокручиваются в одну строку. Активная вкладка
   * докручивается в видимую область один раз на каждую смену пространства —
   * не на каждом рендере: иначе обновление hass отнимало бы у человека
   * ручную прокрутку вкладок.
   */
  revealActiveTab(): void {
    const nav = this.owner.renderRoot.querySelector('.head .tabs') as HTMLElement | null;
    const tab = nav?.querySelector('.tab.active') as HTMLElement | null;
    if (!nav || !tab || nav.clientWidth === 0) return;
    const id = tab.dataset.id || '';
    if (id === this.revealedFor) return;
    this.revealedFor = id;
    const box = nav.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    if (rect.left < box.left) nav.scrollLeft -= box.left - rect.left;
    else if (rect.right > box.right) nav.scrollLeft += rect.right - box.right;
  }

  render(items: HeaderMenuItem[], label: string): TemplateResult | typeof nothing {
    if (!items.length) return nothing;
    const run = (item: HeaderMenuItem) => { this.close(false); item.run(); };
    return html`<span class="header-menu-wrap">
      <button class="btn header-menu-button ${this.open ? 'on' : ''}" data-hp="header-menu"
        aria-haspopup="true" aria-expanded=${this.open ? 'true' : 'false'} aria-controls="hp-header-menu"
        title=${label} aria-label=${label} @click=${() => this.toggle()}>
        <ha-icon icon="mdi:cog-outline"></ha-icon>
      </button>
      ${this.open ? html`<div class="header-menu-scrim" data-hp="header-menu-scrim"
          @click=${(event: Event) => { event.stopPropagation(); this.close(false); }}></div>
        <div class="header-menu" id="hp-header-menu" role="group" aria-label=${label}>
          ${items.map((item) => html`<button type="button" class="header-menu-item ${item.current || item.pressed ? 'on' : ''}"
            data-hp="header-menu-item" data-id=${item.id}
            aria-current=${item.current ? 'true' : nothing}
            aria-pressed=${item.pressed === undefined ? nothing : item.pressed ? 'true' : 'false'}
            @click=${() => run(item)}>
            ${item.glyph ?? html`<ha-icon icon=${item.icon ?? 'mdi:circle-small'}></ha-icon>`}<span>${item.label}</span>
          </button>`)}
        </div>` : nothing}
    </span>`;
  }
}

/** Прежние кнопки шапки (> 480 px): вынесены сюда, чтобы шапка карточки не росла. */
export function renderHeaderActions(
  t: (key: I18nKey) => string, open: { settings(): void; pdf(): void; support(): void },
): TemplateResult {
  return html`<button class="btn header-action settings-button" data-hp="settings" @click=${open.settings} title=${t('title.general_settings')}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
    </button>
    <button class="btn header-action pdf-button" data-hp="pdf" @click=${open.pdf}
      title=${t('title.export_pdf')} aria-label=${t('title.export_pdf')}>
      <ha-icon icon="mdi:printer-outline"></ha-icon>
    </button>
    <button class="btn header-action support-button" data-hp="support" @click=${open.support}
      title=${t('support.title')} aria-label=${t('support.title')}>
      <ha-icon icon="mdi:help-circle-outline"></ha-icon>
    </button>`;
}
