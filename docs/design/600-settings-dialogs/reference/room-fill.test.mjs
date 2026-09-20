import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {roomFillStyle,previewFill,DEFAULT_FILL_COLORS as palette,DEFAULT_CUSTOM_FILL,SAMPLE_SCENARIOS} from './room-fill.js';

const input={mode:'temp',min:20,max:25,temp:22.4,lqi:92,lights:'on',custom:{c:'#ededed',a:1}};
for(const [temp,state] of [[19.9,'cold'],[20,'ok'],[22.4,'ok'],[25,'ok'],[25.1,'hot']]) {
  assert.deepEqual(roomFillStyle({...input,temp}),palette[`temp_${state}`]);
  assert.deepEqual(roomFillStyle({...input,temp,min:25,max:20}),palette[`temp_${state}`]);
}
assert.equal(roomFillStyle({...input,temp:null}),null);
assert.equal(roomFillStyle({...input,mode:'lqi',lqi:null}),null);
assert.deepEqual(roomFillStyle({...input,mode:'lqi',lqi:0}),palette.lqi_low);
assert.deepEqual(roomFillStyle({...input,mode:'lqi',lqi:255}),palette.lqi_high);
assert.deepEqual(roomFillStyle({...input,mode:'lqi',lqi:110}),{c:'#9f966d',a:.18});
for(const lights of ['on','off','none'])assert.deepEqual(roomFillStyle({...input,mode:'light',lights}),lights==='none'?null:palette[`light_${lights}`]);
const customPalette={...palette,light_off:{c:'#444444',a:.8},light_none:{c:'#dddddd',a:1},temp_cold:{c:'#aabbcc',a:.4}};
assert.deepEqual(roomFillStyle({...input,mode:'light',lights:'off'},customPalette),customPalette.light_off);
assert.deepEqual(roomFillStyle({...input,mode:'light',lights:'none'},customPalette),customPalette.light_none);
assert.deepEqual(roomFillStyle({...input,temp:16},customPalette),customPalette.temp_cold);
const settings={fillMode:'custom',customFillSet:true,fillColor:'#ededed',fillOpacity:100,tempMin:20,tempMax:25,glowEnabled:true};
for(const data of Object.values(SAMPLE_SCENARIOS))assert.deepEqual(previewFill(settings,data),{fill:{c:'#ededed',a:1},glowBase:null});
assert.deepEqual(previewFill({...settings,customFillSet:false},SAMPLE_SCENARIOS.typical).fill,DEFAULT_CUSTOM_FILL);
assert.deepEqual(previewFill({...settings,fillOpacity:0},SAMPLE_SCENARIOS.typical).glowBase,palette.glow_base);
for(const fillMode of ['temp','light','lqi']) {
  assert.deepEqual(previewFill({...settings,fillMode},SAMPLE_SCENARIOS.empty),{fill:null,glowBase:palette.glow_base});
  assert.deepEqual(previewFill({...settings,fillMode,glowEnabled:false},SAMPLE_SCENARIOS.empty),{fill:null,glowBase:null});
}
assert.deepEqual(previewFill({...settings,fillMode:'light'},SAMPLE_SCENARIOS.off),{fill:palette.light_off,glowBase:null});
assert.deepEqual(previewFill({...settings,fillMode:'light'},SAMPLE_SCENARIOS.typical),{fill:palette.light_on,glowBase:null});

// Optional parity audit against the actual, read-only House Plan source snapshot.
// Run: node room-fill.test.mjs ../houseplan-dev-source-review/src/logic.ts
if(process.argv[2]) {
  const source=readFileSync(process.argv[2],'utf8');
  const extract=name=>{
    const start=source.indexOf(`export function ${name}(`);
    const end=source.indexOf('\n}',start)+2;
    assert.ok(start>=0&&end>start,`Missing source function ${name}`);
    return source.slice(start,end).replace('export ','');
  };
  const paletteSource=source.slice(source.indexOf('export const DEFAULT_FILL_COLORS:'),source.indexOf('\n};',source.indexOf('export const DEFAULT_FILL_COLORS:'))+3).replace('export ','');
  const reference=runInNewContext(stripTypeScriptTypes(`${paletteSource}\nconst DEFAULT_CUSTOM_FILL={c:'#607d8b',a:.18}; const customFillOf=value=>value;\n${extract('lerpColor')}\n${extract('roomFillStyle')}\n({roomFillStyle,DEFAULT_FILL_COLORS});`));
  for(const [key,value] of Object.entries(palette))assert.deepEqual(value,JSON.parse(JSON.stringify(reference.DEFAULT_FILL_COLORS[key])));
  let count=0;
  for(const mode of ['custom','temp','light','lqi'])for(const lqi of [null,0,40,92,110,180,255])for(const lights of ['none','off','on'])for(const temp of [null,16,20,22.4,25,30])for(const colors of [palette,customPalette]) {
    const args={...input,mode,lqi,lights,temp};
    const expected=reference.roomFillStyle(mode,lqi,lights,temp,input.min,input.max,colors,input.custom);
    assert.deepEqual(roomFillStyle(args,colors),JSON.parse(JSON.stringify(expected)));
    count++;
  }
  console.log(`Source parity: ${count} combinations passed.`);
}
console.log('Room-fill behavior checks passed.');
