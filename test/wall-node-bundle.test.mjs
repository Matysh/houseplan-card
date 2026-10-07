import test from 'node:test';

test('#803 Select-only code has a separate bounded graph and stays out of existing eager/editor budgets', async () => {
  await import('../scripts/node-editor-bundle-budget.mjs');
});
