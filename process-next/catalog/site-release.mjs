import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { siteReleasePaths } from '../lib/site-release.mjs';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'artifacts/process-next/package.json'), 'utf8'));
const paths = siteReleasePaths(pkg.sourceSha, pkg.version);
execFileSync(process.env.HP_SITE_RELEASE_PYTHON || 'python3', [
  resolve(root, 'tools/build_site_release.py'), '--source', root,
  '--out', resolve(root, paths.directory), '--hacs', resolve(root, pkg.zip),
  '--hacs-sha256', pkg.artifactDigest, '--sha', pkg.sourceSha, '--version', pkg.version,
], { cwd: root, stdio: 'inherit', windowsHide: true });
