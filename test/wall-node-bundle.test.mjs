import test from 'node:test';

test('#803 Select-only code has a separate lazy graph and owns its bounded cache', async () => {
  await import('../scripts/node-editor-bundle-budget.mjs');
});
