import {markerRecords} from './geo-data.js';

const metersPerDegree=111320;
export function offsetCoordinate(point,east,north){
  return {lat:point.lat+north/metersPerDegree,lng:point.lng+east/(metersPerDegree*Math.cos(point.lat*Math.PI/180))};
}
export function nearbyMarkers(places,options={}){
  const rows=markerRecords(places,options),groups=new Map();
  for(const row of rows){const key=row.position.lat.toFixed(5)+','+row.position.lng.toFixed(5);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  for(const group of groups.values()){
    group.sort((a,b)=>a.siteId.localeCompare(b.siteId));
    group.forEach((row,i)=>{
      const angle=i/group.length*Math.PI*2,offset=group.length>1?26:0;
      row.displayPosition={...offsetCoordinate(row.position,Math.cos(angle)*offset,Math.sin(angle)*offset),altitude:row.position.altitude};
      row.displayOffsetMeters=offset;
    });
  }
  return rows;
}
