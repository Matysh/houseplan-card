// #1013 / accepted #1007: two full-width fields, with 18px on either
// side of their 1px section divider. Judge rendered boxes, not CSS syntax.
export function stackedFieldChecks({ container, fields }) {
  const rectVisible = (r) => !!r && ['left', 'right', 'top', 'bottom', 'width', 'height']
    .every((key) => Number.isFinite(r[key])) && r.width > 0 && r.height > 0;
  const visible = rectVisible(container) && fields.length === 2
    && fields.every(({ field, control }) => rectVisible(field) && rectVisible(control));
  const near = (a, b) => Math.abs(a - b) <= 1; // CSS-pixel rounding only.
  return {
    visible,
    fullWidth: visible && fields.every(({ field, control }) => [field, control]
      .every((r) => near(r.left, container.left) && near(r.right, container.right))),
    fieldsInsideContainer: visible && fields.every(({ field }) =>
      field.top >= container.top - 1 && field.bottom <= container.bottom + 1),
    controlsInsideFields: visible && fields.every(({ field, control }) =>
      control.top >= field.top && control.bottom <= field.bottom),
    ordered: visible && fields[1].field.top > fields[0].field.bottom,
    sectionSpacing: visible && near(fields[1].field.top - fields[0].field.bottom, 37),
  };
}
