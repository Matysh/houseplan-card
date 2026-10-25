import {readFileSync} from 'node:fs';
import {openVacuumHistory,chooseVacuumHistory,HISTORY_IDS} from '../helpers/vacuum-history.mjs';
const producer=JSON.parse(readFileSync(new URL('../../test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json',import.meta.url),'utf8'));
export function makeVacuumHistoryFixture(kind){
 const space='golden-history-space',id='golden-history';
 const route={id:'history-route',source:'camera.golden_history',map_id:'floor',space,calibration:[.1,0,100,0,.1,100]};
 const records=kind==='dst'?[{id:HISTORY_IDS.a,timestamp:Date.parse('2026-10-25T00:30:00Z')/1000},
   {id:HISTORY_IDS.b,timestamp:Date.parse('2026-10-25T01:30:00Z')/1000}]:[
   {id:HISTORY_IDS.a,timestamp:kind==='seconds'?Date.parse('2026-10-24T14:25:10Z')/1000:1792800000},
   {id:HISTORY_IDS.b,timestamp:kind==='seconds'?Date.parse('2026-10-24T14:25:40Z')/1000:1792796400}];
 const catalog={version:1,records,revision:'f'.repeat(64),epoch:'c'.repeat(32),limited:false};
 const paths=producer.payload.path.map(chunk=>Array.from({length:(chunk.length-1)/2},(_,i)=>[chunk[i*2+1],chunk[i*2+2]]));
 const fixture={config:{model_version:7,spaces:[{id:space,title:'History reference',cell_cm:5,plan_url:null,
   view_box:[0,0,1,1],rooms:[{id:'history-room',name:'',area:'history-area',poly:[[0,0],[1,0],[1,1],[0,1]]}],
   walls:[],wall_segments:[],partitions:[],openings:[],wall_columns:[],decor:[],led_strips:[],
   settings:{fill_mode:'none',show_names:false,show_borders:false,glow_enabled:false}}],markers:[{
    id,binding:`device:${id}`,name:'History robot',space,icon:'mdi:robot-vacuum',vacuum:{source:route.source,trail_mode:'always',map_routes:[route]}}],
   settings:{bg_mode:'static',sun_rays:false,marker_area_snapshot:{}}},
  devices:{[id]:{id,name:'History robot',model:'Synthetic Dreame',area_id:'history-area',identifiers:[['dreame_vacuum',id]],config_entries:['history-entry'],disabled_by:null}},
  areas:{'history-area':{area_id:'history-area',name:'History reference'}},entities:{},states:{},layout:{[id]:{s:space,x:.1,y:.1}},historyCatalog:catalog,
  historyMaterial:{version:1,revision:catalog.revision,epoch:catalog.epoch,route,paths,completed:true,vacuum:'vacuum.golden_history'},
  historyTrails:{[id]:{current:{map_id:'floor',route_id:route.id,path_format:2,paths:[[[100,100],[700,600]]],quality:{source:'native',reason:'ok'},revision:'live'}}}};
 for(const entity of ['vacuum.golden_history','camera.golden_history']){
  fixture.entities[entity]={entity_id:entity,device_id:id,platform:'dreame_vacuum',config_entry_id:'history-entry',disabled_by:null,area_id:null};
  fixture.states[entity]={entity_id:entity,state:entity.startsWith('vacuum.')?'cleaning':'idle',attributes:entity.startsWith('camera.')?{map_name:'floor',robot_position:{x:600,y:400}}:{}};
 }
 return fixture;
}
export async function prepareVacuumHistoryGolden(page,scenario){
 await page.evaluate(()=>{window.__card=window.__goldenCard;});
 const ui=await openVacuumHistory(page,'golden-history');
 await chooseVacuumHistory(page,ui.history,HISTORY_IDS.a);await ui.show.click();
 await page.waitForFunction(()=>window.__goldenCard._vacHistory.visible);
 await ui.history.scrollIntoViewIfNeeded();
 if(scenario.vacuumHistory==='seconds'||scenario.vacuumHistory==='dst'){
  await ui.history.locator('hp-settings-select button').click();
  const labels=await ui.history.locator('[role=option] span').allTextContents();
  const expected=scenario.vacuumHistory==='seconds'?['24.10.2026 · 17:25:40','24.10.2026 · 17:25:10']
    :['25.10.2026 · 02:30:00 · UTC+01:00','25.10.2026 · 02:30:00 · UTC+02:00'];
  if(!expected.every(label=>labels.includes(label)))throw Error(`history collision labels differ: ${JSON.stringify(labels)}`);
 }
 return {shown:true,local:true,kind:scenario.vacuumHistory};
}
