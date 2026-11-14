/** Explicit opt-in for a dedicated no-HA document. HA entrypoints never import this module. */
import { LitElement, css, html, svg } from 'lit';
import { t, langOf } from './i18n';
import type { HostPresentationContext } from './plan-host';
import { controlMotionStyles } from './styles/ui-motion.styles';
import { assertStandaloneRegistry, STANDALONE_ELEMENTS } from './standalone-presentation-policy';
import { standaloneTheme } from './standalone-theme';
import { STANDALONE_ICON_PATHS } from './standalone-icons.generated';

class StandaloneIcon extends LitElement {
  static properties = { icon: { type: String } };
  icon = '';
  static styles = css`:host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;
    width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);flex:none;fill:currentColor}
    svg{display:block;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);
      max-width:100%;max-height:100%;flex:none;fill:currentColor}`;
  protected render() {
    const known = Object.prototype.hasOwnProperty.call(STANDALONE_ICON_PATHS, this.icon);
    this.toggleAttribute('data-hp-standalone-fallback', !known);
    return svg`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path
      d=${known ? STANDALONE_ICON_PATHS[this.icon] : STANDALONE_ICON_PATHS['mdi:help-circle-outline']}></path></svg>`;
  }
}

class StandaloneCard extends LitElement {
  static styles = css`:host{display:block;position:relative;box-sizing:border-box;color:var(--primary-text-color);
    background:var(--ha-card-background,var(--card-background-color));border-radius:var(--ha-card-border-radius,12px);
    border:var(--ha-card-border-width,1px) solid var(--ha-card-border-color,var(--divider-color));
    box-shadow:var(--ha-card-box-shadow,none)}`;
  protected render() { return html`<slot></slot>`; }
}

class StandaloneProgress extends LitElement {
  static styles = [controlMotionStyles, css`:host{display:inline-block;width:var(--mdc-circular-progress-size,48px);
    height:var(--mdc-circular-progress-size,48px);color:var(--hp-accent,var(--primary-color))}
    :host(:not([active])){display:none}svg{display:block;width:100%;height:100%;
      animation:hp-ui-spin var(--hpf-spin-duration) var(--hpf-spin-easing) infinite}
    circle{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-dasharray:78 126}
    @media(prefers-reduced-motion:reduce){svg{animation:none}}`];
  protected render() { return svg`<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="20"></circle></svg>`; }
}

const registered = new WeakMap<CustomElementRegistry, ReadonlyMap<string, CustomElementConstructor>>();
const mounts = new WeakSet<HTMLElement>();
/** No auto-detection or eager registration on module import. */
export function registerStandalonePresentation(): void {
  const registry = globalThis.customElements;
  const own = registered.get(registry);
  assertStandaloneRegistry(registry, !!document.querySelector('home-assistant'), own);
  if (own) return;
  const definitions = new Map<string, CustomElementConstructor>([
    ['ha-icon', StandaloneIcon], ['ha-card', StandaloneCard], ['ha-circular-progress', StandaloneProgress],
  ]);
  // All names were checked before the first synchronous define.
  for (const name of STANDALONE_ELEMENTS) registry.define(name, definitions.get(name)!);
  registered.set(registry, definitions);
}

export interface StandalonePresentationOptions { language: string; darkMode: boolean }

/** Publish must synchronously replace the host's presentation snapshot and
 * increment/notify its environment revision. This adapter never owns PlanHost.
 * Neither the callback nor this object receives states/auth/transport. */
export function createStandalonePresentation(container: HTMLElement, initial: StandalonePresentationOptions,
  publish: (context: HostPresentationContext) => void) {
  if (container.ownerDocument !== document) throw Error('Standalone presentation must be created in its own document');
  if (mounts.has(container)) throw Error('Standalone presentation already owns this container');
  if (typeof publish !== 'function') throw Error('A synchronous presentation publisher is required');
  registerStandalonePresentation();
  const keys = Object.keys(standaloneTheme(false));
  const previous = new Map(keys.map(key => [key, [container.style.getPropertyValue(key), container.style.getPropertyPriority(key)]]));
  let disposed = false, current: HostPresentationContext, options: StandalonePresentationOptions;
  let applied: Readonly<Record<string, string>> = {};
  const update = (next: StandalonePresentationOptions) => {
    if (disposed) throw Error('Standalone presentation has been disposed');
    registerStandalonePresentation();
    if (typeof next.language !== 'string' || typeof next.darkMode !== 'boolean') throw Error('Invalid standalone presentation options');
    const language = langOf({ language: next.language });
    const context: HostPresentationContext = Object.freeze({ language, locale: Object.freeze({ language }),
      themes: Object.freeze({ darkMode: next.darkMode, default_theme: 'houseplan-standalone' }),
      // Resolve at call time: de/fr can finish loading after this snapshot.
      localize: (key: string) => key === 'ui.common.close' ? t(language, 'btn.close') : undefined,
    });
    const theme = standaloneTheme(next.darkMode), old = applied;
    for (const [key, value] of Object.entries(theme)) container.style.setProperty(key, value);
    try {
      const result: unknown = publish(context);
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        void Promise.resolve(result).catch(() => undefined);
        throw Error('Presentation publication must be synchronous');
      }
    } catch (error) {
      for (const key of keys) {
        if (key in old) container.style.setProperty(key, old[key]);
        else { const [value, priority] = previous.get(key)!; value ? container.style.setProperty(key, value, priority) : container.style.removeProperty(key); }
      }
      throw error;
    }
    applied = theme; options = { ...next }; current = context;
    return context;
  };
  update(initial);
  mounts.add(container);
  return {
    get context() { return current; },
    update(next: Partial<StandalonePresentationOptions>) { return update({ ...options, ...next }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounts.delete(container);
      for (const key of keys) if (container.style.getPropertyValue(key) === applied[key]) {
        const [value, priority] = previous.get(key)!;
        value ? container.style.setProperty(key, value, priority) : container.style.removeProperty(key);
      }
      // A document registry cannot unregister definitions. The document stays
      // standalone-owned; disposing one mount must not alter another mount.
    },
  };
}
