import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Preserve the complete post-measurement report in the existing CI artifact. */
export function writeNodeCiReport(report, { githubActions = process.env.GITHUB_ACTIONS, tempDirectory = tmpdir() } = {}) {
  if (githubActions !== 'true') return;
  const directory = join(tempDirectory, 'smoke-logs');
  const destination = join(directory, 'smoke_wall_node_connected.raw.json');
  mkdirSync(directory, { recursive: true });
  writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  return destination;
}
