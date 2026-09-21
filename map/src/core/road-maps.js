const rad=n=>n*Math.PI/180;
const allowed=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service']);
const denied=new Set(['no','private','agricultural','forestry','delivery']);
export function metres(a,b){
 const dy=rad(b[1]-a[1]),dx=rad(b[0]-a[0]);
 const h=Math.sin(dy/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dx/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function carAccess(tags={}){
 const access=tags.motorcar??tags.motor_vehicle??tags.vehicle??tags.access;
 return allowed.has(tags.highway)&&tags.area!=='yes'&&!denied.has(access)&&!tags['access:conditional']&&!tags['motor_vehicle:conditional']&&!tags['motorcar:conditional']&&!tags['oneway:conditional'];
}
export function chargingRecord(element){
 const t=element.tags||{},p=element.center||element;
 if(t.amenity!=='charging_station'||!Number.isFinite(p.lon)||!Number.isFinite(p.lat))return null;
 if(denied.has(t.motorcar)||denied.has(t.motor_vehicle)||denied.has(t.access))return null;
 const sockets=Object.entries(t).filter(([k,v])=>/^socket:[^:]+$/.test(k)&&v!=='0'&&v!=='no').map(([k,v])=>({type:k.slice(7),count:/^\d+$/.test(v)?Number(v):null,output:t[k+':output']||null}));
 return {id:`${element.type}/${element.id}`,coordinates:[p.lon,p.lat],name:t['name:ko']||t.name||t.operator||t.brand||`충전소 ${element.id}`,operator:t.operator||t.brand||null,capacity:/^\d+$/.test(t.capacity)?Number(t.capacity):null,sockets,output:t['charging_station:output']||null,access:t.access||null,openingHours:t.opening_hours||null,fee:t.fee||null,status:null,sourceUrl:`https://www.openstreetmap.org/${element.type}/${element.id}`,tags:t};
}
export function roadGraph(raw){
 const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,{id:n.id,coordinates:[n.lon,n.lat],tags:n.tags||{}}]));
 const restrictions=[],excludedWays=new Set();
 for(const r of raw.elements.filter(e=>e.type==='relation'&&e.tags?.type==='restriction')){
  if(r.tags.except?.split(';').some(v=>['motorcar','motor_vehicle','vehicle'].includes(v)))continue;
  const from=r.members.find(m=>m.role==='from'),to=r.members.find(m=>m.role==='to'),via=r.members.filter(m=>m.role==='via');
  if(!from||!to||!via.length)continue;
  const kind=r.tags['restriction:motorcar']||r.tags['restriction:motor_vehicle']||r.tags.restriction;
  if(via.length!==1||via[0].type!=='node'||Object.keys(r.tags).some(k=>k.includes('conditional'))||!kind||!/^(no|only)_/.test(kind)){excludedWays.add(from.ref);continue;}
  restrictions.push({from:from.ref,to:to.ref,via:via[0].ref,kind});
 }
 const edges=[],adjacency=new Map(),ways=[];
 const blockedNode=n=>n.tags.barrier&&!['cattle_grid','toll_booth','border_control','entrance'].includes(n.tags.barrier)&&!['yes','designated','permissive'].includes(n.tags.motorcar??n.tags.motor_vehicle??n.tags.access);
 for(const way of new Map(raw.elements.filter(e=>e.type==='way'&&carAccess(e.tags)&&!excludedWays.has(e.id)).map(w=>[w.id,w])).values()){
  ways.push(way);const t=way.tags,oneway=t.oneway??(t.junction==='roundabout'||t.highway==='motorway'?'yes':'no');
  for(let i=1;i<way.nodes.length;i++){
   const a=nodes.get(way.nodes[i-1]),b=nodes.get(way.nodes[i]);if(!a||!b||blockedNode(a)||blockedNode(b))continue;
   const length=metres(a.coordinates,b.coordinates);if(length<.05)continue;
   const add=(from,to)=>{const e={id:edges.length,from:from.id,to:to.id,wayId:way.id,name:t.name||null,distance:length};edges.push(e);if(!adjacency.has(from.id))adjacency.set(from.id,[]);adjacency.get(from.id).push(e);};
   if(oneway!=='-1')add(a,b);if(!['yes','1','true'].includes(oneway))add(b,a);
  }
 }
 const used=new Set(edges.flatMap(e=>[e.from,e.to]));
 return {nodes:new Map([...nodes].filter(([id])=>used.has(id))),edges,adjacency,restrictions,ways,excludedWays:[...excludedWays]};
}
function permitted(graph,previous,next){
 if(!previous)return true;
 for(const r of graph.restrictions){
  if(r.via!==next.from||r.from!==previous.wayId)continue;
  const match=r.to===next.wayId&&(r.kind!=='no_u_turn'||next.to===previous.from);
  if(r.kind.startsWith('no_')&&match||r.kind.startsWith('only_')&&!match)return false;
 }
 return true;
}
export function roadRoute(graph,start,end){
 if(!graph.nodes.has(start)||!graph.nodes.has(end))return null;
 if(start===end)return {distance:0,nodes:[start],edges:[],coordinates:[graph.nodes.get(start).coordinates]};
 // Incoming edge is part of the state: a turn restriction cannot be checked by node alone.
 const costs=new Map([[-1,0]]),previous=new Map(),open=[{key:-1,node:start,distance:0}],closed=new Set();let finish;
 while(open.length){
  open.sort((a,b)=>b.distance-a.distance);const current=open.pop();if(closed.has(current.key))continue;closed.add(current.key);
  if(current.node===end){finish=current.key;break;}
  for(const edge of graph.adjacency.get(current.node)||[]){
   if(!permitted(graph,graph.edges[current.key],edge))continue;
   const distance=current.distance+edge.distance;
   if(distance<(costs.get(edge.id)??Infinity)){costs.set(edge.id,distance);previous.set(edge.id,current.key);open.push({key:edge.id,node:edge.to,distance});}
  }
 }
 if(finish===undefined)return null;
 const edges=[];for(let key=finish;key!==-1;key=previous.get(key))edges.unshift(graph.edges[key]);
 const ids=[start,...edges.map(e=>e.to)];return {distance:costs.get(finish),nodes:ids,edges,coordinates:ids.map(id=>graph.nodes.get(id).coordinates)};
}
export function nearestRoad(graph,coordinates,maxDistance=150){
 let best=null;for(const node of graph.nodes.values()){const distance=metres(coordinates,node.coordinates);if(distance<=maxDistance&&(!best||distance<best.distance))best={nodeId:node.id,coordinates:node.coordinates,distance};}return best;
}
export function sampleRoadRoute(path,distance){
 if(!path?.coordinates.length)return null;
 const total=Math.max(0,Math.min(path.distance,distance));let covered=0;
 for(let i=1;i<path.coordinates.length;i++){
  const a=path.coordinates[i-1],b=path.coordinates[i],length=metres(a,b);
  if(covered+length>=total){const t=length?(total-covered)/length:0;return {coordinates:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],bearing:Math.atan2((b[0]-a[0])*Math.cos(rad(a[1])),b[1]-a[1])*180/Math.PI,arrived:distance>=path.distance};}covered+=length;
 }
 return {coordinates:path.coordinates.at(-1),bearing:0,arrived:true};
}
