// Follow the shortest arc, with a frame-rate independent ease and capped yaw speed.
export function dampHeading(current,target,delta){
 if(![current,target,delta].every(Number.isFinite)||delta<0)throw new Error('Invalid camera heading');
 const dt=Math.min(delta,.12),difference=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 const step=Math.min(Math.abs(difference)*(1-Math.exp(-6*dt)),1.9*dt);
 return current+Math.sign(difference)*step;
}
