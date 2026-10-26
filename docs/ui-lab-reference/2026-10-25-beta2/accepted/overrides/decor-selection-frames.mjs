// Local beta.2 experiment: reuse the product's single-object selection paint.
// Selection membership, gestures and saved plan data remain product-owned.
export function installDecorSelectionFrames(card, enabled) {
  const patched = new WeakSet();
  const render = card.render;
  card.render = function (...args) {
    const properties = this._editorRuntime?.properties;
    if (properties && !patched.has(properties)) {
      patched.add(properties);
      const selection = properties.selection;
      properties.selection = function (...selectionArgs) {
        const target = this.identity && this.target();
        if (!enabled() || target?.kind !== 'decor-group') return selection.apply(this, selectionArgs);
        return target.value.map(shape => {
          const single = { ...target, kind: 'decor', value: shape };
          const textBox = shape.kind === 'text' ? this.groupText.get(shape) : null;
          const host = textBox ? new Proxy(this.host, {
            get(owner, key) { return key === '_dtBox' ? { ...textBox, id: shape.id } : Reflect.get(owner, key, owner); },
          }) : this.host;
          const view = new Proxy(this, {
            get(owner, key) {
              if (key === 'target') return () => single;
              if (key === 'host') return host;
              if (key === 'selectedTextId') return shape.kind === 'text' ? shape.id : null;
              return Reflect.get(owner, key, owner);
            },
          });
          return selection.apply(view, selectionArgs);
        });
      };
    }
    return render.apply(this, args);
  };
}
