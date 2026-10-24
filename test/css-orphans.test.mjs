import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classesOf, parseCss, parseRules, selectorClasses, splitSelectors } from '../scripts/css-lex.mjs';
import { cssOfSource } from '../scripts/css-source.mjs';
import { scanCssOrphans } from '../scripts/css-orphans.mjs';
import { parallelSteps, summarize } from '../scripts/gate-small.mjs';

const template = text => String.fromCharCode(96) + text + String.fromCharCode(96);
function fixture(source, run) {
  const root = mkdtempSync(join(tmpdir(), 'hp-css-1019-'));
  mkdirSync(join(root, 'src'));
  for (const [name, text] of Object.entries(typeof source === 'string' ? { 'view.ts': source } : source))
    writeFileSync(join(root, 'src', name), text);
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const names = (result, kind) => result.diagnostics.filter(row => row.kind === kind).map(row => row.name);

test('lexical offsets, quoted punctuation, escapes, Unicode and nested scopes', () => {
  const text = '/* .comment */ @media (width > 10px) { @supports(display:grid) {'
    + '.caf\\e9, .\\31 0, .日本語, .emoji😀, .comma\\,name[data-x=".fake,{;}"]:is(.one,.two) {'
    + 'content:"a;  b{.fake}"; background:url("x.a;b.svg"); --list:fn(a;b);}}'
    + '@keyframes spin{from{opacity:0}50%,to{opacity:1}}}';
  const records = parseCss(text), rule = records.find(row => row.kind === 'rule');
  assert.deepEqual(rule.scope, ['@media (width > 10px)', '@supports(display:grid)']);
  assert.deepEqual(classesOf(rule.header), ['café','10','日本語','emoji😀','comma,name','one','two']);
  assert.equal(rule.declarations.length, 3);
  assert.equal(rule.declarations[0], 'content:"a;  b{.fake}"');
  assert.match(text.slice(rule.start, rule.end), /^\.caf/);
  assert.deepEqual(records.filter(row => row.kind === 'keyframes').map(row => row.name), ['spin']);
  assert.equal(records.filter(row => row.kind === 'keyframe-step').length, 2);
  assert.equal(parseRules(text).some(row => row.kind === 'wrapper'), false);
  assert.deepEqual(splitSelectors('.a[x=","],:is(.b,.c),.d\\,e'), ['.a[x=","]',':is(.b,.c)','.d\\,e']);
});

test('negation, double negation, alternatives and relational selector tokens', () => {
  const tokens = selectorClasses('.live:not(.never):not(:not(.required)):is(.first,.second):has(> .child)');
  assert.deepEqual(tokens.map(row => [row.name,row.positive]), [
    ['live',true],['never',false],['required',true],['first',true],['second',true],['child',true],
  ]);
  assert.ok(tokens.find(row => row.name === 'child').branch.some(part => part.startsWith('has@')));
  assert.deepEqual(classesOf('[href="a.b"] .x /* .comment */'), ['x']);
});

test('unquoted data URL braces stay inside the declaration rather than opening/closing CSS blocks', () => {
  for (const value of ['data:image/svg+xml,<svg>{</svg>', 'data:text/plain,}', 'data:text/plain,[']) {
    const text = '.live{background:url(' + value + ');color:red}', rules = parseCss(text);
    assert.equal(rules.length, 1); assert.equal(rules[0].header, '.live');
    assert.deepEqual(rules[0].declarations, ['background:url(' + value + ')', 'color:red']);
    assert.equal(rules[0].end, text.length);
  }
});

test('AST CSS extraction ignores comments and ordinary strings', () => {
  assert.equal(cssOfSource('// css' + template('.fake{}') + '\nconst x=' + JSON.stringify('css' + template('.fake{}'))
    + ';const y=css' + template('.real{content:"a; b"}') + ';'), '.real{content:"a; b"}');
  assert.throws(() => cssOfSource('const a=css' + template('.${name}{color:red}') + ';'), /interpolation/);
});

test('AST class producers include real helper returns, classMap and imperative writers', () => fixture(
  'const css=null,html=null,classMap=null; function helper(kind:"first"|"second"){return "helper-"+kind;}'
  + 'const unused="ghost",id="id-only";document.querySelector(".query");element.classList.contains("contains");element.classList.remove("removed");'
  + 'element.classList.replace("old","replacement");element.classList.add("added");element.classList.toggle("toggled",false);'
  + 'element.setAttribute("class","imperative");element.className="assigned";element.innerHTML=\'<i class="inner"></i>\';'
  + 'const state:"on"|"off"=input;const view=html' + template('<i id=${id} class="live ${helper(kind)} ${classMap({mapped:true,["computed-"+state]:true})}"></i>')
  + ';const s=css' + template('.live.helper-first,.helper-second,.mapped,.computed-on,.computed-off,.replacement,.added,.toggled,.imperative,.assigned,.inner{color:red}.ghost,.query,.contains,.removed,.old,.id-only{color:red}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual([...new Set(names(result,'class'))].sort(), ['contains','ghost','id-only','old','query','removed']);
    assert.deepEqual(result.dynamic, []);
  }));

test('actual CSS factory recipes stitch fragments and omit uncalled options', () => fixture(
  'const css=null,html=null;function kit({prefix}:{prefix:string},{withSwitch=true}={}){return '
  + template(' .${prefix}${css' + template('-head{color:red}') + '.cssText}${withSwitch ? " ."+prefix+"-switch{color:blue}" : ""}')
  + ';}const card={prefix:"real"};const style=document.createElement("style");style.textContent=kit(card,{withSwitch:false});'
  + 'const view=html' + template('<div class="real-head"></div>') + ';', root => {
    const result = scanCssOrphans(root);
    assert.ok(result.definitions.some(row => row.name === 'real-head'));
    assert.equal(result.definitions.some(row => row.name === 'real-switch' || row.name === '-head'), false);
    assert.deepEqual(result.diagnostics, []);
  }));

test('class expansion is per word, not Cartesian across an HTML page', () => {
  const elements = Array.from({length:70}, (_, i) => '<i class="c' + i + ' ${flag ? "on" : "off"}"></i>').join('');
  fixture('const html=null;const view=html' + template(elements) + ';', root => {
    const result = scanCssOrphans(root);
    assert.equal(result.consumers.filter(name => /^c\d+$/.test(name)).length, 70);
    assert.ok(result.consumers.includes('on') && result.consumers.includes('off'));
    assert.deepEqual(result.dynamic, []);
  });
});

test('keyframes need animation sinks or reachable CSS variables, never comparisons', () => fixture(
  'const css=null,html=null;const s=css' + template('@keyframes cssSpin{to{opacity:1}}@keyframes jsSpin{to{opacity:1}}@keyframes varSpin{to{opacity:1}}@keyframes unused{to{opacity:1}}.live{animation:cssSpin 1s,var(--motion) 2s;--motion:var(--chosen)}')
  + ';element.style.animationName="jsSpin";element.style.setProperty("--chosen","varSpin");'
  + 'element.style.setProperty("--unreachable","unused");if(event.animationName==="unused")console.log("comparison");'
  + 'const view=html' + template('<div class="live"></div>') + ';', root => {
    assert.deepEqual(names(scanCssOrphans(root),'keyframes'), ['unused']);
  }));

test('annotation binds an actual sink through an anonymous callback to its named owner', () => fixture(
  'const html=null,css=null;const s=css' + template('.mode-a,.mode-b{color:red}')
  + ';class View{render(mode:string){return [1].map(()=>{\n'
  + '/* css-uses {"owner":"View.render","kind":"class","values":["mode-a","mode-b"],"reason":"Finite states"} */\n'
  + 'return html' + template('<i class="mode-${mode}"></i>') + ';});}}', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(result.dynamic, []); assert.deepEqual(result.diagnostics, []);
  }));

