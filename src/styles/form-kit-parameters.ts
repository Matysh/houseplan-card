/** Finite optional parameters of the shared form recipe; settings values stay lazy. */
export type FormKitParameter =
  | 'form-display'
  | 'action-line-height'
  | 'mobile-field-font-size'
  | 'mobile-icon-width'
  | 'mobile-icon-min-width'
  | 'mobile-icon-padding'
  | 'mobile-label-display'
  | 'toggle-title-font-weight'
  | 'toggle-margin'
  | 'action-font-size'
  | 'action-padding-inline'
  | 'action-width'
  | 'action-height'
  | 'action-justify-self'
  | 'action-idle-danger-border'
  | 'colorrow-columns'
  | 'colorrow-align'
  | 'colorrow-min-height'
  | 'body-inset'
  | 'card-border'
  | 'card-radius'
  | 'card-background'
  | 'card-overflow'
  | 'head-padding'
  | 'head-margin'
  | 'head-border-bottom'
  | 'heading-font-size'
  | 'heading-line-height'
  | 'body-padding'
  | 'body-gap'
  | 'body-first-padding-top'
  | 'sub-min-height'
  | 'subheading-font-size'
  | 'label-min-height'
  | 'label-color'
  | 'label-font-size'
  | 'label-font-weight'
  | 'hint-font-size'
  | 'hint-line-height'
  | 'toggle-columns'
  | 'toggle-min-height'
  | 'toggle-padding'
  | 'toggle-title-display'
  | 'toggle-title-min-height'
  | 'toggle-title-font-size'
  | 'toggle-title-line-height'
  | 'toggle-text-column'
  | 'toggle-title-wrap'
  | 'toggle-icon-display'
  | 'toggle-input-column'
  | 'toggle-input-row'
  | 'callout-padding'
  | 'callout-font-size'
  | 'callout-line-height'
  | 'callout-border'
  | 'callout-radius'
  | 'callout-background'
  | 'callout-icon-display';

export interface FormKitRecipe {
  selector: string;
  values: Partial<Record<FormKitParameter, string>>;
}

/** Default rendering stays byte-identical for the frozen gallery/panel fixtures. */
export function formKitValue(options: { parameterized?: boolean }, name: FormKitParameter, fallback: string): string {
  return options.parameterized ? `var(--hpf-kit-${name},${fallback})` : fallback;
}

