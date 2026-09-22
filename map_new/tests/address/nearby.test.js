import {it,expect} from 'vitest';
import {nearbyMarkers} from '../../src/address/nearby-data.js';
import {metersBetween} from '../../src/address/location.js';
it('separates coincident markers near their true address without changing saved coordinates',()=>{
  const places=['a','b','c'].map(siteId=>({siteId,name:siteId,location:{lat:37.5,lng:127,precision:'address-area'}}));
  const rows=nearbyMarkers(places,{height:80});expect(new Set(rows.map(r=>r.displayPosition.lng+','+r.displayPosition.lat)).size).toBe(3);
  for(const row of rows){expect(row.position).toEqual({lat:37.5,lng:127,altitude:80});expect(metersBetween(row.position,row.displayPosition)).toBeLessThan(27);expect(row.displayOffsetMeters).toBe(26);}
  expect(nearbyMarkers(places,{includeAreas:false})).toHaveLength(0);
});
