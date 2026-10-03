/** Stable LED chunk identity for request accounting, independent of its hash. */
export function ledChunkRequestName(url) {
  const name = url.replace(/[?#].*$/, '').replace(/.*\//, '');
  // Rollup's base64url hashes may themselves contain '-' (even first).
  // Capture the known prefix instead of removing a last-hyphen suffix.
  return /^(led-strip-(?:runtime|field|editor))-[\w-]+\.js$/.exec(name)?.[1] ?? null;
}