/** Only parameters are emitted here; common control declarations have one owner. */
export function formKitRecipeCss({ selector, values }: FormKitRecipe): string {
  const declarations = [
    values['mobile-field-font-size'] === undefined ? '' : `--hpf-kit-mobile-field-font-size: ${values['mobile-field-font-size']};`,
    values['form-display'] === undefined ? '' : `--hpf-kit-form-display: ${values['form-display']};`,
    values['action-font-size'] === undefined ? '' : `--hpf-kit-action-font-size: ${values['action-font-size']};`,
    values['action-padding-inline'] === undefined ? '' : `--hpf-kit-action-padding-inline: ${values['action-padding-inline']};`,
    values['action-width'] === undefined ? '' : `--hpf-kit-action-width: ${values['action-width']};`,
    values['action-height'] === undefined ? '' : `--hpf-kit-action-height: ${values['action-height']};`,
    values['action-justify-self'] === undefined ? '' : `--hpf-kit-action-justify-self: ${values['action-justify-self']};`,
    values['action-idle-danger-border'] === undefined ? '' : `--hpf-kit-action-idle-danger-border: ${values['action-idle-danger-border']};`,
    values['colorrow-columns'] === undefined ? '' : `--hpf-kit-colorrow-columns: ${values['colorrow-columns']};`,
    values['colorrow-align'] === undefined ? '' : `--hpf-kit-colorrow-align: ${values['colorrow-align']};`,
    values['colorrow-min-height'] === undefined ? '' : `--hpf-kit-colorrow-min-height: ${values['colorrow-min-height']};`,
    values['mobile-icon-width'] === undefined ? '' : `--hpf-kit-mobile-icon-width: ${values['mobile-icon-width']};`,
    values['mobile-icon-min-width'] === undefined ? '' : `--hpf-kit-mobile-icon-min-width: ${values['mobile-icon-min-width']};`,
    values['mobile-icon-padding'] === undefined ? '' : `--hpf-kit-mobile-icon-padding: ${values['mobile-icon-padding']};`,
    values['mobile-label-display'] === undefined ? '' : `--hpf-kit-mobile-label-display: ${values['mobile-label-display']};`,
    values['toggle-title-font-weight'] === undefined ? '' : `--hpf-kit-toggle-title-font-weight: ${values['toggle-title-font-weight']};`,
    values['toggle-margin'] === undefined ? '' : `--hpf-kit-toggle-margin: ${values['toggle-margin']};`,
    values['action-line-height'] === undefined ? '' : `--hpf-kit-action-line-height: ${values['action-line-height']};`,
    values['body-inset'] === undefined ? '' : `--hpf-kit-body-inset: ${values['body-inset']};`,
    values['card-border'] === undefined ? '' : `--hpf-kit-card-border: ${values['card-border']};`,
    values['card-radius'] === undefined ? '' : `--hpf-kit-card-radius: ${values['card-radius']};`,
    values['card-background'] === undefined ? '' : `--hpf-kit-card-background: ${values['card-background']};`,
    values['card-overflow'] === undefined ? '' : `--hpf-kit-card-overflow: ${values['card-overflow']};`,
    values['head-padding'] === undefined ? '' : `--hpf-kit-head-padding: ${values['head-padding']};`,
    values['head-margin'] === undefined ? '' : `--hpf-kit-head-margin: ${values['head-margin']};`,
    values['head-border-bottom'] === undefined ? '' : `--hpf-kit-head-border-bottom: ${values['head-border-bottom']};`,
    values['heading-font-size'] === undefined ? '' : `--hpf-kit-heading-font-size: ${values['heading-font-size']};`,
    values['heading-line-height'] === undefined ? '' : `--hpf-kit-heading-line-height: ${values['heading-line-height']};`,
    values['body-padding'] === undefined ? '' : `--hpf-kit-body-padding: ${values['body-padding']};`,
    values['body-gap'] === undefined ? '' : `--hpf-kit-body-gap: ${values['body-gap']};`,
    values['body-first-padding-top'] === undefined ? '' : `--hpf-kit-body-first-padding-top: ${values['body-first-padding-top']};`,
    values['sub-min-height'] === undefined ? '' : `--hpf-kit-sub-min-height: ${values['sub-min-height']};`,
    values['subheading-font-size'] === undefined ? '' : `--hpf-kit-subheading-font-size: ${values['subheading-font-size']};`,
    values['label-min-height'] === undefined ? '' : `--hpf-kit-label-min-height: ${values['label-min-height']};`,
    values['label-color'] === undefined ? '' : `--hpf-kit-label-color: ${values['label-color']};`,
    values['label-font-size'] === undefined ? '' : `--hpf-kit-label-font-size: ${values['label-font-size']};`,
    values['label-font-weight'] === undefined ? '' : `--hpf-kit-label-font-weight: ${values['label-font-weight']};`,
    values['hint-font-size'] === undefined ? '' : `--hpf-kit-hint-font-size: ${values['hint-font-size']};`,
    values['hint-line-height'] === undefined ? '' : `--hpf-kit-hint-line-height: ${values['hint-line-height']};`,
    values['toggle-columns'] === undefined ? '' : `--hpf-kit-toggle-columns: ${values['toggle-columns']};`,
    values['toggle-min-height'] === undefined ? '' : `--hpf-kit-toggle-min-height: ${values['toggle-min-height']};`,
    values['toggle-padding'] === undefined ? '' : `--hpf-kit-toggle-padding: ${values['toggle-padding']};`,
    values['toggle-title-display'] === undefined ? '' : `--hpf-kit-toggle-title-display: ${values['toggle-title-display']};`,
    values['toggle-title-min-height'] === undefined ? '' : `--hpf-kit-toggle-title-min-height: ${values['toggle-title-min-height']};`,
    values['toggle-title-font-size'] === undefined ? '' : `--hpf-kit-toggle-title-font-size: ${values['toggle-title-font-size']};`,
    values['toggle-title-line-height'] === undefined ? '' : `--hpf-kit-toggle-title-line-height: ${values['toggle-title-line-height']};`,
    values['toggle-text-column'] === undefined ? '' : `--hpf-kit-toggle-text-column: ${values['toggle-text-column']};`,
    values['toggle-title-wrap'] === undefined ? '' : `--hpf-kit-toggle-title-wrap: ${values['toggle-title-wrap']};`,
    values['toggle-icon-display'] === undefined ? '' : `--hpf-kit-toggle-icon-display: ${values['toggle-icon-display']};`,
    values['toggle-input-column'] === undefined ? '' : `--hpf-kit-toggle-input-column: ${values['toggle-input-column']};`,
    values['toggle-input-row'] === undefined ? '' : `--hpf-kit-toggle-input-row: ${values['toggle-input-row']};`,
    values['callout-padding'] === undefined ? '' : `--hpf-kit-callout-padding: ${values['callout-padding']};`,
    values['callout-font-size'] === undefined ? '' : `--hpf-kit-callout-font-size: ${values['callout-font-size']};`,
    values['callout-line-height'] === undefined ? '' : `--hpf-kit-callout-line-height: ${values['callout-line-height']};`,
    values['callout-border'] === undefined ? '' : `--hpf-kit-callout-border: ${values['callout-border']};`,
    values['callout-radius'] === undefined ? '' : `--hpf-kit-callout-radius: ${values['callout-radius']};`,
    values['callout-background'] === undefined ? '' : `--hpf-kit-callout-background: ${values['callout-background']};`,
    values['callout-icon-display'] === undefined ? '' : `--hpf-kit-callout-icon-display: ${values['callout-icon-display']};`,
  ].filter(Boolean).join('\n');
  return declarations ? `${selector} {\n${declarations}\n}` : '';
}

