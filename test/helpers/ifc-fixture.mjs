/** Synthetic owner-free IFC; expected dimensions are specified by the tests. */
export function ifcFixture(options = {}) {
  const rows = []; let serial = 0;
  const add = (type, ...args) => { const id = ++serial; rows.push(`#${id}=${type}(${args.join(',')});`); return `#${id}`; };
  const text = s => `'${s.replaceAll("'", "''")}'`, list = xs => `(${xs.join(',')})`;
  const n = x => Number(x).toString().includes('.') ? String(x) : `${x}.`;
  const factor = options.units === 'mm' ? .001 : options.units === 'feet' ? .3048 : 1;
  const length = x => n(x / factor);
  const point = (...p) => add('IFCCARTESIANPOINT', list(p.map(length)));
  const direction = (...p) => add('IFCDIRECTION', list(p.map(n)));
  const axis = (p = [0,0,0], z = '$', x = '$') => add('IFCAXIS2PLACEMENT3D', point(...p), z, x);
  const origin = axis(), baseUnit = add('IFCSIUNIT', '*', '.LENGTHUNIT.', '$', '.METRE.');
  const lengthUnit = options.units === 'mm' ? add('IFCSIUNIT', '*', '.LENGTHUNIT.', '.MILLI.', '.METRE.')
    : options.units === 'feet' ? add('IFCCONVERSIONBASEDUNIT', add('IFCDIMENSIONALEXPONENTS','1','0','0','0','0','0','0'), '.LENGTHUNIT.', text('FOOT'), add('IFCMEASUREWITHUNIT','IFCLENGTHMEASURE(0.3048)',baseUnit)) : baseUnit;
  const units = add('IFCUNITASSIGNMENT',list([lengthUnit]));
  const context = add('IFCGEOMETRICREPRESENTATIONCONTEXT', '$', text('Model'), '3', '0.00001', origin, '$');
  const guid = () => text(`000000000000000${String(serial).padStart(7,'0')}`);
  const project = add('IFCPROJECT',guid(),'$',text('Fixture'),'$','$','$','$',list([context]),units);
  const angle = (options.rotation || 0) * Math.PI/180;
  const buildingPlacement = add('IFCLOCALPLACEMENT','$',axis(options.translation || [0,0,0], '$', direction(Math.cos(angle),Math.sin(angle),0)));
  const building = add('IFCBUILDING',guid(),'$',text('House'),'$','$',buildingPlacement,'$','$','.ELEMENT.','$','$','$');
  add('IFCRELAGGREGATES',guid(),'$','$','$',project,list([building]));
  const productShape = representations => add('IFCPRODUCTDEFINITIONSHAPE','$','$',list(representations));
  const shape = (label,type,items) => {
    const original=add('IFCSHAPEREPRESENTATION',context,text(label),text(type),list(items));
    if(!options.mapped)return original;
    const map=add('IFCREPRESENTATIONMAP',axis([1,2,0],'$',direction(0,1,0)),original);
    const mappedScale=options.mappedScale??1;
    const target=add('IFCCARTESIANTRANSFORMATIONOPERATOR3D',direction(0,1,0),direction(-1,0,0),point(mappedScale,2*mappedScale,0),n(mappedScale),direction(0,0,1));
    return add('IFCSHAPEREPRESENTATION',context,text(label),text('MappedRepresentation'),list([add('IFCMAPPEDITEM',map,target)]));
  };
  const polyline = points => options.indexed
    ? add('IFCINDEXEDPOLYCURVE',add('IFCCARTESIANPOINTLIST2D',list(points.map(p=>list(p.slice(0,2).map(length))))),list([`IFCLINEINDEX((${points.map((_,i)=>i+1).join(',')}))`]),'.F.')
    : add('IFCPOLYLINE',list(points.map(p=>point(...p))));
  const rect = (w,h) => add('IFCRECTANGLEPROFILEDEF','.AREA.','$','$',length(w),length(h));
  const solid = (w,h,depth,position=origin) => add('IFCEXTRUDEDAREASOLID',rect(w,h),position,direction(0,0,1),length(depth));
  const floorCount = options.twoFloors ? 2 : 1;
  for(let index=0;index<floorCount;index++) {
    const floorPlacement = add('IFCLOCALPLACEMENT',buildingPlacement,axis([options.floorOffset && index ? 1 : 0,0,index*3]));
    const floor = add('IFCBUILDINGSTOREY',guid(),'$',text(index ? 'Upper' : 'Ground'),'$','$',floorPlacement,'$','$','.ELEMENT.',length(index*3));
    add('IFCRELAGGREGATES',guid(),'$','$','$',building,list([floor]));
    const contained = [];
    const wall = (a,b,t=.2,offset=-t/2,includeBody=true) => {
      t=options.wallThickness??t;
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      const placement=add('IFCLOCALPLACEMENT',floorPlacement,axis([...a,0],'$',direction(dx/len,dy/len,0)));
      const representations=[shape('Axis','Curve2D',[polyline(options.axisSplit?[[0,0],[len/2,0],[len,0]]:[[0,0],[len,0]])])];
      if(includeBody&&!options.noWallBody) representations.push(shape('Body','SweptSolid',[solid(len,t,options.wallHeight??2.8,axis([len/2,offset+t/2,0]))]));
      const id=add('IFCWALL',guid(),'$',text('Wall '+contained.length),'$','$',placement,productShape(representations),'$','.NOTDEFINED.');
      const layer=add('IFCMATERIALLAYER','$',length(t),'.F.','$','$','$','$');
      const set=add('IFCMATERIALLAYERSET',list([layer]),'$','$');
      const usage=add('IFCMATERIALLAYERSETUSAGE',set,'.AXIS2.','.POSITIVE.',length(offset),'$');
      add('IFCRELASSOCIATESMATERIAL',guid(),'$','$','$',list([id]),usage);
      contained.push(id); return {id,placement,len,t};
    };
    const bottom=wall([0,0],[8,0]); wall([8,0],[8,4]); wall([8,4],[0,4]); wall([0,4],[0,0]);
    const shared=wall([4,0],[4,4]);
    const doorHost=options.duplicateHost?wall([4,0],[4,4]):shared;
    if(options.junctions) {wall([10,0],[10,4]);wall([9,2],[11,2]);wall([4,2],[6,2]);wall([5,1],[7,1]);}
    if(options.referenceOffset) wall([12,0],[15,0],.2,.2085,false);
    const room = (title,points) => {
      const representation = shape('FootPrint','GeometricCurveSet',[add('IFCGEOMETRICCURVESET',list([polyline([...points,points[0]])]))]);
      const id=add('IFCSPACE',guid(),'$',text(title),'$','$',floorPlacement,productShape([representation]),text(title),'.ELEMENT.', '.INTERNAL.','$');
      add('IFCRELAGGREGATES',guid(),'$','$','$',floor,list([id]));
    };
    if(!options.noRooms) {
      room('West',[[.1,.1],[3.9,.1],[3.9,3.9],[.1,3.9]]);
      room('East',[[4.1,.1],[7.9,.1],[7.9,3.9],[4.1,3.9]]);
    }
    const opening = (host,along,width,kind) => {
      const placement=add('IFCLOCALPLACEMENT',host.placement,axis([along,0,0]));
      const profilePosition=axis([0,-host.t/2,1],direction(0,1,0),direction(1,0,0));
      const body=shape('Body','SweptSolid',[solid(width,2,host.t,profilePosition)]);
      const voidId=add('IFCOPENINGELEMENT',guid(),'$',text('Void'),'$','$',placement,productShape([body]),'$','.OPENING.');
      add('IFCRELVOIDSELEMENT',guid(),'$','$','$',host.id,voidId);
      const obj=add(kind==='door'?'IFCDOOR':'IFCWINDOW',guid(),'$',text(kind),'$','$',placement,'$','$',length(2),length(width),'.NOTDEFINED.','.NOTDEFINED.','$');
      add('IFCRELFILLSELEMENT',guid(),'$','$','$',voidId,obj); contained.push(obj);
    };
    if(!options.noOpenings){opening(doorHost,options.junctions?1:2,.9,'door');opening(bottom,6,1.2,'window');}
    add('IFCRELCONTAINEDINSPATIALSTRUCTURE',guid(),'$','$','$',list(contained),floor);
  }
  const source=`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Houseplan synthetic fixture'),'2;1');\nFILE_NAME('fixture.ifc','2026-11-17T00:00:00',('Houseplan'),('Houseplan'),'Houseplan tests','Houseplan tests','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${rows.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
  return new TextEncoder().encode(source);
}
