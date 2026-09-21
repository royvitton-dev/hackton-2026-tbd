// Independent seeded schedule: never reads names/ranks or consumes the race RNG.
export const MOTION_MIN_GAP=3,MOTION_MAX_GAP=5,MOTION_DURATION=1.8;
const schedules=new Map();
export function motionSchedule(seed){
 const key=seed>>>0;if(schedules.has(key))return schedules.get(key);
 let state=(key^0x91e10da5)>>>0,time=0;const starts=[];
 while(time<100){state=(Math.imul(state,1664525)+1013904223)>>>0;time+=MOTION_MIN_GAP+state/4294967296*(MOTION_MAX_GAP-MOTION_MIN_GAP);starts.push(time);}
 const result=Object.freeze(starts);if(schedules.size>=64)schedules.delete(schedules.keys().next().value);schedules.set(key,result);return result;
}
export function boardMotionAt(time,seed,enabled=false){
 const starts=motionSchedule(seed),next=starts.findIndex(start=>start>time),cycle=next<0?starts.length-1:next-1,start=cycle<0?0:starts[cycle];
 const idle={enabled,active:false,axis:null,cycle,phase:0,roll:0,pitch:0,offsetX:0,offsetY:0,forceX:0,forceY:0,nextIn:next<0?0:Math.max(0,starts[next]-time)};
 if(!enabled||cycle<0||time-start>=MOTION_DURATION)return idle;
 const phase=(time-start)/MOTION_DURATION,sign=((seed>>>3)+cycle)%2?1:-1;
 const wave=Math.sin(phase*Math.PI*2)*Math.sin(phase*Math.PI)**2*sign,tilt=wave*.04;
 return {...idle,active:true,axis:'x',phase,roll:-tilt,offsetX:wave*5,forceX:tilt*1150,nextIn:0};
}
