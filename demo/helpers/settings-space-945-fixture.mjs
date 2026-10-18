/** Approved Space v7 data. Legacy openings intentionally disagree with borders. */
export const SPACE_945_PLAN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="145" viewBox="0 0 240 145"><rect x="4" y="4" width="232" height="137" fill="#e7edef" stroke="#71828a" stroke-width="5"/><g fill="#d8e5e7" stroke="#899ba2" stroke-width="2"><path d="M16 16H130V79H16Z"/><path d="M137 16H224V79H137Z"/><path d="M16 86H130V129H16Z"/><path d="M137 86H224V129H137Z"/></g><g font-family="Arial,sans-serif" font-size="11" fill="#4d626e" text-anchor="middle"><text x="73" y="51">Гостиная</text><text x="181" y="51">Кухня</text><text x="73" y="111">Холл</text><text x="181" y="111">Ванная</text></g></svg>';

export async function installSettingsSpaceFixture(page) {
  await page.route('**/floor01.svg', route => route.fulfill({contentType:'image/svg+xml',body:SPACE_945_PLAN_SVG}));
  await page.evaluate(async () => {
    const card=window.__card;
    card.setConfig({...card._config,language:'ru'});
    await window.__hpTest.setServerConfig(config => {
      config.settings={...config.settings,bg_mode:'static',bg_color:'#17212B',north_deg:32,sun_rays:true,glow_radius_cm:350,show_device_battery:'low',show_lqi:false};
      const space=config.spaces.find(item=>item.id==='f1');
      space.title='1 этаж · жилой';space.plan_url='/floor01.svg';space.cell_cm=5;space.zero_wall_style='dashed';
      space.settings={show_borders:true,hide_openings:true,hide_decor:false,show_names:true,room_color:'#66788A',room_opacity:.7,fill_mode:'temp',custom_fill:{c:'#D6B98C',a:.18},temp_min:20,temp_max:24,glow_enabled:true,card_font_scale:1.25,card_name_scale:1.25,card_label_scale:1.25,label_temp:true,label_hum:true,label_co2:true,label_lqi:true,label_light:true};
      const upstairs=config.spaces.find(item=>item.id!=='f1');
      upstairs.title='2 этаж';upstairs.settings={...upstairs.settings,show_lqi_mode:'on',show_lqi:true,show_device_battery_mode:'all'};
    });
    await window.__hpTest.waitForWrites();
  });
}
