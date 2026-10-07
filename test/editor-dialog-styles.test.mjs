/**
 * #805: CSS only the editor renders lives in the lazy editor runtime.
 *
 * Ownership (AC6) is judged on the SOURCE tree by the selection rule of the
 * spec (`test/helpers/editor-style-ownership.mjs`): a lazy selector must carry
 * a class of the editor runtime graph that no source of the View graph or of
 * another lazy graph uses. The reverse ratchet keeps a new editor-only rule
 * out of the eager `dialogs` sheet. Adoption (AC3/AC5 unit part) runs on fake
 * shadow roots — with `adoptedStyleSheets` and through Lit's `<style>`
 * fallback — so cascade order and per-root idempotency are pinned without a
 * browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  EDITOR_ENTRY, REPO_ROOT, VIEW_ENTRIES, classesOf, cssOfSource, editorOnlyRules,
  isEditorOnlySelector, ownershipIndex, parseRules, readRepo, staticGraph,
} from './helpers/editor-style-ownership.mjs';

const LAZY_SHEET = 'src/styles/editor-dialogs.styles.ts';
const TRAY_SHEET = 'src/editor-secondary.styles.ts';
const ADOPTION = 'src/editor-style-adoption.ts';
/** The eager surface files of `cardStyles` (#266) plus the 2.5D tiles (#649). */
const EAGER_SHEETS = ['base', 'plan', 'devices', 'chrome', 'dialogs', 'iso-tiles']
  .map((name) => `src/styles/${name}.styles.ts`);
/** Renders into its own root with `cardStyles`; must not lean on moved rules (contract p. 5). */
const OWN_ROOT_CONSUMERS = ['src/hp-device-preview.ts'];

const rulesOf = (path) => parseRules(cssOfSource(readRepo(path)));
const where = (rule) => `${rule.scope.length ? `${rule.scope.join(' ')} ` : ''}${rule.header}`;

let cachedIndex;
const index = () => (cachedIndex ??= ownershipIndex());

test('#805 AC6 every selector of the lazy dialog sheet belongs to the editor runtime alone', () => {
  const rules = rulesOf(LAZY_SHEET);
  assert.ok(rules.length > 150, `expected the moved dialog rules, got ${rules.length}`);
  const foreign = rules.flatMap((rule) => rule.selectors
    .filter((selector) => !isEditorOnlySelector(index(), selector))
    .map((selector) => `${where(rule)} → ${selector}`));
  assert.deepEqual(foreign, [],
    'each selector needs a class of the editor graph that the View graph and the other lazy graphs '
    + 'never use; .btn, .recoveryoverlay, .editorloading, .vaccalbar and rules shared with onboarding stay eager');
});

test('#805 hp-device-preview keeps every rule it renders with: no moved selector reaches its own root', () => {
  const previewAware = ownershipIndex({ extraView: OWN_ROOT_CONSUMERS });
  const leaning = rulesOf(LAZY_SHEET).flatMap((rule) => rule.selectors
    .filter((selector) => !isEditorOnlySelector(previewAware, selector))
    .map((selector) => `${where(rule)} → ${selector}`));
  assert.deepEqual(leaning, []);
});

/** The tray's own classes: `EditorSecondaryController` renders them, nobody else (#805). */
const TRAY_CLASSES = [
  'editor-secondary-host', 'editor-secondary', 'editor-secondary-content',
  'editor-context-label', 'editor-group-items', 'editor-group-launcher',
];
const TRAY_RENDERER = 'src/editor-secondary.ts';

test('#805 the contextual tray sheet styles only the tray the editor runtime renders', () => {
  // The tray sheet moved whole (scope of #805), not by the selection rule: the
  // View card names `.editor-secondary` in its keyboard guard, so the class is
  // "in View sources" without the View ever rendering it. The guard is
  // therefore about rendering: every tray rule is anchored on a tray class,
  // only the tray renderer puts those classes into markup, and the renderer is
  // reachable from the editor runtime alone.
  const rules = rulesOf(TRAY_SHEET);
  assert.ok(rules.length > 20, `expected the tray sheet, got ${rules.length}`);
  const problems = [];
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      if (selector === ':host') {
        // Defined on the host only once the runtime arrives (contract p. 6).
        const foreign = rule.declarations.filter((declaration) => !declaration.startsWith('--hp-editor-tray-'));
        if (foreign.length) problems.push(`${where(rule)} declares ${foreign.join('; ')}`);
      } else if (!classesOf(selector).some((cls) => TRAY_CLASSES.includes(cls))) {
        problems.push(`${where(rule)} → ${selector} has no tray class`);
      }
    }
  }
  const { viewFiles, otherFiles, editorFiles } = index();
  const renderer = resolve(REPO_ROOT, TRAY_RENDERER);
  for (const file of new Set([...viewFiles, ...otherFiles, ...editorFiles])) {
    if (file === renderer || /styles?\.ts$/.test(file)) continue;
    const text = readRepo(file.slice(REPO_ROOT.length + 1));
    for (const match of text.matchAll(/class=(?:"([^"]*)"|\$\{([^}]*)\})/g)) {
      const tokens = `${match[1] ?? ''} ${match[2] ?? ''}`.match(/[A-Za-z0-9_-]+/g) || [];
      for (const cls of TRAY_CLASSES) if (tokens.includes(cls)) problems.push(`${file} renders .${cls}`);
    }
  }
  assert.equal(editorFiles.has(renderer), true, 'the tray renderer left the editor runtime graph');
  assert.equal(viewFiles.has(renderer), false, 'the View graph renders the tray without the runtime');
  assert.equal(otherFiles.has(renderer), false, 'another lazy graph renders the tray without the runtime');
  assert.deepEqual(problems, []);
});

