// Receipt identity, not the environment passed to tools (#954, #960).
export function localGateEnvironment(env, platform = process.platform) {
  const entries = new Map();
  for (const [raw, value] of Object.entries(env)) {
    const key = platform === 'win32' ? raw.toUpperCase() : raw;
    if (/^GIT_/i.test(key) || key === 'WSL_INTEROP') continue;
    if (entries.has(key) && entries.get(key) !== value) throw Error(`conflicting environment key: ${key}`);
    entries.set(key, value);
  }
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}
