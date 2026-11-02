/** External-screen composition only; shared form/actions/reading kit own paint. */
export const externalScreensCss = `
.hp-screen-intro{margin:0 0 18px!important;}
.hp-screen-list{display:grid;gap:12px;margin-bottom:16px;}
.hp-screen-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:6px 12px;}
.hp-screen-link{grid-column:1/-1;display:flex;align-items:center;gap:8px;}
.hp-screen-link input{flex:1;min-width:0;}
.hp-screen-constructor{padding:var(--sp-6)!important;box-sizing:border-box;}
.hp-screen-fields,.hp-screen-general{align-items:start;gap:20px 24px;}
.hp-screen-fields,.hp-screen-general{grid-template-columns:repeat(2,minmax(0,1fr));}
.hp-screen-general > :last-child{grid-column:1/-1;}
.hp-screen-constructor .hpf-section{display:block;}
.hp-screen-space-hint{margin:var(--sp-5) 0 var(--sp-6)!important;}
.hp-screen-zoom{display:flex;align-items:center;gap:var(--sp-4);}
.hp-screen-zoom .hpf-unit{flex:1;min-width:0;}
.hp-screen-zoom button{flex:none;}
.hp-screen-center{min-height:44px;}
.hp-screen-single-return{margin-top:var(--sp-6);}
.hp-screen-note{margin:24px 0 0!important;}
.hp-screen-row .hpf-error{grid-column:1/-1;}
`;
