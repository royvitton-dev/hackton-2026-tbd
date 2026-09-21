// A shared, deterministic ride motion. It never inspects names, ranks or winners.
export const MOTION_START=7, MOTION_PERIOD=9, MOTION_DURATION=1.8;
export function boardMotionAt(time,seed,enabled=false){
 const idle={enabled,active:false,axis:null,cycle:-1,phase:0,roll:0,pitch:0,offsetX:0,offsetY:0,forceX:0,forceY:0,nextIn:Math.max(0,MOTION_START-time)};
 if(!enabled||time<MOTION_START)return idle;
 const cycle=Math.floor((time-MOTION_START)/MOTION_PERIOD),local=time-MOTION_START-cycle*MOTION_PERIOD;
 if(local>=MOTION_DURATION)return {...idle,cycle,nextIn:MOTION_PERIOD-local};
 const phase=local/MOTION_DURATION,axis=((seed>>>0)+cycle)%2===0?'x':'y',sign=((seed>>>3)+cycle)%2?1:-1;
 const wave=Math.sin(phase*Math.PI*2)*Math.sin(phase*Math.PI)**2*sign;
 const tilt=wave*(axis==='x'?.04:.032),offset=wave*5;
 return {enabled,active:true,axis,cycle,phase,roll:axis==='x'?-tilt:0,pitch:axis==='y'?tilt:0,offsetX:axis==='x'?offset:0,offsetY:axis==='y'?offset:0,forceX:axis==='x'?tilt*1150:0,forceY:axis==='y'?tilt*1150:0,nextIn:0};
}