test('annotations reject wrong owner/prefix, query placement, unknown keys and wildcard/duplicate values', () => {
  const cases = [
    ['wrong owner',{owner:'Other.render',kind:'class',values:['mode-a'],reason:'finite'},false],
    ['wrong prefix',{owner:'View.render',kind:'class',values:['alien-a'],reason:'finite'},false],
    ['mislocated query',{owner:'View.render',kind:'class',values:['mode-a'],reason:'finite'},true],
    ['unknown key',{owner:'View.render',kind:'class',values:['mode-a'],reason:'finite',extra:true},false],
    ['wildcard',{owner:'View.render',kind:'class',values:['mode-*'],reason:'finite'},false],
    ['duplicates',{owner:'View.render',kind:'class',values:['mode-a','mode-a'],reason:'finite'},false],
  ];
  for (const [label,annotation,query] of cases) fixture('const html=null;class View{render(mode:string){\n/* css-uses '
    + JSON.stringify(annotation) + ' */\n' + (query ? 'document.querySelector(".mode-a");\n' : '')
    + 'return html' + template('<i class="mode-${mode}"></i>') + ';}}', root => {
      assert.ok(scanCssOrphans(root).diagnostics.some(row => row.kind === 'annotation'), label);
    });
});

test('negative class predicates stay applicable; positive alternative tokens are diagnosed individually', () => fixture(
  'const html=null,css=null;const x=html' + template('<i class="live"></i>') + ';const s=css'
  + template('.live:not(.never){color:red}.live:is(.missing,.live){color:red}.live:not(:not(.required)){color:red}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(names(result,'class'), ['missing','required']);
    assert.match(result.diagnostics[0].message, /not a whole-rule/);
  }));

