import { externalScreensCss } from './external-screens.styles';
import { vacuumSettingsCss } from './vacuum-settings.styles';
/** Shared, editor-only presentation for the four approved settings forms (#944).
 * Menus are owned by hp-settings-select; its hidden native child holds values only.
 */
import { formKitTextareaCss } from './form-input.styles';
import { checkLabelsCss, CARD_DIALOG_FORM_KIT } from './form-kit.styles';
import { readingTextCss, readingSeparatorCss, readingGlyphCss } from './reading-kit.styles';
import { settingsTextLinkCss, settingsInlineLinkCss, settingsActionsCss, settingsInteractiveCss } from './settings-action.styles';
export const settingsDialogCss = `
  
hp-dialog[settings-layout]{--hp-dialog-wide-width:610px;--hp-dialog-icon-size:40.48px;--hp-settings-help-size:22px;--hp-settings-help-scale:1.06;}
hp-dialog.danger-confirm-dialog[settings-layout]{--hp-dialog-icon-size:28px;}
hp-dialog.danger-confirm-dialog[settings-layout] .danger-confirm-body{gap:12px;}
hp-dialog.danger-confirm-dialog[settings-layout] .danger-confirm-object{font-size:14px;line-height:1.45;}
hp-dialog:is([data-kind=space],[data-kind=marker])[settings-layout]{--hp-dialog-settings-height:780px;}
.hpf-form.hpf-settings-form{display:flex;flex-direction:column;}
.hpf-settings-layout{display:grid;grid-template-columns:155px minmax(0,1fr);min-width:0;align-items:stretch;flex:1 0 auto;}
.hpf-settings-nav{position:sticky;top:0;display:grid;align-content:start;gap:4px;padding:13px 8px;min-width:0;}
.hpf-settings-nav hr{width:100%;border:0;margin:14px 0;}
.hpf-settings-content{min-width:0;align-self:stretch;border-inline-start:1px solid var(--hpf-line);padding:20px;}
.hpf-settings-pane[hidden]{display:none!important;}
.hpf-settings-form .hpf-settings-pane .hpf-grid-stacked{display:block;}
.hpf-settings-pane .hpf-colorfield{width:100%;box-sizing:border-box;}
.hpf-settings-pane .hpf-colortile-labelled{padding:10px;gap:8px;align-content:start;}
.hpf-colortile-heading{min-height:38px;font-size:12px;font-weight:600;line-height:22px;color:var(--primary-text-color);}
.hpf-label-tail hp-help{vertical-align:top;margin-inline-start:4px;}
.hpf-label-tail{white-space:nowrap;}
.hpf-settings-pane .hpf-inline-help{display:block;line-height:22px;}
.hpf-settings-pane .hpf-colortile-labelled > .hpf-colortile-swatch{min-height:34px;}
.hpf-settings-pane .hpf-colortile-labelled .hpf-colortile-meta{justify-content:flex-start;gap:4px;font-size:12px;}
.hpf-settings-pane .hpf-colortile-labelled .hpf-hex{font-size:12px;}
hp-dialog[settings-layout] .hpf-footer .hpf-status{margin:0 auto 0 0;font-size:11px;}
.hpf-footer .hpf-save-label{transform:none;align-self:center;}
.hpf-settings-pane .hpf-balanced{text-wrap:balance;}
.hpf-settings-pane .hpf-toggle-title hp-help{vertical-align:top;margin-inline-start:4px;}
.hpf-settings-mobile{display:none;}
.hpf-temperature-range{display:flex;gap:12px;align-items:start;margin-top:12px;}
.hpf-temperature-range > .hpf-field{display:flex;flex:1;min-width:0;gap:8px;align-items:center;}
.hpf-temperature-range .hpf-unit{flex:0 1 96px;min-width:0;}
.hpf-temperature-range .hpf-label{flex:none;}
.hpf-plan-image{display:flex;align-items:center;gap:10px;min-height:148px;}
.hpf-plan-image:has(> .planname.muted){align-items:flex-end;}
hp-dialog[data-kind="space"] .hpf-callout:has([data-action="space-delete-devices"]){border-radius:0;}
hp-dialog[data-kind="space"] [data-action="space-delete-devices"]{display:flex;width:fit-content;max-width:100%;margin-top:12px;white-space:normal;}
.hpf-plan-image .planprev{width:210px;max-width:60%;height:124px;max-height:none;object-fit:contain;border:0;border-radius:0;padding:0;background:transparent;}
.hpf-plan-filename{min-width:0;overflow-wrap:anywhere;color:var(--hpf-muted);font-size:13px;}
.hpf-plan-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.hpf-plan-actions .fileupload{display:block;min-width:0;}
.hpf-inherited-swatch{display:inline-block;width:24px;height:24px;border:1px solid var(--hpf-line);border-radius:5px;}
.hpf-inherited-color{display:flex;align-items:center;gap:8px;color:var(--hpf-muted);font-size:12px;}
.hpf-room-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 14px;margin-top:10px;}
hp-dialog[settings-layout] .hpf-footer-object{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;column-gap:8px;row-gap:10px;padding:12px 16px;}
hp-dialog[settings-layout] .hpf-footer-object .hpf-status{grid-column:1 / -1;grid-row:1;}
hp-dialog[settings-layout] .hpf-footer-object .dialog-action-copy{grid-column:1;grid-row:2;}
hp-dialog[settings-layout] .hpf-footer-object .dialog-action-danger{grid-column:2;grid-row:2;margin:0;}
hp-dialog[settings-layout] .hpf-footer-object .dialog-action-commit{grid-column:4;grid-row:2;margin:0;}
.hpf-color-with-action{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:12px;}
.hpf-background-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px;margin-top:17px;}
.hpf-ray-examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;}
.hpf-ray-choice{position:relative;min-width:0;border-radius:8px;cursor:pointer;}
.hpf-ray-examples figure{margin:0;min-width:0;border:1px solid var(--hpf-line);border-radius:8px;overflow:hidden;}
.hpf-ray-examples figure.is-selected{border-color:var(--hpf-accent);}
.hpf-ray-choice:is(:hover,:focus-within){box-shadow:none;outline:none;}
.hpf-ray-choice:hover figure:not(.is-selected){border-color:color-mix(in srgb,var(--hpf-accent) 60%,var(--hpf-line));}
.hpf-ray-choice:focus-within figure{border-color:var(--hpf-accent);}
.hpf-ray-choice figure{transition:border-color 160ms ease;}
.hpf-ray-examples svg{display:block;width:100%;height:auto;}
.hpf-ray-examples figcaption{font-size:12px;text-align:center;padding:6px 6px 10px;}
.hpf-background-grid figure{margin:0;min-width:0;}
.hpf-background-stage{position:relative;border-radius:7px;height:100px;overflow:hidden;}
.hpf-background-stage svg{position:absolute;inset:12px 10%;width:80%;height:76px;}
.hpf-mini-floor{fill:color-mix(in srgb,var(--hpf-surface) 72%,transparent);stroke:var(--secondary-text-color);stroke-width:2;}
.hpf-mini-wall{fill:none;stroke:var(--secondary-text-color);stroke-width:2;}
.hpf-background-grid figcaption{margin-top:5px;color:var(--primary-text-color);font-size:12px;font-weight:600;}
.hpf-background-rules{margin-top:14px;}
.hpf-background-rules .hpf-hint{margin:0 0 7px;}
.hpf-settings-pane [data-card=data] .hpf-actions{gap:10px;}
.hpf-converter .hpf-link{display:inline-block;margin-bottom:7px;}
.hpf-north-control{display:grid;grid-template-columns:148px minmax(0,1fr);align-items:center;gap:18px;}
.hpf-north-dial{width:148px;height:148px;min-width:0;border:0;padding:0;border-radius:50%;background:transparent;color:var(--primary-text-color);cursor:pointer;touch-action:none;}
.hpf-north-dial svg{width:100%;height:100%;font-size:10px;}
.hpf-north-dial.hpf-unset{opacity:.45;}
.hpf-north-values{display:grid;gap:18px;min-width:0;}
.hpf-north-values .hpf-hint{margin:0;font-size:12px;}
.hpf-north-values input[type=range]{width:100%;min-width:0;accent-color:var(--hpf-accent);}
.hpf-settings-single{grid-template-columns:minmax(0,1fr);}
.hpf-settings-single .hpf-settings-content{border:0;}
.hpf-settings-single .hpf-card + .hpf-card{margin-top:18px;padding-top:18px;}
.hpf-temperature-range.hpf-range-compact{max-width:340px;gap:32px;}
.hpf-settings-pane .hpf-temprange{min-width:0;grid-template-columns:minmax(0,1fr);}
hp-dialog[data-kind=room][settings-layout] .hpf-grid{grid-template-columns:minmax(0,1fr);}
.hpf-settings-form .cardpreview{border:0;width:100%;margin:0;color:var(--hpf-accent);}
.hpf-settings-form .cardpreview .cpmeta > span{display:inline-flex;align-items:center;gap:.2em;white-space:nowrap;}
.hpf-settings-form .iconbtn{width:44px;height:44px;min-width:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:50%;color:inherit;background:transparent;transition:background 160ms;}
.hpf-settings-form .iconbtn:hover{background:var(--hpf-tint);}
.hpf-settings-form .hpf-seg:has(input[name=bmode]){grid-template-columns:repeat(2,minmax(0,1fr));}
.hpf-settings-form .hpf-seg:has(input[name=bmode]) label{min-width:0;white-space:nowrap;font-size:12px;}
.hpf-settings-form .led-representation > .row{justify-content:flex-start;border:0;padding:0;}
.hpf-settings-form .hpf-toolbar{flex-wrap:wrap;}
.hpf-settings-form .hpf-toolbar > .hpf-callout{flex-basis:100%;}
.hpf-settings-pane[data-settings-section=details] .hpf-field > .hpf-hint{margin-top:12px;}
.hpf-settings-pane [data-state-source]{display:grid;gap:18px;}
.hpf-settings-pane .radargroup{border:0;margin:0;padding:0;min-width:0;display:block;}
.hpf-settings-pane .radarsetup-head{height:112px;align-items:start;}
.hpf-settings-pane .radarsetup-head strong{max-height:112px;overflow:auto;}
.hpf-settings-pane[data-settings-section=details] .hpf-grid{grid-template-columns:minmax(0,1fr);align-items:start;}
.hpf-settings-pane .radargroup > legend{padding:0 0 18px;margin:0 0 18px;border-bottom:1px solid var(--hpf-line);width:100%;box-sizing:border-box;}
.hpf-settings-pane .hpf-profile-target-heading{display:grid;align-items:center;gap:12px;justify-content:start;}
.hpf-settings-pane .hpf-profile-maproutes > .vacroutes{margin-top:12px;}
.hpf-settings-pane .hpf-profile-diagnostics .vacdiag > div{padding:6px 0;}
.hpf-settings-pane .radarcoordinates{display:flex;flex-wrap:wrap;gap:12px;}
.hpf-settings-pane .radarcoordinates > label{flex:1;min-width:72px;}
.hpf-settings-pane .radarcoordinates input{width:100%;box-sizing:border-box;}
.hpf-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);}
@media(max-width:550px){
.hpf-settings-layout{grid-template-columns:minmax(0,1fr);}
.hpf-settings-nav{display:none;}
.hpf-settings-mobile{display:block;position:sticky;top:0;z-index:2;padding:10px 14px;border-bottom:1px solid var(--hpf-line);background:var(--hpf-surface);}
.hpf-settings-content{border:0;padding:18px 14px;}
.hpf-room-metrics{grid-template-columns:minmax(0,1fr);gap:20px;}
hp-dialog[settings-layout] .hpf-footer-object{grid-template-columns:auto auto minmax(0,1fr);padding:12px 14px;}
hp-dialog[settings-layout] .hpf-footer-object .dialog-action-commit{grid-column:1 / -1;grid-row:3;justify-content:flex-end;}
.hpf-settings-pane .hpf-colortiles{grid-template-columns:repeat(2,minmax(0,1fr));}
.hpf-north-control{grid-template-columns:112px minmax(0,1fr);gap:12px;}
.hpf-north-dial{width:112px;height:112px;}
}
@media(prefers-reduced-motion:reduce){
hp-dialog[settings-layout]{--hp-dialog-close-transition:none;--hp-dialog-close-hover-transform:none;}
.hpf-settings-form *{transition:none!important;animation:none!important;}
}
${settingsInteractiveCss('hp-dialog.ui-dialog *:is(summary:not(.hpf-disclosure > summary))')}

hp-dialog.ui-dialog.decor-properties-dialog{--hp-dialog-icon-size:28px;}
hp-dialog.ui-dialog.rules-dialog{--hp-dialog-wide-width:860px;}
hp-dialog.ui-dialog.device-inbox-dialog{--hp-dialog-wide-width:920px;}
hp-dialog.decor-properties-dialog .body.hpf-form{display:flex;flex-direction:column;gap:0;padding:20px;background:var(--hpf-surface);font-size:13px;line-height:normal;--hpf-control-surface:var(--hpf-surface);}
hp-dialog.decor-properties-dialog .body > label:not(.dfill):not(.hpf-toggle){margin:18px 0 8px;color:var(--primary-text-color);font-size:13px;font-weight:600;line-height:20px;}
hp-dialog.decor-properties-dialog .body.hpf-form > label:first-child{margin-top:0;}
hp-dialog.decor-properties-dialog .colorrow{display:flex;align-items:center;gap:8px;}
hp-dialog.decor-properties-dialog .colorrow > input{flex:1;width:0;}
hp-dialog.decor-properties-dialog .colorrow > span{flex:none;color:var(--secondary-text-color);}
hp-dialog.decor-properties-dialog hp-settings-select{font-size:14px;}
hp-dialog.decor-properties-dialog hp-color-opacity{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0 0;min-height:44px;font-size:13px;color:var(--primary-text-color);--hp-color-label-size:13px;--hp-color-label-color:var(--primary-text-color);--hp-color-label-weight:600;--hp-color-label-line-height:20px;--hp-color-readout-color:var(--secondary-text-color);--hp-color-readout-line-height:20px;}
hp-dialog.decor-properties-dialog .row[slot=footer]{justify-content:flex-end;gap:8px;}
hp-dialog.decor-properties-dialog .row[slot=footer] .spacer{display:none;}
hp-dialog.ui-dialog .device-inbox{gap:18px;}
hp-dialog.ui-dialog .device-inbox-row{gap:12px;}
hp-dialog.ui-dialog *:is(.device-inbox-actions,.device-inbox-batch-actions){gap:10px;}
hp-dialog.ui-dialog .device-inbox-tabs{gap:8px;padding:2px;margin:-2px;}

hp-dialog.ui-dialog .rtest{gap:10px;margin-bottom:18px;flex-wrap:wrap;}
hp-dialog.ui-dialog .rtest .namein{flex:1 1 280px;}
hp-dialog.ui-dialog .rrow{display:grid;grid-template-columns:minmax(150px,2fr) minmax(140px,1.4fr) 24px repeat(3,44px);gap:8px;}

hp-dialog.ui-dialog .rrow:last-of-type{margin-bottom:18px;}
hp-dialog.ui-dialog .supportbody{display:grid;gap:0;}
hp-dialog.ui-dialog .supportsection{gap:12px;}
hp-dialog.ui-dialog .supportsection + .supportsection{margin-top:18px;padding-top:18px;}
hp-dialog.ui-dialog .supportsection h3{margin:0 0 6px;}

hp-dialog.ui-dialog .aboutver{margin:0;}
hp-dialog.ui-dialog *:is(.supportlinks,.supportactions){gap:10px;}

hp-dialog.ui-dialog .supportform > label:not(.srcrow){margin:6px 0 -4px;}

hp-dialog.ui-dialog .supportattach{align-items:flex-start;margin:6px 0 0!important;}
hp-dialog.ui-dialog .supportattach input{margin:2px 0;}

hp-dialog.ui-dialog *:is(.supportwarning,.supportstatus,.supportupdate){margin:6px 0 0;}
hp-dialog.ui-dialog .supportupdate{margin-top:18px;}

@media(max-width:680px){
hp-dialog.ui-dialog .rrow{grid-template-columns:minmax(0,1fr) repeat(3,44px);}
hp-dialog.ui-dialog .rrow *:is(.rpat,.ricon){grid-column:1 / -1;}
hp-dialog.ui-dialog.rules-dialog .row[slot=footer] > button:first-child{margin-inline-end:auto;}
hp-dialog.ui-dialog .supportlinks{align-items:stretch;flex-direction:column;}
}
@media(prefers-reduced-motion:reduce){hp-dialog.ui-dialog *:is(button,summary,input,textarea,a){transition:none;}}

${readingGlyphCss('hp-dialog.ui-dialog .rprev', 'preview', 'primary')}
${readingGlyphCss('hp-dialog.ui-dialog .device-inbox-icon', 'avatar', 'primary')}
${readingTextCss('.supportsummary', 'form-label', 'primary')}
${readingTextCss('.backupplanonly small')}
${readingSeparatorCss('hp-dialog.ui-dialog .supportsection + .supportsection')}
${readingTextCss('hp-dialog.ui-dialog .supportform > label:not(.srcrow),.backupchoices legend', 'form-label', 'primary')}
${readingTextCss('.aboutver,.supporthash,.backupcounts,.backupfile span,.backupsummary span,.backupcontent span,.backupdetails code,.device-inbox-meta,.device-inbox-reason,.device-inbox-copy code,.device-inbox-selected')}
${readingTextCss('.supporthash code', 'caption', 'primary')}
${readingTextCss('.device-inbox-status', 'caption', 'error')}
${checkLabelsCss(CARD_DIALOG_FORM_KIT, '.device-inbox-filters label,.device-inbox-select-all,.device-inbox-select', 'wrap')}
${formKitTextareaCss('hp-dialog.ui-dialog textarea.supportmessage', 'message')}
${formKitTextareaCss('hp-dialog.ui-dialog textarea.supportraw', 'data')}
${settingsActionsCss('hp-dialog.ui-dialog a.aboutlink')}
${settingsTextLinkCss('hp-dialog.ui-dialog a.aboutlink', 'var(--hpf-accent)')}
${settingsInlineLinkCss('hp-dialog.ui-dialog .aboutver a.aboutlink')}
${settingsActionsCss('.hpf-settings-nav button', '[aria-current=page]', { variant: 'navigation' })}
${settingsActionsCss('hp-dialog.ui-dialog .device-inbox-tabs button', '[aria-selected=true]', { variant: 'choice' })}
${settingsActionsCss('hp-dialog.ui-dialog .device-inbox-chips .chip button')}
${vacuumSettingsCss}
${externalScreensCss}
`;
