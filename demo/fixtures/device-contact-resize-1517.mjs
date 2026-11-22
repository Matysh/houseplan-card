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
  ['elbow',188,758,1,'mdi:lightbulb'],
  ['elbow-right',0,0,1.05,'mdi:power-socket-eu'],
  ['elbow-right-end',0,0,.9,'mdi:light-switch'],
  ['elbow-bottom',0,0,.95,'mdi:motion-sensor'],
  ['elbow-bottom-end',0,0,.85,'mdi:thermometer'],
];
export const contactResizePartitions = [
  [[.14,.18],[.14,.44]], [[.39,.18],[.55,.43]],
  [[.64,.17],[.86,.17]], [[.86,.17],[.86,.41]],
  [[.16,.63],[.44,.63]], [[.62,.62],[.86,.62]], [[.86,.62],[.86,.85]],
  [[.16,.73],[.43,.73]], [[.16,.73],[.16,.92]],
].map(([a,b],index)=>({id:'partition-'+index,a,b,cm:12}));

export const individuallyResizedContacts = new Set(['straight','corner','free-b','wall-c','angle-b','elbow']);

export function hasElbowResizeContacts(walls, edges) {
  const {top, left} = walls.elbow ?? {};
  if (!top || !left || top === left || Object.keys(walls.elbow).length !== 2) return false;
  const expected = [
    ['elbow', null, ['elbow-right','elbow-bottom']],
    ['elbow-right', 'top', ['elbow','elbow-right-end']],
    ['elbow-right-end', 'top', ['elbow-right']],
    ['elbow-bottom', 'left', ['elbow','elbow-bottom-end']],
    ['elbow-bottom-end', 'left', ['elbow-bottom']],
  ];
  return expected.every(([id, side, neighbours]) => {
    const contact = walls[id];
    return contact && (!side || Object.keys(contact).length === 1 && contact[side] === walls.elbow[side])
      && edges[id]?.length === neighbours.length && neighbours.every(other => edges[id].includes(other));
  });
}

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
  for (const id of ['straight','diagonal','corner','free-a','wall-a','angle-a','elbow']) {
    const marker = raw(id);
    const proposal = id === 'free-a' ? null : nearest(marker,
      ['corner','angle-a','elbow'].includes(id) ? contactAtCorner(marker,walls)
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
      const positions = side === 'bottom'
        ? [a.left-box.left,a.right-box.right,(a.left+a.right-box.left-box.right)/2]
          .map(x => [x,a.bottom-depth-box.top])
        : [a.top-box.top,a.bottom-box.bottom,(a.top+a.bottom-box.top-box.bottom)/2]
          .map(y => [side === 'right' ? a.right-depth-box.left : a.left+depth-box.right,y]);
      for (const [x,y] of positions) {
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
  append('elbow-right','elbow','right');
  append('elbow-right-end','elbow-right','right');
  append('elbow-bottom','elbow','bottom');
  append('elbow-bottom-end','elbow-bottom','bottom');
  return Object.fromEntries([...authored].map(([id,marker])=>{
    const contact_basis=makeContactBasis(marker,space);
    return [id,{...contact_basis.at,contact_basis}];
  }));
}
