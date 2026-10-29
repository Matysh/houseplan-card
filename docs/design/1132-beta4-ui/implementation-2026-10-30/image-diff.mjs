import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch();const page=await browser.newPage();
const names=['01-wide','02-compact','03-wrapped','04-three-rows','05-print-dialog','06-external-screen','07-markers-lqi'];
const rows=[];
for(const name of names){const ref=readFileSync('output/1132-comparison/reference/'+name+'.png').toString('base64');const prod=readFileSync('output/1132-comparison/product/'+name+'.png').toString('base64');
 rows.push({name,...await page.evaluate(async({ref,prod})=>{async function load(base){const im=new Image();im.src='data:image/png;base64,'+base;await im.decode();const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const c=cv.getContext('2d');c.drawImage(im,0,0);return{cv,c,data:c.getImageData(0,0,cv.width,cv.height)};};const a=await load(ref),b=await load(prod);let changed=0,peak=0;const d=a.c.createImageData(a.cv.width,a.cv.height);for(let i=0;i<a.data.data.length;i+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(a.data.data[i+k]-b.data.data[i+k]));if(delta){changed++;d.data[i]=255;d.data[i+3]=255;}peak=Math.max(peak,delta);}a.c.putImageData(d,0,0);return{width:a.cv.width,height:a.cv.height,changed,peak,diff:a.cv.toDataURL().split(',')[1]};},{ref,prod})});
 const row=rows.at(-1);writeFileSync('output/1132-comparison/'+name+'-diff.png',Buffer.from(row.diff,'base64'));delete row.diff;
}
writeFileSync('output/1132-comparison/diffs.json',JSON.stringify(rows,null,2));console.log(rows);await browser.close();