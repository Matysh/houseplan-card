import { fixtureWallKey } from './wall-key.mjs';

export function makeDirectPerspectiveFixture() {
  const poly = [[.22,.22],[.78,.22],[.78,.78],[.22,.78]];
  const walls = poly.map((a, i) => {
    const b = poly[(i+1) % poly.length];
    return {key:fixtureWallKey(a,b),a,b,cm:16};
  });
  const room = {
    id:'straight-perspective', title:'Square room', cell_cm:5, view_box:[0,0,1,1],
    settings:{show_names:false,show_borders:true,fill_mode:'none',sun_rays:false,wall_fill:{c:'#9eaab3',a:1}},
    rooms:[{id:'living',name:'Living room',poly}], walls,
    openings:[{id:'window',type:'window',x:.5,y:.22,angle:0,length:.21}],
    decor:[
      {id:'sofa',kind:'furniture',symbol:'sofa',x:.313,y:.345,w:.225,h:.095},
      {id:'table',kind:'furniture',symbol:'coffee_table',x:.362,y:.507,w:.14,h:.082},
      {id:'chair',kind:'furniture',symbol:'chair',x:.587,y:.544,w:.088,h:.085,angle:-25},
    ],
  };
  return {
    config:{spaces:[room],markers:[],settings:{filter_seeded:true}},
    layout:{},devices:{},entities:{},states:{},areas:{},
  };
}

