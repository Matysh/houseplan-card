const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 const svg=fs.readFileSync(path.join(__dirname,'scene.svg'),'utf8');
 const variants=['wall','opening','device','rectangle','text','image','contour','backdrop','led'];
 const names=['01-plan-wall','02-plan-opening','03-devices-light','04-decor-rectangle','05-decor-text','06-decor-image','07-plan-contour','08-plan-backdrop','09-devices-led'];
 const panels={};
 for(let i=0;i<variants.length;i++){
  await page.goto(pathToFileURL(path.join(__dirname,'screen.html')).href+'?variant='+variants[i],{waitUntil:'domcontentloaded'});
  await page.evaluate(svg=>window.mountScene(svg),svg);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,names[i]+'.png')});
  await page.locator('.panel').screenshot({path:path.join(__dirname,names[i]+'-panel.png')});
  panels[variants[i]]=await page.locator('.panel').evaluate(el=>el.outerHTML);
  console.log(names[i],await page.locator('.panel').boundingBox());
  const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('.field,.object-title,.panel-foot')).filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className+': '+e.innerText));
  if(overflow.length)console.log('OVERFLOW',overflow);
 }
 const original=fs.readFileSync(path.join(__dirname,'screen.html'),'utf8');
 const css=original.match(/<style>([\s\S]*?)<\/style>/)[1];
 const boards=[
  {name:'12-opening-device-text',items:[['opening','ПЛАН · ПРОЁМ'],['device','УСТРОЙСТВА · СВЕТИЛЬНИК'],['text','ПОДЛОЖКА · ТЕКСТ']]},
  {name:'13-wall-rectangle-image',items:[['wall','ПЛАН · СТЕНА'],['rectangle','ПОДЛОЖКА · ФИГУРА'],['image','ПОДЛОЖКА · ИЗОБРАЖЕНИЕ']]},
  {name:'14-contour-backdrop-led',items:[['contour','КОНТУР · ПОДСКАЗКА К УДАЛЕНИЮ'],['backdrop','ПЛАН · ПОДСКАЗКА К УДАЛЕНИЮ'],['led','УСТРОЙСТВА · LED-ЛЕНТА']]}
 ];
 await page.setViewportSize({width:1144,height:1088});
 for(const board of boards){
  const html='<!doctype html><html lang="ru"><meta charset="utf-8"><style>'+css+'html,body{width:1144px;height:1088px;background:#eef2f4}.board{display:grid;grid-template-columns:repeat(3,360px);gap:16px;padding:16px}.tile-title{height:40px;padding:5px 0;font-size:12px;font-weight:600;color:#586a75;letter-spacing:.6px}.panel{position:relative;left:auto;top:auto;border:1px solid #d6dfe4;border-radius:6px;overflow:hidden}</style><body><div class="board">'+board.items.map(([key,label])=>'<div><div class="tile-title">'+label+'</div>'+panels[key]+'</div>').join('')+'</div></body></html>';
  fs.writeFileSync(path.join(__dirname,board.name+'.html'),html);
  await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,board.name+'.png')});
 }
 await page.setViewportSize({width:1920,height:1080});
 await page.goto(pathToFileURL(path.join(__dirname,'screen.html')).href+'?variant=text&dialog=variable',{waitUntil:'domcontentloaded'});
 await page.evaluate(svg=>window.mountScene(svg),svg);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(__dirname,'10-text-variable-dialog.png')});
 await page.locator('.variable-dialog').screenshot({path:path.join(__dirname,'11-text-variable-dialog-detail.png')});
 console.log('runtime errors',errs);
 if(errs.length)throw Error('Runtime errors');
 await browser.close();
})();
