/** A basis change owns this one Lit child part, never a host/plan render. */
import {html,nothing} from 'lit';
import {AsyncDirective,directive} from 'lit/async-directive.js';

interface HintSource {subscribeHint(listener:()=>void):()=>void}
class DimensionHint extends AsyncDirective {
  private source:HintSource|null=null;
  private release:(()=>void)|null=null;
  private text:()=>string|null=()=>null;
  private changed:()=>void=()=>{};
  private readonly refresh=()=>{this.setValue(this.view());this.changed();};
  private connect():void {
    if(this.isConnected&&!this.release&&this.source)this.release=this.source.subscribeHint(this.refresh);
  }
  private view() {
    const text=this.text();
    return text?html`<p class="hp-prop-hint">${text}</p>`:nothing;
  }
  render(source:HintSource,text:()=>string|null,changed:()=>void) {
    if(this.source!==source){this.release?.();this.release=null;this.source=source;}
    this.text=text;this.changed=changed;this.connect();return this.view();
  }
  protected disconnected():void {this.release?.();this.release=null;}
  protected reconnected():void {this.connect();this.refresh();}
}
export const wallDimensionHint=directive(DimensionHint);
