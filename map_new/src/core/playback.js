// Pause at every gear change even if a fast animation frame would cross it.
export function advanceRoute(path,state,dt,speed){
 const next={...state},shifts=path.gearChanges||[];
 let remaining=dt;
 if(next.pause>0){const used=Math.min(remaining,next.pause);next.pause-=used;remaining-=used;}
 while(remaining>1e-8&&next.travel<path.distance){
  const shift=shifts[next.shiftIndex||0],gear=next.gear||1,velocity=gear<0?(path.parking?.reverseSpeed||1.2):speed;
  const end=shift?.distance??path.distance,time=(end-next.travel)/velocity;
  if(remaining<time){next.travel+=remaining*velocity;break;}
  next.travel=end;remaining-=Math.max(0,time);
  if(!shift)break;
  next.gear=shift.gear;next.shiftIndex=(next.shiftIndex||0)+1;next.pause=path.parking?.shiftPauseSeconds||.8;
  const used=Math.min(remaining,next.pause);next.pause-=used;remaining-=used;
 }
 return next;
}
export function remainingSeconds(path,travel,speed){
 let elapsed=0,result=0;
 for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],d=Math.hypot(b.x-a.x,(b.y||0)-(a.y||0),b.z-a.z),left=Math.max(0,elapsed+d-Math.max(elapsed,travel));
  result+=left/(a.gear===-1?(path.parking?.reverseSpeed||1.2):speed);elapsed+=d;
 }
 return result+(path.gearChanges||[]).filter(s=>s.distance>travel).length*(path.parking?.shiftPauseSeconds||.8);
}
