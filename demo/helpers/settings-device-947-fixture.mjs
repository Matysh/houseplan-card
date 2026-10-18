/** Synthetic values from the approved device v6 comparison; no live installation. */
export async function installSettingsDeviceFixture(page) {
  await page.evaluate(async () => {
    const c=window.__card;
    c.setConfig({...c._config,language:'ru'});
    const device=(id,name,model)=>window.__addRegistryDevice(id,name,model,'living_room');
    const entity=(id,owner,state,attributes={},platform='esphome')=>window.__addRegistryEntity(id,'living_room',state,platform,{device_id:owner},attributes);
    device('demo_led_controller','Подсветка карниза','Двухканальный LED-контроллер');
    device('demo_ceiling','Потолочная лампа','Light');device('demo_floor_lamp','Торшер','Light');
    entity('light.living_cornice','demo_led_controller','on',{friendly_name:'Карниз',brightness:184,supported_color_modes:['brightness'],color_mode:'brightness'});
    entity('light.living_accent','demo_led_controller','off',{friendly_name:'Акцент',brightness:128,supported_color_modes:['brightness']});
    entity('light.living_ceiling','demo_ceiling','off',{friendly_name:'Потолочная лампа',supported_color_modes:['onoff']});
    entity('light.demo_living_ceiling','demo_ceiling','on',{friendly_name:'Потолочная лампа',supported_color_modes:['onoff']});
    entity('light.demo_living_floor_lamp','demo_floor_lamp','off',{friendly_name:'Торшер',supported_color_modes:['onoff']});
    device('demo_living_climate','Климат гостиной','Термостат гостиной v2');
    entity('climate.living_room','demo_living_climate','heat',{friendly_name:'Термостат гостиной',current_temperature:22.2,temperature:23,hvac_action:'heating'},'generic_thermostat');
    entity('sensor.living_climate_humidity','demo_living_climate','44',{friendly_name:'Влажность',device_class:'humidity',unit_of_measurement:'%'});
    entity('sensor.living_climate_battery','demo_living_climate','34',{friendly_name:'Батарея',device_class:'battery',unit_of_measurement:'%'});
    device('demo_x50','Робот · первый этаж','Dreame X50 Ultra Complete');
    entity('vacuum.demo_x50','demo_x50','cleaning',{friendly_name:'Робот · первый этаж',battery_level:68,selected_map:'floor-1'},'dreame_vacuum');
    entity('sensor.demo_x50_battery','demo_x50','68',{friendly_name:'Заряд',device_class:'battery',unit_of_measurement:'%'},'dreame_vacuum');
    entity('sensor.demo_x50_cleaned_area','demo_x50','34',{friendly_name:'Убранная площадь',unit_of_measurement:'м²'},'dreame_vacuum');
    entity('camera.demo_x50_map','demo_x50','idle',{friendly_name:'Карта первого этажа',map_name:'floor-1',vacuum_position:{x:1200,y:1800},path:{path:[[[1000,1000],[1200,1800],[1500,1800]]]},rooms:{1:{name:'Гостиная',x:1200,y:1800},2:{name:'Кухня',x:2500,y:1200},3:{name:'Холл',x:2000,y:2200},4:{name:'Ванная',x:3000,y:2000},5:{name:'Кабинет',x:3500,y:1000}}},'dreame_vacuum');
    device('demo_radar','Радар · гостиная','HLK-LD2450');
    entity('binary_sensor.demo_radar_presence','demo_radar','on',{friendly_name:'Присутствие',device_class:'occupancy'});
    entity('binary_sensor.demo_radar_online','demo_radar','on',{friendly_name:'Радар доступен',device_class:'connectivity'});
    entity('sensor.demo_radar_target_count','demo_radar','2',{friendly_name:'Количество целей'});
    for(const [n,x,y] of [[1,1200,1800],[2,2400,2700]]){
      entity(`sensor.demo_radar_target_${n}_x`,'demo_radar',String(x),{unit_of_measurement:'mm'});
      entity(`sensor.demo_radar_target_${n}_y`,'demo_radar',String(y),{unit_of_measurement:'mm'});
      entity(`binary_sensor.demo_radar_target_${n}_present`,'demo_radar','on',{device_class:'occupancy'});
    }
    entity('script.demo_clean_living_floor',null,'off',{friendly_name:'Уборка гостиной'},'script');
    c.hass=window.__mkHass();
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setServerConfig(cfg=>{
      const source=cfg.spaces.find(s=>s.id==='f1');
      const living={...source.rooms[0],id:'living',name:'Гостиная',area:null};
      cfg.spaces.push({...structuredClone(source),id:'floor01',title:'1 этаж · жилой',rooms:[living],wall_segments:[],led_strips:[]});
      cfg.spaces.push({...structuredClone(source),id:'floor2',title:'2 этаж',rooms:[],wall_segments:[],led_strips:[]});
      const common={space:'floor01',area:null,room_id:'living',hide_battery:false,hide_signal:false};
      const pdf=(name)=>({name,url:`/local/houseplan/files/${name}`});
      cfg.markers.push(
        {...common,id:'demo_led_controller',binding:'device:demo_led_controller',name:'Подсветка карниза',icon:'mdi:led-strip-variant',display:'icon_ripple',ripple_color:'#59A9FF',ripple_size:2.5,size:1.3,angle:15,is_light:true,light_entity:'light.living_cornice',controls:['light.living_ceiling'],toggle_entity:'light.living_accent',tap_action:'toggle',tap_confirm:true,glow_color:{c:'#FFD9A0',bri:.65},value_badge:{enabled:true,source:{kind:'entity_attribute',entity_id:'light.living_cornice',attribute:'brightness'},position:'top'},model:'Двухканальный LED-контроллер',link:'https://example.org/demo/led-controller',description:'Карниз — канал 1; акцент — канал 2. Ведущий свет и переключаемый канал выбраны отдельно.',pdfs:[pdf('led-controller-guide.pdf')]},
        {...common,id:'demo_living_climate',binding:'device:demo_living_climate',name:'Климат гостиной',icon:'mdi:thermostat',display:'value',size:1.2,angle:0,use_climate_temp:true,value_source:{kind:'entity_state',entity_id:'sensor.living_climate_external_temperature_old'},value_badge:{enabled:true,source:{kind:'entity_state',entity_id:'sensor.living_climate_external_temperature_old'},position:'right'},model:'Термостат гостиной v2',link:'https://example.org/demo/thermostat',description:'Явный источник значения был удалён из HA. Текущая температура самого термостата продолжает участвовать в среднем комнаты.',pdfs:[pdf('thermostat-guide.pdf')]},
        {...common,id:'demo_x50',binding:'device:demo_x50',name:'Робот · первый этаж',icon:'mdi:robot-vacuum',display:'value',size:1.2,angle:0,tap_action:'run',tap_target:'script.demo_clean_living_floor',tap_confirm:true,value_source:{kind:'entity_state',entity_id:'sensor.demo_x50_battery'},value_badge:{enabled:true,source:{kind:'entity_state',entity_id:'sensor.demo_x50_cleaned_area'},position:'right'},vacuum:{source:'camera.demo_x50_map',live:true,trail_mode:'always',map_routes:[{id:'map-floor1',map_id:'floor-1',source:'camera.demo_x50_map',space:'floor01',calibration:[.0001,0,0,.0001,0,0]},{id:'map-floor2',map_id:'floor-2',source:'camera.demo_x50_map',space:'floor2'}]},model:'Dreame X50 Ultra Complete',link:'https://example.com/demo/vacuum-manual',description:'Док у входа в гостиную. Карты первого и второго этажей; запуск сценария уборки гостиной по нажатию.',pdfs:[pdf('x50-manual-demo.pdf'),pdf('maintenance-demo.pdf')]},
        {...common,id:'demo_radar',binding:'device:demo_radar',name:'Радар · гостиная',icon:'mdi:radar',display:'icon_ripple',ripple_color:'#06B6D4',ripple_size:2.5,size:1.1,angle:90,controls:['light.demo_living_ceiling','light.demo_living_floor_lamp'],tap_action:'toggle',tap_confirm:true,value_badge:{enabled:true,source:{kind:'entity_state',entity_id:'sensor.demo_radar_target_count'},position:'right'},radar:{version:1,enabled:true,show_live:true,profile:'cartesian_v1',room_id:'living',sources:{slots:[1,2].map(n=>({id:`target_${n}`,x_entity:`sensor.demo_radar_target_${n}_x`,y_entity:`sensor.demo_radar_target_${n}_y`,unit:'mm',swap_xy:false,x_sign:1,y_sign:1,presence_entity:`binary_sensor.demo_radar_target_${n}_present`})),occupancy_entity:'binary_sensor.demo_radar_presence',count_entity:'sensor.demo_radar_target_count',availability_entity:'binary_sensor.demo_radar_online'},mount:{installation_id:'device947',x:.12,y:.075,heading_deg:90,range_cm:600,fov_deg:120},calibration:{method:'manual',mirror:false,cell_cm:5}},model:'ESPHome · LD2450',link:'https://example.com/demo/radar-manual',description:'Установлен на стене у входа. Зона обзора — гостиная; свет управляется двумя внешними сущностями.',pdfs:[pdf('radar-installation-demo.pdf'),pdf('wiring-demo.pdf')]}
      );
    });
    await window.__hpTest.waitForWrites();await window.__hpTest.switchSpace('floor01');await window.__hpTest.setMode('devices');
  });
}
