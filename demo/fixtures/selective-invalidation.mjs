// #1093: deterministic active load, not hidden-marker ballast. Geometry is v10.
export function makeSelectiveInvalidationFixture(large = true) {
  const roomsPerFloor = large ? 20 : 2;
  const spaces = Array.from({ length: 3 }, (_, floor) => {
    const walls = new Map();
    const rooms = Array.from({ length: roomsPerFloor }, (_, i) => {
      const x = .04 + (i % 5) * .184, y = .04 + Math.floor(i / 5) * .23;
      const poly = [[x,y],[x+.184,y],[x+.184,y+.23],[x,y+.23]].map(p=>p.map(v=>+v.toFixed(6)));
      const wall_ids = poly.map((a,j) => {
        const b=poly[(j+1)%4],key=[a.join(','),b.join(',')].sort().join('|');
        if(!walls.has(key))walls.set(key,{id:`f${floor+1}-w${walls.size}`,a,b,cm:15});
        return walls.get(key).id;
      });
      return {id:`f${floor+1}-r${i}`,name:`Room ${i}`,poly,wall_ids,settings:{show_name:true}};
    });
    return {id:`f${floor+1}`,title:`Floor ${floor+1}`,cell_cm:5,view_box:[0,0,1,1],rooms,
      wall_segments:[...walls.values()],walls:[],partitions:[],wall_columns:[
        {id:`f${floor+1}-column`,shape:'square',center:[.13,.15],cm:25,angle:0}],
      openings:[{id:`f${floor+1}-door`,type:'door',x:.132,y:.04,angle:0,length:.045,
        host:{kind:'wall',id:rooms[0].wall_ids[0],t:.5}}],open_spans:[],settings:{show_borders:true,show_names:true,fill_mode:'none',
        name_color:{c:'#222222',a:1},wall_fill:{c:'#777777',a:1}}};
  });
  const count=large?200:8;
  const markers=Array.from({length:count},(_,i)=>({id:`load-${i}`,binding:`entity:sensor.load_${i}`,
    space:large?(i<120?'f1':i<160?'f2':'f3'):'f1',name:`Load ${i}`,
    icon:i%3?'mdi:thermometer':'mdi:lightbulb',display:i%3?'value_static_icon':'static_icon',
    value_source:{kind:'entity_state',entity_id:`sensor.load_${i}`},tap_action:'info'}));
  const layout=Object.fromEntries(markers.map((m,i)=>[m.id,{s:m.space,x:.06+(i%12)*.075,y:.08+(Math.floor(i/12)%10)*.083}]));
  const devices=Object.fromEntries(Array.from({length:large?214:8},(_,i)=>[`dev-${i}`,{id:`dev-${i}`,name:`Synthetic ${i}`,area_id:null}]));
  const entities=Object.fromEntries(Array.from({length:large?2890:8},(_,i)=>[`sensor.load_${i}`,
    {entity_id:`sensor.load_${i}`,device_id:`dev-${i%(large?214:8)}`,platform:'demo',unique_id:`load_${i}`} ]));
  const states=Object.fromEntries(Array.from({length:large?1673:8},(_,i)=>[`sensor.load_${i}`,
    {entity_id:`sensor.load_${i}`,state:String(20+i%35),attributes:{friendly_name:`Synthetic ${i}`,unit_of_measurement:'°C'},
      last_changed:'2026-01-01T00:00:00Z',last_updated:'2026-01-01T00:00:00Z'}]));
  return {config:{model_version:10,spaces,markers,settings:{bg_mode:'static',show_room_tooltip:false,filter_seeded:true}},layout,devices,entities,states};
}
