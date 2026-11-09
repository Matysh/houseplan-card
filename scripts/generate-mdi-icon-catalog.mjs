// Generate the isolated picker data; sharing @mdi/js with View would defeat laziness.
import { readFileSync, writeFileSync } from 'node:fs';
import * as paths from '@mdi/js';
const meta = JSON.parse(readFileSync(new URL('../node_modules/@mdi/svg/meta.json', import.meta.url)));
const icons=Object.fromEntries(meta.map(icon=>icon.name).sort().map(name=>{
 const key='mdi'+name.replace(/(^|-)(\w)/g,(_all,_dash,c)=>c.toUpperCase());
 if(!paths[key])throw Error('Missing MDI path: '+name);
 return ['mdi:'+name,paths[key]];
}));
const target=new URL('../src/mdi-icon-data.json',import.meta.url);
const text=JSON.stringify(icons)+'\n';
if(process.argv.includes('--check')){
 if(readFileSync(target,'utf8')!==text)throw Error('Regenerate with node scripts/generate-mdi-icon-catalog.mjs');
}else writeFileSync(target,text);
console.log('MDI local glyphs: '+Object.keys(icons).length);
