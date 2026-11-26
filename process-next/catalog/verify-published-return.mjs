import { ReleaseGitAdapter } from '../lib/release.mjs';

const [remote, releaseTag, expectedBase, mergeSourceSha, materialSha, patchId] = process.argv.slice(2);
const adapter = new ReleaseGitAdapter({ cwd: process.cwd(), remote });
const exactCleanCheckout = async () =>
  await adapter.git(['rev-parse', 'HEAD']) === materialSha &&
  await adapter.git(['status', '--porcelain', '--untracked-files=normal']) === '';
if (!await exactCleanCheckout()) throw Error('Expected the clean, admitted release-return checkout');
const proof = await adapter.publishedReturnReview({
  task: { syncMode: 'merge', mergeSourceSha, releaseTag }, expectedBase, materialSha, patchId,
});
if (!proof || !await exactCleanCheckout()) throw Error('The admitted return is no longer proven to be an exact automatic merge');
console.log(`Verified ${releaseTag} (${mergeSourceSha}) + dev (${expectedBase}) → ${materialSha}`);
console.log('PROCESS_NEXT_RESULT {"tests":1,"passed":1,"failed":0}');
