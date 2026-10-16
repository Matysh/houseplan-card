// Frozen numerical cases from review.js of the owner's designer handoff.
// Archive SHA256 d03cf880dbfc4482eac38d51b3f5b386c88e94204baa3a1390bcb93a2e59482b.
// Coordinates and core registration are shared per scene, never fitted per marker.
import { clusters, groupOutline } from '../../test/fixtures/866-designer/geometry.mjs';
const d=(x,y,size=96,badge='none')=>({x,y,size,badge,value:'26%'});
const w=(x,y,width,height)=>({x,y,w:width,h:height,right:x+width,bottom:y+height});
// Frozen layout data: do not let changing an external reference oracle alter
// the golden fixture. All pixel-producing inputs stay in demo/fixtures.
const step=s=>s*90/103;
const row=(n,x,y,s=96)=>Array.from({length:n},(_,i)=>d(x+i*step(s),y,s));
export const designerContactCases = [
  { id:'wall-near', title:'Рядом со стеной', devices:[d(165,108)], walls:[w(55,0,40,214)] },
  { id:'wall-left', title:'Контакт слева', devices:[d(143,108)], walls:[w(55,0,40,214)] },
  { id:'wall-top', title:'Контакт сверху', devices:[d(220,113)], walls:[w(0,25,448,40)] },
  { id:'wall-right', title:'Контакт справа', devices:[d(303,108)], walls:[w(351,0,40,214)] },
  { id:'wall-double', title:'Двойная иконка у стены', devices:[d(250,136,96,'left')], walls:[w(0,184,448,30)] },
  { id:'wall-row', title:'Соединённые иконки у стены', devices:row(3,133,98), walls:[w(0,20,448,30)] },
  { id:'row', title:'Горизонтальный ряд', devices:row(4,96,106), walls:[] },
  { id:'column', title:'Вертикальная связка', devices:[d(222,68),d(222,68+step(96))], walls:[] },
  { id:'l-shape', title:'Г-образная раскладка', devices:[d(150,65),d(150,65+step(96)),d(150+step(96),65+step(96))], walls:[] },
  { id:'grid', title:'Несколько рядов', devices:Array.from({length:10},(_,i)=>d(122+i%5*step(56),82+Math.floor(i/5)*step(56),56)), walls:[] },
  { id:'badge', title:'С бейджем', devices:[d(180,106,96,'left'),d(180+step(96),106)], walls:[] },
  { id:'detach', title:'Отсоединение', devices:[...row(2,105,106),d(328,106)], walls:[] },
].map(c=>({...c,devices:c.devices.map((d,i)=>({...d,id:`designer-${i}`})),walls:c.walls.map((w,i)=>({...w,id:`designer-wall-${i}`}))}));

export function designerReferencePaths(scene) {
  return clusters(scene.devices).map(group=>{
    const {box,path}=groupOutline(group,scene.walls);
    return {x:box.x,y:box.y,path};
  });
}
