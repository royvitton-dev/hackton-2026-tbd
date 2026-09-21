// Exact 2D footprint overlap for walls, structural objects and circular hazards.
function rectangle(x,z,width,depth,heading=0){
 const sin=Math.sin(heading),cos=Math.cos(heading);
 return [[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b])=>({x:x+cos*a*width/2+sin*b*depth/2,z:z-sin*a*width/2+cos*b*depth/2}));
}
function overlap(a,b){
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],axis={x:-(q.z-p.z),z:q.x-p.x};
  const aa=a.map(v=>v.x*axis.x+v.z*axis.z),bb=b.map(v=>v.x*axis.x+v.z*axis.z);
  if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false;
 }
 return true;
}
export function parkingBodyClear(plan,pose,vehicle,hazards=[]){
 const width=vehicle.width+2*vehicle.clearance,depth=vehicle.length+2*vehicle.clearance;
 const body=rectangle(pose.x,pose.z,width,depth,pose.heading),y=pose.y||0;
 const vertical=(bottom,height)=>bottom<y+vehicle.height&&bottom+height>y;
 for(const w of plan.walls){
  if(!vertical(w.y||0,w.height))continue;
  const length=Math.hypot(w.x2-w.x1,w.z2-w.z1);
  if(overlap(body,rectangle((w.x1+w.x2)/2,(w.z1+w.z2)/2,w.thickness,length,Math.atan2(w.x2-w.x1,w.z2-w.z1))))return false;
 }
 for(const o of plan.objects||[]){
  if(!['column','lift','stairs','door'].includes(o.kind)||!vertical(o.y||0,o.height))continue;
  if(overlap(body,rectangle(o.x,o.z,o.width,o.depth,o.angle||0)))return false;
 }
 for(const h of hazards){
  if(Math.abs(y-(h.y||0))>(h.verticalRadius??2))continue;
  const dx=h.x-pose.x,dz=h.z-pose.z,sin=Math.sin(pose.heading),cos=Math.cos(pose.heading);
  if(Math.hypot(Math.max(0,Math.abs(cos*dx-sin*dz)-width/2),Math.max(0,Math.abs(sin*dx+cos*dz)-depth/2))<=h.radius)return false;
 }
 return true;
}
