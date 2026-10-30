import { mdiMonitor, mdiMonitorDashboard } from '@mdi/js';
/** Synthetic visual scenes exercise the product's native settings and kiosk consumers. */
export function addExternalScreenFixture(fixture, scenario) {
  const empty = scenario.externalScreens === 'empty';
  const profile = { id:1, space:scenario.space, rotation:scenario.screenRotation || 0,
    cycle:0,idle:0,summary:scenario.screenSummary?'show':'local',hidden_devices:'local',
    icon_scale:null,font_scale:null,controls:scenario.screenControls!==false };
  fixture.config.settings ||= {};
  fixture.config.settings.external_screens={version:1,next_id:empty?1:2,screens:empty?[]:[profile]};
  if(scenario.screenSummary)fixture.config.settings.summary_panel={version:1,title:'Дом',show_on_mobile:true,
    blocks:[{id:'screen-state',title:'Сейчас',visible:true,scope:{type:'all'},values:[
      {id:'screen-devices',label:'Устройства',source:{type:'system',key:'device_count'}}]}]};
}
export async function prepareExternalScreens(page, scenario) {
  await page.evaluate(({mdiMonitor,mdiMonitorDashboard})=>{Object.assign(window.__ICONS,{"mdi:monitor":mdiMonitor,"mdi:monitor-dashboard":mdiMonitorDashboard});},{mdiMonitor,mdiMonitorDashboard});
  await page.evaluate(async scenario=>{
    const card=window.__goldenCard||window.__card;
    const wait=async(probe,label)=>{const end=performance.now()+10000;while(performance.now()<end){if(probe())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('external-screen golden: '+label);};
    const root=card.renderRoot;
    if(scenario.panelKioskUrl){
      await wait(()=>card._kiosk&&card.routeKiosk.profile===1,'profile kiosk');
      if(card._rotation!==(scenario.screenRotation||0))throw Error('external-screen golden rotation not applied');
      if(scenario.screenSummary)await wait(()=>root.querySelector('.summary-overlay')?.getClientRects().length,'summary painted');
      if(root.querySelector('[data-hp="summary-settings"],[data-hp="summary-toggle"]'))throw Error('external-screen golden controls remain');
      return;
    }
    root.querySelector('[data-hp="settings"]').click();
    await wait(()=>root.querySelector('hp-dialog[data-kind="settings"]'),'General settings');
    const dialog=root.querySelector('hp-dialog[data-kind="settings"]');
    dialog.querySelector('[data-section-target="external-screens"]').click();await card.updateComplete;
    if(scenario.externalScreens==='constructor'){
      dialog.querySelector('[data-hp="external-screen-add"]').click();
      await wait(()=>root.querySelector('hp-dialog[data-kind="external-screen-constructor"]'),'constructor');
      const child=root.querySelector('hp-dialog[data-kind="external-screen-constructor"]');
      if(child.querySelector('.hpf-card')||child.querySelectorAll('select').length!==8
        ||child.querySelector('[data-field="external-screen-controls"]'))throw Error('external-screen constructor structure');
      const icon=child.renderRoot.querySelector('ha-icon[icon="mdi:monitor"]');
      if(!icon?.shadowRoot?.querySelector('path')?.getAttribute('d'))throw Error('external-screen monitor icon absent in the HA fixture');
    }else if(!dialog.querySelector(scenario.externalScreens==='empty'?'[data-hp="external-screen-create"]':'[data-hp="external-screen-edit"]'))throw Error('external-screen section state missing');
    await card.updateComplete;
  },scenario);
}
