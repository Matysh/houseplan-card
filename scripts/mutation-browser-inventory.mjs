// #811: counts belong to the listed IDs, not to the registry. Membership is a
// separate policy (CLI warns, unit is strict). Keep source offsets so repairs
// and patch comparison can replace numeric cells without rewriting any prose.
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function parseBrowserGuardInventory(markdown, { guideline, validateCounts = true } = {}) {
  const text = String(markdown);
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const offsets = [];
  let offset = 0;
  for (const line of text.split('\n')) { offsets.push(offset); offset += line.length + 1; }
  const starts = lines.flatMap((line, index) => /^\| Category \| Count \|/.test(line) ? [index] : []);
  requireThat(starts.length === 1, 'browser inventory category table is missing or duplicated');
  const tableStart = starts[0];
  requireThat(/^\|\s*:?-+:?\s*\|\s*:?-+:?\s*\|/.test(lines[tableStart + 1] || ''),
    'browser inventory category table separator is missing');
  const counts = new Map();
  const numericSpans = [];
  let total;
  let documentedGuideline;
  for (let at = tableStart + 2; at < lines.length && lines[at].startsWith('|'); at += 1) {
    const row = /^\|([^|]*)\|([^|]*)\|(.*)\|\s*$/.exec(lines[at]);
    requireThat(row, 'malformed browser inventory category table row');
    const category = row[1].replaceAll('**', '').trim();
    const count = row[2].replaceAll('**', '').trim();
    requireThat(category.length > 0, 'browser inventory category name is empty');
    if (category === 'Total') {
      requireThat(total === undefined, 'duplicate browser inventory total');
      requireThat(/^\d+\s*\/\s*\d+$/.test(count), 'browser inventory total / guideline must be numeric');
      [total, documentedGuideline] = count.split('/').map(Number);
      requireThat(Number.isSafeInteger(total) && Number.isSafeInteger(documentedGuideline),
        'browser inventory total / guideline must be safe integers');
    } else {
      requireThat(!counts.has(category), `duplicate category table row: ${category}`);
      requireThat(/^\d+$/.test(count) && Number.isSafeInteger(Number(count)), `category count must be numeric: ${category}`);
      counts.set(category, Number(count));
    }
    const digits = /\d+/.exec(row[2]);
    const start = offsets[at] + row[1].length + 2 + digits.index;
    numericSpans.push({ start, end: start + digits[0].length, category: category === 'Total' ? null : category });
  }
  requireThat(total !== undefined, 'browser inventory total is missing');

  const inventoryStarts = lines.flatMap((line, index) => line === '## Reviewed per-mutant inventory' ? [index] : []);
  requireThat(inventoryStarts.length === 1, 'reviewed per-mutant inventory is missing or duplicated');
  const categories = new Map();
  const documented = new Set();
  let currentCategory;
  for (const line of lines.slice(inventoryStarts[0] + 1)) {
    if (line.startsWith('## ')) break;
    const heading = /^### (.+)$/.exec(line);
    if (heading) {
      currentCategory = heading[1].trim();
      requireThat(!categories.has(currentCategory), `duplicate inventory category: ${currentCategory}`);
      categories.set(currentCategory, []);
    }
    const item = /^- `([^`]+)`\s*$/.exec(line);
    if (!item) {
      // A malformed list entry is not absent registry membership: silently
      // ignoring it would let regeneration erase its contribution to counts.
      requireThat(!/^\s*(?:[-*+](?:\s|$)|\d+[.)]\s)/.test(line), `malformed browser guard ID: ${line.trim()}`);
      continue;
    }
    requireThat(currentCategory, `browser guard has no category: ${item[1]}`);
    requireThat(!documented.has(item[1]), `duplicate browser guard ID: ${item[1]}`);
    documented.add(item[1]);
    categories.get(currentCategory).push(item[1]);
  }
  requireThat(categories.size > 0, 'browser inventory has no categories');
  requireThat(counts.size === categories.size && [...counts.keys()].every((name) => categories.has(name)),
    'category table and reviewed inventory must name the same categories');
  const proseGuideline = /The guideline is `(\d+)`/.exec(text);
  requireThat(proseGuideline, 'browser inventory prose guideline is missing');
  requireThat(documentedGuideline === (guideline ?? Number(proseGuideline[1])), 'browser inventory guideline differs from policy');
  requireThat(Number(proseGuideline[1]) === (guideline ?? documentedGuideline), 'browser inventory prose guideline differs from policy');
  if (validateCounts) {
    for (const [category, ids] of categories) {
      requireThat(counts.get(category) === ids.length, `category count differs from listed IDs: ${category}`);
    }
    requireThat(total === documented.size, 'browser inventory total differs from listed IDs');
  }
  return { counts, categories, documented, total, documentedGuideline, numericSpans };
}

const replaceCounts = (markdown, parsed, value) => {
  let text = String(markdown);
  for (const span of [...parsed.numericSpans].reverse()) {
    text = text.slice(0, span.start) + value(span) + text.slice(span.end);
  }
  return text;
};

/** Count digits only. The guideline denominator, formatting, IDs and prose stay exact. */
export function normalizeBrowserGuardCounts(markdown) {
  const parsed = parseBrowserGuardInventory(markdown, { validateCounts: false });
  return replaceCounts(markdown, parsed, () => '0');
}

export function regenerateBrowserGuardCounts(markdown) {
  const parsed = parseBrowserGuardInventory(markdown, { validateCounts: false });
  return replaceCounts(markdown, parsed, ({ category }) => String(category === null
    ? parsed.documented.size : parsed.categories.get(category).length));
}