test('CLI --root gives file/name failures and is a mandatory gate step', () => fixture(
  'const css=null;const s=css' + template('.orphan{color:red}@keyframes abandoned{to{opacity:1}}') + ';', root => {
    const child = spawnSync(process.execPath, [resolve('scripts/css-orphans.mjs'),'--root',root], {encoding:'utf8'});
    assert.equal(child.status, 1); assert.match(child.stderr, /src\/view.ts:\d+ class "orphan"/);
    assert.match(child.stderr, /keyframes "abandoned"/);
    const step = parallelSteps('origin/dev').find(row => row.args.includes('scripts/css-orphans.mjs'));
    assert.ok(step && !step.informational);
    assert.equal(summarize([{...step,code:child.status,ms:1}]).failed, 1);
  }));

test('opaque CSS-bearing sinks and native nested CSS cannot silently pass', () => {
  fixture('const cssText:string=input;const style=document.createElement("style");style.textContent=cssText;', root => {
    assert.ok(scanCssOrphans(root).diagnostics.some(row => row.kind === 'dynamic-css'));
  });
  fixture('const css=null;const s=css' + template('.live{color:red;& .orphan{color:blue}}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.ok(result.diagnostics.some(row => row.kind === 'css-syntax' && /nesting/.test(row.message)));
  });
});

test('HTML comments, text and other attributes do not become class consumers; inline/styleMap animation does', () => fixture(
  'const html=null,css=null,styleMap=null;const view=html'
  + template('<!-- <i class="comment"></i> --><div title=\'class="quoted"\'>text class="text"</div><i class="live" style="animation:literalSpin 1s"></i><i style=${styleMap({animationName:"mappedSpin"})}></i>')
  + ';const s=css' + template('.comment,.quoted,.text{color:red}@keyframes literalSpin{to{opacity:1}}@keyframes mappedSpin{to{opacity:1}}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(names(result,'class'), ['comment','quoted','text']);
    assert.deepEqual(names(result,'keyframes'), []);
  }));

test('actual callback tuples, bounded array writes and unreachable branches are traced from the sink', () => fixture(
  'const html=null,css=null;function classNames(flag:boolean){const values:string[]=[];if(flag)values.push("one");else values.push("two");if(false)values.push("never");return values;}'
  + 'const pairs:[number,string][]=[[0,"north"],[1,"south"]];const view=html'
  + template('${pairs.map(([index,name])=>html' + template('<i class="side-${name}"></i>') + ')}<i class=${classNames(flag).join(" ")}></i>')
  + ';const s=css' + template('.side-north,.side-south,.one,.two,.never{color:red}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(names(result,'class'), ['never']);
  }));

test('keyframe annotation is bound to an actual style assignment', () => fixture(
  'const css=null;const s=css' + template('@keyframes named{to{opacity:1}}')
  + ';class View{paint(name:string){\n/* css-uses {"owner":"View.paint","kind":"keyframes","values":["named"],"reason":"Finite animation owner"} */\n'
  + 'element.style.animationName=name;}}', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(result.diagnostics, []);
  }));

