import { commitWallSegmentModel } from '../../test-build/wall-segment-model.js';
import { makeVisualMatrixFixture } from './visual-matrix.mjs';

const rect=(id,x,y,w,h,enabled=false)=>({id,name:id,area:null,
  poly:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>[.5+a*.004,.3+b*.004]),
  settings:enabled?{sun_transparent:true}: {}});

/** The independently specified AC7 chain, materialized through the actual wall model. */
export function sunTransparentConfig(sealed=false) {
  const rooms=[rect('R',0,0,100,100),rect('T2',-40,0,40,100,true),rect('T1',-80,0,40,100,true),
    rect('N',-80,-40,180,40),rect('S',-80,100,180,40)];
  if(sealed)rooms.push(rect('W0',-120,0,40,100));
  const cfg=commitWallSegmentModel({model_version:7,spaces:[{id:'f1',title:'Sunlight chain',
    rooms,view_box:[0,0,1,1],cell_cm:5,settings:{fill_mode:'none',show_borders:true}}],markers:[],
    settings:{sun_rays:true,north_deg:0,bg_mode:'static'}}).config;
  const sp=cfg.spaces[0];
  for(const wall of sp.wall_segments)wall.cm=15;
  const wall=sp.wall_segments.find(w=>w.a[0]===.5&&w.b[0]===.5&&Math.min(w.a[1],w.b[1])<.5&&Math.max(w.a[1],w.b[1])>.5);
  if(!wall)throw Error('Canonical receiver window carrier missing');
  sp.openings=[{id:'W',type:'window',x:.5,y:.5,angle:90,length:.12,host:{kind:'wall',id:wall.id,t:.5}}];
  cfg.spaces.push({id:'f2',title:'Other floor',rooms:[],view_box:[0,0,1,1]});
  return commitWallSegmentModel(cfg).config;
}

export function makeSunTransparentFixture({sealed=false}={}) {
  const sample=makeVisualMatrixFixture();
  sample.config=sunTransparentConfig(sealed);
  sample.devices={};sample.entities={};sample.areas={};sample.layout={};
  sample.states={'sun.sun':{entity_id:'sun.sun',state:'above_horizon',
    attributes:{azimuth:270,elevation:30,rising:false}}};
  return sample;
}
