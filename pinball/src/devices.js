// All timings are simulation seconds. Devices never inspect identity or rank.
export const DEVICE_LAYOUT={
 neon:[['magnet',310,530],['cannon',310,1510]],
 orbit:[['magnet',310,1160],['cannon',105,1840]],
 zigzag:[['magnet',505,1150],['cannon',310,1320]],
 split:[['magnet',310,875],['cannon',310,1850]]
};
export function deviceDefinitions(mapId){return DEVICE_LAYOUT[mapId].map(([kind,x,y],i)=>({id:`${mapId}-${kind}-${i}`,kind,x,y,captureRadius:kind==='cannon'?18:15}));}
export function devicePose(device,time){
 const h=device.hold;if(!h)return {angle:device.restAngle??Math.PI/2,progress:0,holding:false};
 const progress=Math.max(0,Math.min(1,(time-h.start)/h.duration)),ease=progress*progress*(3-2*progress);
 return {angle:h.startAngle+(h.endAngle-h.startAngle)*ease,progress,holding:true};
}
export function attractDevices(race,ball,dt){
 if((ball.deviceCooldownUntil??0)>race.raceTime)return;
 for(const d of race.devices)if(d.kind==='magnet'&&!d.hold){
  const dx=d.x-ball.x,dy=d.y-ball.y,distance=Math.hypot(dx,dy);
  if(distance>1&&distance<70){const force=340*(1-distance/90);ball.vx+=dx/distance*force*dt;ball.vy+=dy/distance*force*dt;}
 }
}
export function holdDevices(race,ball){
 const h=ball.hold;if(!h)return false;
 if(race.raceTime<h.releaseAt){ball.vx=0;ball.vy=0;return true;}
 const d=race.devices.find(d=>d.id===h.deviceId),angle=h.endAngle;
 ball.hold=null;d.hold=null;d.restAngle=angle;d.releasedAt=race.raceTime;ball.deviceCooldownUntil=race.raceTime+2;
 if(d.kind==='cannon'){ball.vx=Math.cos(angle)*740;ball.vy=Math.sin(angle)*740;ball.boostUntil=race.raceTime+.55;}
 else{ball.vx=h.savedVx*.22;ball.vy=Math.max(60,h.savedVy*.22);}
 ball.anchorX=ball.x;ball.anchorY=ball.y;ball.progressY=ball.y;ball.stuckTime=0;ball.progressTime=0;
 race.emit({type:d.kind==='cannon'?'launch':'release',kind:d.kind,deviceId:d.id,ballId:ball.id,x:ball.x,y:ball.y,time:race.raceTime,heldFor:race.raceTime-h.start,angle});
 return false;
}
export function captureDevices(race,ball){
 if(ball.hold||(ball.deviceCooldownUntil??0)>race.raceTime)return;
 for(const d of race.devices){
  if(d.hold||Math.hypot(ball.x-d.x,ball.y-d.y)>d.captureRadius)continue;
  const duration=.5+race.rng()*(.5-1/120),startAngle=d.restAngle??Math.PI/2;
  const target=d.kind==='cannon'?Math.PI*(.16+race.rng()*.68):Math.PI/2;
  const direction=d.kind==='cannon'?(race.rng()<.5?-1:1):0;
  const h={deviceId:d.id,kind:d.kind,ballId:ball.id,start:race.raceTime,duration,releaseAt:race.raceTime+duration,startAngle,endAngle:target+direction*Math.PI*2,savedVx:ball.vx,savedVy:ball.vy};
  // Capture where physical contact happened, with no position teleport.
  ball.hold=h;d.hold=h;ball.vx=0;ball.vy=0;ball.stuckTime=0;ball.progressTime=0;
  race.emit({type:'capture',kind:d.kind,deviceId:d.id,ballId:ball.id,x:ball.x,y:ball.y,time:race.raceTime,duration});return;
 }
}
