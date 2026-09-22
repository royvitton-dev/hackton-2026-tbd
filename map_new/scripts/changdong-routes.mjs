// Aisle centerlines reviewed in the archived 1800 × 1350 B2 drawing.
// Do not connect through parking islands, service rooms or stair cores.
export function changdongRoutes(plan,site){
 const at=(x,z)=>({x:(x-1065)*.09,y:0,z:(z-745)*.09});
 const node=(id,x,z,kind='junction',label=id)=>({id,...at(x,z),kind,label,floor:'B2'});
 plan.nodes=[node('entrance',1210,625,'entrance','B2 진입'),node('top',1210,690),node('tl',894,690),node('tr',1474,690),node('ml',894,872),node('mr',1474,872),node('bl',894,1056),node('br',1474,1056)];
 const lanes=[['entrance','top',5.2,'ramp'],['tl','top',6],['top','tr',6],['tl','ml',5.6],['ml','bl',5.6],['tr','mr',6],['mr','br',6],['ml','mr',6],['bl','br',5.6]];
 plan.edges=lanes.map(([from,to,width,kind],i)=>({id:'b2-aisle-'+i,from,to,width,modes:kind?['car']:['car','person'],...(kind?{kind,height:2.4}:{}),oneWay:false}));
 const access=[];
 for(const s of plan.spaces.filter(s=>['parking','ev'].includes(s.kind))){
  const x=s.x/.09+1065,z=s.z/.09+745;
  let px=x,pz=z;
  if(x>1510)px=1474;else if(x<860)px=894;
  else if(z<785)pz=690;else if(z<960)pz=872;else pz=1056;
  // At the aisle corners the stopping point follows the approach lane,
  // keeping enough straight length for the car to finish its turn.
  if([690,872,1056].includes(pz))px=Math.max(894,Math.min(1474,px));
  const p=at(px,pz),edge=plan.edges.find(e=>{
   const a=plan.nodes.find(n=>n.id===e.from),b=plan.nodes.find(n=>n.id===e.to);
   return Math.abs(Math.hypot(p.x-a.x,p.z-a.z)+Math.hypot(p.x-b.x,p.z-b.z)-Math.hypot(b.x-a.x,b.z-a.z))<1e-6;
  });
  if(!edge)throw Error('Unconnected B2 bay '+s.id);
  let anchor=plan.nodes.find(n=>Math.hypot(n.x-p.x,n.z-p.z)<1e-5);
  if(!anchor){anchor=node('bay-'+s.id,px,pz,'junction',s.id+' 앞 차로');plan.nodes.push(anchor);}
  access.push({spaceId:s.id,nodeId:anchor.id,source:site.source,method:'source-reviewed-adjacent-lane',arrival:'aisle',surveyed:false});
 }
 const edges=[];
 for(const e of plan.edges){
  const a=plan.nodes.find(n=>n.id===e.from),b=plan.nodes.find(n=>n.id===e.to),length=Math.hypot(b.x-a.x,b.z-a.z);
  const chain=plan.nodes.filter(n=>Math.abs(Math.hypot(n.x-a.x,n.z-a.z)+Math.hypot(n.x-b.x,n.z-b.z)-length)<1e-6).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z));
  for(let i=1;i<chain.length;i++)edges.push({...e,id:e.id+'-'+i,from:chain[i-1].id,to:chain[i].id});
 }
 plan.edges=edges;plan.parkingAccess=access;
 plan.routingEvidence={source:site.source,method:'source-reviewed-aisle-centerlines',simplifyStraight:true,starts:['ramp-start'],note:'원본의 상·중·하 차로와 좌·우 연결 차로에서 각 주차면 앞까지 연결. 주차 구획·설비실·코어는 차로로 연결하지 않습니다.'};
 return plan;
}
