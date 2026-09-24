/**
 * #627: the main catalog plus every lazy dictionary an editor dialog may
 * paint. The host loader settles it for the current language before
 * installing the editor runtime (a cold open never paints English first; the
 * wait sits under the existing runtime indicator), and the host render gate
 * consults it after a live language switch. It includes the onboarding set
 * (`settings`), so a host with both runtimes loaded asks the editor's.
 *
 * A module of its own, not a line in the editor runtime: the onboarding graph
 * must not reach `support`/`topology` through it.
 */
import { SETTINGS_LANGUAGE_RUNTIME } from './settings';
import { SUPPORT_LANGUAGE_RUNTIME } from './support';
import { TOPOLOGY_LANGUAGE_RUNTIME } from './topology';
import { surfaceLanguageRuntime } from './namespace-language';

export const EDITOR_LANGUAGE_RUNTIME = surfaceLanguageRuntime([
  SETTINGS_LANGUAGE_RUNTIME, SUPPORT_LANGUAGE_RUNTIME, TOPOLOGY_LANGUAGE_RUNTIME,
]);