test('#805 AC6 no lazy selector exists in an eager sheet, inside or outside its at-rule', () => {
  const eager = new Map();
  for (const path of EAGER_SHEETS) {
    for (const rule of rulesOf(path)) {
      for (const selector of rule.selectors) {
        eager.set(selector, `${path}: ${where(rule)}`);
        eager.set(`${rule.scope.join(' ')}|${selector}`, `${path}: ${where(rule)}`);
      }
    }
  }
  const twins = [];
  for (const path of [LAZY_SHEET, TRAY_SHEET]) {
    for (const rule of rulesOf(path)) {
      for (const selector of rule.selectors) {
        if (selector === ':host' && path === TRAY_SHEET) continue; // custom properties only (test above)
        const hit = eager.get(selector) ?? eager.get(`${rule.scope.join(' ')}|${selector}`);
        if (hit) twins.push(`${path}: ${where(rule)} ↔ ${hit}`);
      }
    }
  }
  // A twin left behind (the 520 px pair of .backupcounts) changes which rule wins
  // only at one width; the selector moves with every occurrence or not at all.
  assert.deepEqual(twins, []);
});

test('#805 AC6 reverse ratchet: the eager dialogs sheet holds no rule that belongs to the editor alone', () => {
  const stray = editorOnlyRules(index(), rulesOf('src/styles/dialogs.styles.ts')).map(where);
  assert.deepEqual(stray, [],
    `an editor-only rule belongs in ${LAZY_SHEET}; the View would download and match it on every cold start`);
});

test('#805 AC1 the lazy sheets and their adoption live only in the editor runtime graph', () => {
  const lazyModules = [LAZY_SHEET, TRAY_SHEET, ADOPTION].map((path) => resolve(REPO_ROOT, path));
  const view = staticGraph(VIEW_ENTRIES);
  const editor = staticGraph([EDITOR_ENTRY]);
  const onboarding = staticGraph(['src/houseplan-onboarding-runtime.ts']);
  for (const file of lazyModules) {
    assert.equal(view.has(file), false, `${file} is statically reachable from the View`);
    assert.equal(onboarding.has(file), false, `${file} would grow the onboarding graph`);
    assert.equal(editor.has(file), true, `${file} is not in the editor runtime graph`);
  }
  // The tray back in the card's static styles imports its sheet into the View graph: red above.
});

// ---- adoption on fake roots --------------------------------------------------

/** Lit decides `supportsAdoptingStyleSheets` at import time; give it a world that has them. */
class FakeSheet {
  replaceSync(text) { this.text = text; }
  replace(text) { this.text = text; return Promise.resolve(this); }
}
const installAdoptingWorld = () => {
  globalThis.ShadowRoot ??= class ShadowRoot {};
  globalThis.Document ??= class Document {};
  if (!('adoptedStyleSheets' in globalThis.Document.prototype)) {
    Object.defineProperty(globalThis.Document.prototype, 'adoptedStyleSheets', { value: [], configurable: true });
  }
  globalThis.CSSStyleSheet = FakeSheet;
};

const loadAdoption = async () => {
  installAdoptingWorld();
  const styles = await import('../test-build/styles.js');
  const adoption = await import('../test-build/editor-style-adoption.js');
  const { editorDialogsStyles } = await import('../test-build/styles/editor-dialogs.styles.js');
  const { editorSecondaryStyles } = await import('../test-build/editor-secondary.styles.js');
  const flat = (group) => (Array.isArray(group) ? group.flatMap(flat) : [group]);
  return { ...styles, ...adoption, editorDialogsStyles, editorSecondaryStyles, cardList: flat(styles.cardStyles) };
};

