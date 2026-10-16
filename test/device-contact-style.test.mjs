import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptDeviceContactStyles } from '../test-build/device-contact.styles.js';

test('#866 contact style adoption preserves Lit/capture sheets, is once per root, shared per document',()=>{
  class Sheet{replaceSync(css){this.css=css;}}
  const document={defaultView:{CSSStyleSheet:Sheet}};
  const base={},capture={},root={ownerDocument:document,adoptedStyleSheets:[base,capture]};
  adoptDeviceContactStyles(root);
  assert.equal(root.adoptedStyleSheets.length,3);assert.equal(root.adoptedStyleSheets[0],base);assert.equal(root.adoptedStyleSheets[1],capture);
  const contact=root.adoptedStyleSheets[2];assert.ok(contact instanceof Sheet);
  adoptDeviceContactStyles(root);assert.equal(root.adoptedStyleSheets.length,3);
  const other={ownerDocument:document,adoptedStyleSheets:[base]};adoptDeviceContactStyles(other);
  assert.equal(other.adoptedStyleSheets[1],contact);
});

test('#866 style fallback appends one owned node without replacing a rendered child',()=>{
  const scene={},children=[scene],document={defaultView:{},createElement:tag=>({tag,textContent:''})};
  const root={ownerDocument:document,append:node=>children.push(node)};
  adoptDeviceContactStyles(root);adoptDeviceContactStyles(root);
  assert.equal(children.length,2);assert.equal(children[0],scene);assert.equal(children[1].tag,'style');
});
