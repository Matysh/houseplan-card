// #1003: composition alone switches the real SVG stroke, no synthetic values.
import {launch,checkAll,finish} from './serve.mjs';
const {page,browser}=await launch({width:1200,height:900});
try{
  await page.evaluate(async()=>{
    const c=window.__card,space=c._space;
    c.hass={...c.hass,entities:{...c.hass.entities,
      'sensor.stroke_a':{entity_id:'sensor.stroke_a'},'sensor.stroke_b':{entity_id:'sensor.stroke_b'}},
      states:{...c.hass.states,'sensor.stroke_a':{entity_id:'sensor.stroke_a',state:'off',attributes:{}},
        'sensor.stroke_b':{entity_id:'sensor.stroke_b',state:'off',attributes:{}}}};
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.settings={...cfg.settings,filter_seeded:true,volumetric_view:false};
      cfg.spaces=[{id:space,title:'Composition',cell_cm:5,view_box:[0,0,1,1],rooms:[],walls:[],wall_segments:[],
        partitions:[],openings:[],settings:{show_names:false,show_borders:false}}];
      cfg.markers=['a','b'].map(id=>({id:'lg_sensor.stroke_'+id,binding:'virtual',space,
        icon:'mdi:lightbulb',display:'static_icon',value_badge:{enabled:false}}));return cfg;
    });
    await window.__hpTest.setLayout({'lg_sensor.stroke_a':{s:space,x:.4,y:.4},'lg_sensor.stroke_b':{s:space,x:.4,y:.6}});
  });
  await page.waitForFunction(()=>window.__card._deviceContacts?.scene?.shapes.has('lg_sensor.stroke_a'));
  await page.evaluate(async()=>{
    const c=window.__card,m=c._deviceContacts.scene.shapes.get('lg_sensor.stroke_a').marker;
    await window.__hpTest.setLayout(l=>({...l,'lg_sensor.stroke_b':{...l['lg_sensor.stroke_b'],y:(m.y+m.diameter*1.125)/1000}}));
  });
  for(const kind of ['virtual','mixed','physical','mixed','virtual']){
    await page.evaluate(async kind=>{
      await window.__hpTest.setServerConfig(cfg=>{
        cfg.markers=cfg.markers.map((m,i)=>({...m,binding:kind==='physical'||kind==='mixed'&&i===0
          ?'entity:sensor.stroke_'+(i?'b':'a'):'virtual'}));return cfg;
      });
      await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },kind);
    const proof=await page.evaluate(()=>{
      const c=window.__card,path=c.renderRoot.querySelector('.device-contact-contour.grouped');
      return {members:c._deviceContacts.scene.component('lg_sensor.stroke_a'),dash:path?.getAttribute('stroke-dasharray')};
    });
    checkAll({[kind+':same-two-member-group']:proof.members.length===2,
      [kind+':correct-painted-stroke']:proof.dash===(kind==='virtual'?'4 3':'none')});
  }
}finally{await finish(browser);}
