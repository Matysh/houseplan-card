// Serialize this pure DOM oracle into the browser with locator.evaluate().
// Buttons use their ordinary border, not the shadows of popover surfaces.
export function singleButtonBorder(el) {
  const style=getComputedStyle(el),probe=document.createElement('span');
  probe.style.cssText='position:absolute;visibility:hidden';
  probe.style.color=el.classList.contains('danger')
    ? 'var(--hpf-danger,var(--error-color,#db543d))'
    : 'var(--hpf-accent,var(--primary-color))';
  el.append(probe);const accent=getComputedStyle(probe).color;probe.remove();
  return style.borderTopWidth==='1px'&&style.borderTopStyle==='solid'
    &&style.borderTopColor===accent&&style.outlineStyle==='none'&&style.boxShadow==='none';
}
