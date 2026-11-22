export const contactResizeSeeds = [
  ['straight',172,270,1,'mdi:wall'],
  ['diagonal',467,230,.9,'mdi:thermometer'],
  ['corner',829,203,1.15,'mdi:lightbulb'],
  ['free-a',206,510,1.1,'mdi:fan'],
  ['free-b',0,0,1,'mdi:water'],
  ['free-c',0,0,.8,'mdi:water-percent'],
  ['wall-a',212,667,.95,'mdi:air-filter'],
  ['wall-b',0,0,1.15,'mdi:power-socket-eu'],
  ['wall-c',0,0,1,'mdi:light-switch'],
  ['angle-a',829,657,1.1,'mdi:motion-sensor'],
  ['angle-b',0,0,1,'mdi:gesture-tap'],
  ['angle-c',0,0,.9,'mdi:access-point'],
];
export const contactResizePartitions = [
  [[.14,.18],[.14,.44]], [[.39,.18],[.55,.43]],
  [[.64,.17],[.86,.17]], [[.86,.17],[.86,.41]],
  [[.16,.63],[.44,.63]], [[.62,.62],[.86,.62]], [[.86,.62],[.86,.85]],
].map(([a,b],index)=>({id:'partition-'+index,a,b,cm:12}));

export async function authorContactResizePositions(sample, walls, space) {
  const {contactAtCorner, contactAtWall, contactBoxIn, contactRotate, contactShapeJoinDepth,
    deriveContactShape, freeContactShape, joinedContactSide, rotatedContactCapsule} = await import('../../test-build/device-contact-geometry.js');
  const {makeContactBasis} = await import('../../test-build/device-contact-basis.js');

  const authored = new Map();
  const raw = id => {
    const measured = sample[id];
    const [, x, y] = contactResizeSeeds.find(seed => seed[0] === id);
    if (!measured) throw Error('Unmeasured marker: '+id);
    return {...measured,x,y};
  };
  const nearest = (marker,candidates) => candidates.sort((a,b)=>
    Math.hypot(a.x-marker.x,a.y-marker.y)-Math.hypot(b.x-marker.x,b.y-marker.y))[0];
  for (const id of ['straight','diagonal','corner','free-a','wall-a','angle-a']) {
    const marker = raw(id);
    const proposal = id === 'free-a' ? null : nearest(marker,
      id === 'corner' || id === 'angle-a' ? contactAtCorner(marker,walls)
        : walls.flatMap(wall=>contactAtWall(marker,wall)));
    if (id !== 'free-a' && (!proposal || Math.hypot(proposal.x-marker.x,proposal.y-marker.y)>70))
      throw Error('Missing nearby wall support for '+id);
    authored.set(id,proposal ? {...marker,x:proposal.x,y:proposal.y} : marker);
  }
  const append = (id,other,side) => {
    const marker=raw(id), previous=deriveContactShape(authored.get(other),walls);
    const a=contactBoxIn(previous), attached=Object.keys(previous.walls).length>0;
    for (const inset of attached ? [marker.diameter*.009375,0] : [0]) {
      const box=rotatedContactCapsule(marker.box,previous.angle,inset);
      const shape={...freeContactShape(marker),angle:previous.angle,box};
      const depth=contactShapeJoinDepth(previous,shape,side);
      const x=side==='right'?a.right-depth-box.left:a.left+depth-box.right;
      for(const y of [a.top-box.top,a.bottom-box.bottom,(a.top+a.bottom-box.top-box.bottom)/2]){
        const [cx,cy]=contactRotate([x,y],previous.angle),candidate={...marker,x:cx,y:cy};
        const actual=deriveContactShape(candidate,walls);
        if (joinedContactSide(previous,actual)===side && (!attached || Object.keys(actual.walls).length)) {
          authored.set(id,candidate); return;
        }
      }
    }
    throw Error('Cannot join '+id+' to '+other);
  };
  for (const prefix of ['free','wall','angle']) {
    const side=prefix==='angle'?'left':'right';
    append(prefix+'-b',prefix+'-a',side);
    append(prefix+'-c',prefix+'-b',side);
  }
  return Object.fromEntries([...authored].map(([id,marker])=>{
    const contact_basis=makeContactBasis(marker,space);
    return [id,{...contact_basis.at,contact_basis}];
  }));
}
