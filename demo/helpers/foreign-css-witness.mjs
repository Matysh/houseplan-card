import { loadForeignCss, assertForeignCssWitness } from '../../scripts/css-foreign.mjs';

/** Observe actual HA shadow trees. Does not create nodes/classes or alter state. */
export function createForeignCssWitness(provenance, root = process.cwd(), files) {
  const loaded = loadForeignCss(root);
  const contract = files ? { ...loaded, entries: loaded.entries.filter(row => files.includes(row.file)) } : loaded;
  const observed = new Map();
  const vocabulary = [...new Set(contract.entries.map(row => row.component))];
  return {
    async observe(picker) {
      const rows = await picker.evaluate((element, components) => {
        const found = [], visited = new Set();
        function visit(node) {
          if (visited.has(node)) return; visited.add(node);
          if (components.includes(node.localName)) {
            for (const item of [node, ...(node.shadowRoot?.querySelectorAll('*') || [])])
              for (const name of item.classList) found.push({ component: node.localName, name });
          }
          for (const child of node.shadowRoot?.querySelectorAll('*') || []) visit(child);
        }
        visit(element); return found;
      }, vocabulary);
      for (const row of rows) observed.set(row.component + ':' + row.name, row);
    },
    assertComplete() {
      const rows = [...observed.values()];
      assertForeignCssWitness(contract, provenance, rows);
      return { provider: contract.provider, classes: contract.entries };
    },
  };
}