test('shorthand timing keywords and function arguments are not keyframe consumers', () => fixture(
  'const css=null,html=null;const s=css' + template('@keyframes live{to{opacity:1}}@keyframes jump-start{to{opacity:1}}@keyframes linear{to{opacity:1}}@keyframes quoted{to{opacity:1}}.live{animation:live 1s steps(2,jump-start),live 1s linear,"quoted" 2s;--unused:jump-start}')
  + ';const view=html' + template('<i class="live"></i>')
  + ';other.setProperty("animation-name","jump-start");if(event.animationName==="linear"){}', root => {
    assert.deepEqual(names(scanCssOrphans(root),'keyframes').sort(), ['jump-start','linear']);
  }));

test('animation-name permits a timing keyword name, including through CSS variables and quoted shorthand', () => fixture(
  'const css=null,html=null;const s=css' + template('@keyframes linear{to{opacity:1}}@keyframes steps{to{opacity:1}}.live{animation-name:var(--name);--name:linear;animation:"steps" 1s;--fake:unused}')
  + ';const view=html' + template('<i class="live"></i>') + ';', root => {
    assert.deepEqual(names(scanCssOrphans(root),'keyframes'), []);
  }));

test('mutable class appends are consumers; unbounded writes remain unresolved', () => fixture(
  'const html=null,css=null;let cls="room";if(flag)cls+=" picked";if(other)cls+=" styled";const x=html'
  + template('<i class=${cls}></i>') + ';let unknown="base";unknown+=input;const y=html' + template('<i class=${unknown}></i>')
  + ';const s=css' + template('.room,.picked,.styled{color:red}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(names(result,'class'), []); assert.ok(result.dynamic.length);
  }));

test('CSS alternatives and partial opaque fragments cannot disappear behind a finite first branch', () => {
  fixture('const html=null;const x=html' + template('<i style=${flag ? "color:red" : unknownStyle}></i>') + ';', root => {
    assert.ok(scanCssOrphans(root).diagnostics.some(row => row.kind === 'dynamic-css'));
  });
  fixture('const style=document.createElement("style");style.textContent=' + template('.live{color:red}${unknownCss}') + ';', root => {
    assert.ok(scanCssOrphans(root).diagnostics.some(row => ['dynamic-css','css-syntax'].includes(row.kind)));
  });
});

test('aliased tags/classMap and factory source provenance follow actual AST symbols', () => fixture({
  'tags.ts': 'export const html=null,svg=null,css=null,classMap=null;',
  'factory.ts': 'export function kit(prefix:string){return ' + template('.${prefix}-head{color:red}') + ';}',
  'view.ts': 'import{html as h,svg as s,css as c,classMap as cm}from"./tags";import{kit}from"./factory";'
    + 'const style=document.createElement("style");style.textContent=kit("real");const v=h'
    + template('<i class=${cm({mapped:true})}></i>') + ';const v2=s' + template('<g class="svg"></g>')
    + ';const sheet=c' + template('.mapped,.svg{color:red}') + ';',
}, root => {
  const result = scanCssOrphans(root), missing = result.diagnostics.find(row => row.name === 'real-head');
  assert.deepEqual(names(result,'class'), ['real-head']);
  assert.equal(missing.file, 'src/factory.ts'); assert.equal(missing.owner, 'kit');
  assert.equal(missing.emittedAt.file, 'src/view.ts');
}));

test('classMap follows actual variable/spread keys and reports opaque maps', () => fixture(
  'const html=null,css=null,classMap=null;const flag=true;const base={first:true};const map={...base,flag,["side-"+side]:true};const side:"a"|"b"=input;const v=html'
  + template('<i class=${classMap(map)}></i><i class=${classMap(opaqueMap)}></i>')
  + ';const s=css' + template('.first,.flag,.side-a,.side-b{color:red}') + ';', root => {
    const result = scanCssOrphans(root);
    assert.deepEqual(names(result,'class'), []); assert.equal(result.dynamic.length, 1);
  }));
