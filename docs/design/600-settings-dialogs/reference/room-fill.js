/* House Plan roomFillStyle + Glow fallback, adapted for this isolated demo.
   Source: c22c04d6476d0d387c237b427d0b83e7c1e11f70, src/logic.ts and
   src/space-render.ts. See ROOM-FILL.md for palette and data limitations. */
export const DEFAULT_CUSTOM_FILL = {c:'#607d8b', a:.18};
export const DEFAULT_FILL_COLORS = {
  light_on:{c:'#ffd45c',a:.18}, light_off:{c:'#9aa0a6',a:.14},
  light_none:{c:'#6b7480',a:0},
  temp_cold:{c:'#4fc3f7',a:.18}, temp_ok:{c:'#66d17a',a:.18},
  temp_hot:{c:'#ffd45c',a:.18},
  lqi_low:{c:'#f25a4a',a:.18}, lqi_high:{c:'#4bd28f',a:.18},
  glow_base:{c:'#0d1b2a',a:.5},
};
const clamp = value => Math.min(1,Math.max(0,value));
function mixColor(a,b,t) {
  return '#' + [1,3,5].map(i=>{
    const start=parseInt(a.slice(i,i+2),16),end=parseInt(b.slice(i,i+2),16);
    return Math.round(start+(end-start)*t).toString(16).padStart(2,'0');
  }).join('');
}
export function roomFillStyle({mode,lqi,lights,temp,min,max,custom=DEFAULT_CUSTOM_FILL},colors=DEFAULT_FILL_COLORS) {
  if(mode==='custom')return custom;
  if(mode==='lqi') {
    if(lqi==null)return null;
    const t=clamp((lqi-40)/140);
    return {c:mixColor(colors.lqi_low.c,colors.lqi_high.c,t),a:colors.lqi_low.a+(colors.lqi_high.a-colors.lqi_low.a)*t};
  }
  if(mode==='light')return lights==='none' ? (colors.light_none.a>0?colors.light_none:null) : colors[lights==='on'?'light_on':'light_off'];
  if(mode==='temp') {
    if(temp==null)return null;
    return colors[temp<Math.min(min,max)?'temp_cold':temp>Math.max(min,max)?'temp_hot':'temp_ok'];
  }
  return null;
}
export function previewFill(settings,data,colors=DEFAULT_FILL_COLORS) {
  const fill=roomFillStyle({mode:settings.fillMode,lqi:data.lqi,lights:data.totalLights===0?'none':data.onLights>0?'on':'off',temp:data.temp,min:settings.tempMin,max:settings.tempMax,
    custom:settings.customFillSet?{c:settings.fillColor,a:clamp(Number(settings.fillOpacity)/100)}:DEFAULT_CUSTOM_FILL},colors);
  return {fill,glowBase:settings.glowEnabled&&(!fill||fill.a<=0)?colors.glow_base:null};
}
const typical={temp:22.4,humidity:45,lqi:92,onLights:1,totalLights:3};
export const SAMPLE_SCENARIOS = {
  typical:{label:'Typical room',...typical},
  off:{label:'Lights off',...typical,onLights:0},
  cold:{label:'Cold room',...typical,temp:16},
  hot:{label:'Hot room',...typical,temp:30},
  low:{label:'Weak Zigbee',...typical,lqi:30},
  high:{label:'Strong Zigbee',...typical,lqi:200},
  empty:{label:'No room data',temp:null,humidity:null,lqi:null,onLights:0,totalLights:0},
};
