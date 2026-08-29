/**
 * Prepare editor internals for demo harnesses across comparison baselines.
 *
 * Since #337 current builds keep the editor in a lazy runtime and expose an
 * explicit preload method. Older stable builds are monolithic: absence of the
 * method means there is nothing to preload, not that the baseline is broken.
 * A present method remains fail-closed through its result or exception.
 */
export async function ensureHarnessEditorRuntime(
  card = globalThis.window?.__card,
) {
  const ensure = card?._ensureEditorRuntime;
  if (typeof ensure !== 'function') return true;
  return Boolean(await ensure.call(card));
}
