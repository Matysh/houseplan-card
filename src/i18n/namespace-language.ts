/**
 * #627: page-scoped runtime of one lazy dictionary namespace (`settings`,
 * `support`, `topology`). English is static — the synchronous fallback layer,
 * exactly as in the main catalog — and ru/de/fr are separate lazy chunks, one
 * per namespace × language, loaded only for the language on screen.
 *
 * It IS the tested `LanguageRuntime` (#354): two bounded attempts, the exact
 * build fingerprint, `fallback` as a settled state, and the same page-scoped
 * failure listener as the main catalog, so a failed namespace toasts through
 * the one View-card subscriber and never adds a second message text.
 */
import {
  LanguageRuntime, type LanguageRuntimeContract, type LazyLanguageModule, type LocaleDictionary,
} from './language-runtime';
import { LANGUAGE_RUNTIME, notifyLanguageLoadFailures } from './registry';

const BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export type NamespaceLoader = (attempt: 0 | 1) => Promise<LazyLanguageModule>;

export interface NamespaceLoaders {
  readonly ru: NamespaceLoader;
  readonly de: NamespaceLoader;
  readonly fr: NamespaceLoader;
}

export function namespaceLanguageRuntime(
  english: LocaleDictionary,
  loaders: NamespaceLoaders,
): LanguageRuntime {
  return new LanguageRuntime([
    { code: 'en', dictionary: english },
    { code: 'ru', loadDictionary: loaders.ru },
    { code: 'de', loadDictionary: loaders.de },
    { code: 'fr', loadDictionary: loaders.fr },
  ], BUILD_FINGERPRINT, console.warn, notifyLanguageLoadFailures);
}

/**
 * #627: the host gate of a card whose lazy surfaces carry their own
 * dictionaries. Pending while the main catalog OR any namespace used by a
 * surface loaded on this host is pending; otherwise the main catalog's state,
 * so a failed namespace alone never flips the host `lang` to English.
 */
export function composeLanguageRuntimes(
  primary: LanguageRuntimeContract,
  namespaces: readonly LanguageRuntimeContract[],
): LanguageRuntimeContract {
  return {
    state: (code) => {
      const state = primary.state(code);
      return state !== 'pending' && namespaces.some((runtime) => runtime.state(code) === 'pending')
        ? 'pending' : state;
    },
    dictionary: (code) => primary.dictionary(code),
    ensure: (code) => Promise.all([primary, ...namespaces].map((runtime) => runtime.ensure(code)))
      .then(() => undefined),
  };
}

/**
 * The host-facing runtime of one lazy surface: the main catalog plus the
 * namespaces the surface paints. Lives in the lazy graph, so the initial View
 * pays nothing for it; the host only picks the runtime of what it loaded.
 */
export function surfaceLanguageRuntime(
  namespaces: readonly LanguageRuntimeContract[],
): LanguageRuntimeContract {
  return composeLanguageRuntimes(LANGUAGE_RUNTIME, namespaces);
}
