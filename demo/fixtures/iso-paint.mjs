/** Public, fictional #1470 paint/raster regression scene, not owner data. */
import { makeLargeHouseFixture } from './large-house.mjs';

export function makeIsoPaintFixture() {
  const fixture=makeLargeHouseFixture({floors:1,roomsPerFloor:8,devices:74,openings:15,
    partitions:0,columns:0,decor:0,stairs:0});
  const space=fixture.config.spaces[0];
  space.settings={...space.settings,label_temp:true,label_hum:true,label_lqi:true,label_light:true};
  space.decor=Array.from({length:15},(_,i)=>{
    const room=space.rooms[i%8],a=room.poly[0],c=room.poly[2];
    return{id:'iso-perf-furniture-'+i,kind:'furniture',
      symbol:['sofa','bed_double','desk','coffee_table','chair'][i%5],
      x:a[0]+(c[0]-a[0])*(i<8?.18:.58),y:a[1]+(c[1]-a[1])*.35,
      w:.075,h:.055,width_cm:1};
  });
  fixture.config.settings={...fixture.config.settings,volumetric_view:true,
    filter_seeded:true,known_devices:Object.keys(fixture.devices).sort(),new_device_ids:[],
    marker_area_snapshot:Object.fromEntries(Object.values(fixture.devices).map(device=>
      [device.id,{binding:'device:'+device.id,area:device.area_id}]))};
  return fixture;
}