const fakeDocument = () => {
  const doc = {
    defaultView: { CSSStyleSheet: FakeSheet },
    createElement: (localName) => ({
      localName, textContent: '', parent: null,
      after(next) {
        const siblings = this.parent.children;
        next.parent = this.parent;
        siblings.splice(siblings.indexOf(this) + 1, 0, next);
      },
    }),
  };
  return doc;
};

test('#805 AC3 adoption: canonical cascade slots, once per root, one sheet object per document', async () => {
  const { adoptEditorStyles, cardList, dialogsStyles, editorDialogsStyles, editorSecondaryStyles } = await loadAdoption();
  const litSheets = cardList.map((result) => result.styleSheet);
  assert.ok(litSheets.every((sheet) => sheet instanceof FakeSheet), 'Lit must adopt sheets in this world');
  const late = new FakeSheet(); // form kit (#594) / summary panel (#437) adopt after Lit
  const doc = fakeDocument();
  const root = { ownerDocument: doc, adoptedStyleSheets: [...litSheets, late] };

  assert.equal(adoptEditorStyles({ renderRoot: root }), true);
  const list = root.adoptedStyleSheets;
  const dialogsAt = litSheets.indexOf(dialogsStyles.styleSheet);
  assert.ok(dialogsAt > 0);
  // [base, plan, devices, chrome, dialogs (eager), editorDialogs, isoTiles…, editorSecondary, late]
  assert.deepEqual(list.slice(0, dialogsAt + 1), litSheets.slice(0, dialogsAt + 1));
  assert.equal(list[dialogsAt + 1].text, editorDialogsStyles.cssText, 'moved rules right after the eager dialogs sheet');
  assert.deepEqual(list.slice(dialogsAt + 2, litSheets.length + 1), litSheets.slice(dialogsAt + 1));
  assert.equal(list[litSheets.length + 1].text, editorSecondaryStyles.cssText, 'tray sheet right after cardStyles');
  assert.equal(list.at(-1), late, 'sheets adopted later stay later');
  assert.equal(list.length, litSheets.length + 3);

  // Idempotent per root: a second create() (a retry, a reopened dialog) adds nothing.
  const before = [...list];
  assert.equal(adoptEditorStyles({ renderRoot: root }), true);
  assert.deepEqual(root.adoptedStyleSheets, before);

  // A second card on the page: its own root gets the sheets, the objects are shared.
  const second = { ownerDocument: doc, adoptedStyleSheets: [...litSheets] };
  adoptEditorStyles({ renderRoot: second });
  assert.equal(second.adoptedStyleSheets.length, litSheets.length + 2);
  assert.equal(second.adoptedStyleSheets[dialogsAt + 1], list[dialogsAt + 1]);
  assert.equal(second.adoptedStyleSheets.at(-1), list[litSheets.length + 1]);

  // Another document builds its own sheet objects (NotAllowedError otherwise, #594).
  const foreign = { ownerDocument: fakeDocument(), adoptedStyleSheets: [...litSheets] };
  adoptEditorStyles({ renderRoot: foreign });
  assert.notEqual(foreign.adoptedStyleSheets[dialogsAt + 1], list[dialogsAt + 1]);
  assert.equal(foreign.adoptedStyleSheets[dialogsAt + 1].text, editorDialogsStyles.cssText);
});

test('#805 AC3 adoption without adoptedStyleSheets: <style> nodes in the same relative order', async () => {
  const { adoptEditorStyles, cardList, dialogsStyles, editorDialogsStyles, editorSecondaryStyles } = await loadAdoption();
  const doc = fakeDocument();
  const root = { ownerDocument: doc, children: [] };
  root.append = (node) => { node.parent = root; root.children.push(node); };
  const template = { localName: 'div', textContent: 'template' };
  root.append(template);
  for (const result of cardList) {
    const style = doc.createElement('style');
    style.textContent = result.cssText;
    root.append(style);
  }
  const late = doc.createElement('style');
  late.textContent = '.hpf-card{}';
  root.append(late);

  adoptEditorStyles({ renderRoot: root });
  adoptEditorStyles({ renderRoot: root });
  const texts = root.children.map((node) => node.textContent);
  const cardTexts = cardList.map((result) => result.cssText);
  const dialogsAt = cardList.indexOf(dialogsStyles);
  assert.deepEqual(texts, [
    'template',
    ...cardTexts.slice(0, dialogsAt + 1),
    editorDialogsStyles.cssText,
    ...cardTexts.slice(dialogsAt + 1),
    editorSecondaryStyles.cssText,
    '.hpf-card{}',
  ]);
});

test('#805 adoption waits for a render root instead of guessing one', async () => {
  const { adoptEditorStyles } = await loadAdoption();
  assert.equal(adoptEditorStyles({}), false);
});
