/** External-screen composition only; shared form/actions/reading kit own paint. */
export const externalScreensCss = `
.hp-screen-intro{margin:0 0 18px!important;}
.hp-screen-list{display:grid;gap:12px;margin-bottom:16px;}
.hp-screen-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:6px 12px;}
.hp-screen-link{grid-column:1/-1;display:flex;align-items:center;gap:8px;}
.hp-screen-link input{flex:1;min-width:0;}
.hp-screen-fields{align-items:start;gap:20px 24px;}
.hp-screen-note{margin:24px 0 0!important;}
.hp-screen-row .hpf-error{grid-column:1/-1;}
@media(max-width:550px){.hp-screen-fields{grid-template-columns:1fr;}}
`;
