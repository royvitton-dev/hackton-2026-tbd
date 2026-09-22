import {pointAt} from './geometry.js';

export function drivingInput(keys){
 const held=(a,b)=>keys.has(a)||keys.has(b)?1:0;
 return {forward:held('w','arrowup')-held('s','arrowdown'),turn:held('a','arrowleft')-held('d','arrowright')};
}
export function turnSignal(path,travel,input=null){
 if(input)return input.turn>0?'left':input.turn<0?'right':null;
 if(!path||travel>=path.distance)return null;
 const p=pointAt(path,travel),a=pointAt(path,Math.max(0,travel-.6)),b=pointAt(path,Math.min(path.distance,travel+2.5));
 if((a.gear||1)!==(p.gear||1)||(b.gear||1)!==(p.gear||1))return null;
 const turn=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*(p.gear||1);
 return Math.abs(turn)<.035?null:turn>0?'left':'right';
}
// Vehicle nose is local +Z. Looking forward, the driver's right is local -X.
// Reverse gear changes travel direction, never the driver's viewing direction.
export function driverView(pose){
 const h=pose.heading||0,p=pose.pitch||0,sin=Math.sin(h),cos=Math.cos(h);
 const forward={x:sin*Math.cos(p),y:Math.sin(p),z:cos*Math.cos(p)};
 const position={x:pose.x+cos*.32-forward.x*.35,y:(pose.y||0)+1.35-forward.y*.35,z:pose.z-sin*.32-forward.z*.35};
 return {position,target:{x:position.x+forward.x*10,y:position.y+forward.y*10,z:position.z+forward.z*10},forward};
}
