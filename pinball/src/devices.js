// All timings are simulation seconds. Devices never inspect identity or rank.
export const DEVICE_LAYOUT={
 neon:[['magnet',310,530],['magnet',100,1770],['cannon',310,1320],['cannon',310,1510]],
 orbit:[['magnet',310,1160],['magnet',540,1760],['cannon',310,680],['cannon',310,1730]],
 zigzag:[['magnet',505,1150],['magnet',110,1750],['cannon',310,780],['cannon',310,1320]],
 split:[['magnet',310,875],['magnet',90,1820],['cannon',310,1500],['cannon',310,1850]]
};
export function deviceDefinitions(mapId){return DEVICE_LAYOUT[mapId].map(([kind,x,y],i)=>({id:`${mapId}-${kind}-${i}`,kind,x,y,captureRadius:kind==='cannon'?18:15}));}
export function devicePose(device,time){
 const holds=device.holds??[],holding=holds.length>0;
 const angle=holding&&device.kind==='cannon'?Math.PI/2+Math.sin((time-device.spinStarted)*device.omega+device.phase)*1.05:device.restAngle??Math.PI/2;
 const next=holds.reduce((best,h)=>!best||h.releaseAt<best.releaseAt?h:best,null);
 return {angle,progress:next?Math.max(0,Math.min(1,(time-next.start)/next.duration)):0,holding,count:holds.length};
}
export function attractDevices(race,ball,dt){
 if((ball.deviceCooldownUntil??0)>race.raceTime)return;
 for(const d of race.devices)if(d.kind==='magnet'){
  const dx=d.x-ball.x,dy=d.y-ball.y,distance=Math.hypot(dx,dy);
  if(distance>1&&distance<70){const force=340*(1-distance/90);ball.vx+=dx/distance*force*dt;ball.vy+=dy/distance*force*dt;}
 }
}
export function holdDevices(race,ball){
 const h=ball.hold;if(!h)return false;
 if(race.raceTime<h.releaseAt){ball.vx=0;ball.vy=0;return true;}
 const d=race.devices.find(d=>d.id===h.deviceId),angle=devicePose(d,race.raceTime).angle;
 ball.hold=null;d.holds=d.holds.filter(hold=>hold.ballId!==ball.id);d.restAngle=angle;d.releasedAt=race.raceTime;ball.deviceCooldownUntil=race.raceTime+2;
 if(d.kind==='cannon'){ball.vx=Math.cos(angle)*740;ball.vy=Math.sin(angle)*740;ball.boostUntil=race.raceTime+.55;}
 else{ball.vx=h.savedVx*.22;ball.vy=Math.max(60,h.savedVy*.22);}
 ball.anchorX=ball.x;ball.anchorY=ball.y;ball.progressY=ball.y;ball.stuckTime=0;ball.progressTime=0;
 race.emit({type:d.kind==='cannon'?'launch':'release',kind:d.kind,deviceId:d.id,ballId:ball.id,x:ball.x,y:ball.y,time:race.raceTime,heldFor:race.raceTime-h.start,angle});
 return false;
}
export function captureDevices(race,ball){
 if(ball.hold||(ball.deviceCooldownUntil??0)>race.raceTime)return;
 for(const d of race.devices){
  if(Math.hypot(ball.x-d.x,ball.y-d.y)>d.captureRadius)continue;
  const duration=.5+race.rng()*(.5-1/120);
  const h={deviceId:d.id,kind:d.kind,ballId:ball.id,start:race.raceTime,duration,releaseAt:race.raceTime+duration,savedVx:ball.vx,savedVy:ball.vy};
  if(!d.holds.length)d.spinStarted=race.raceTime;
  // Captured balls are suspended or stored above the board plane, so incoming
  // balls can enter the same device. Each stored ball owns its release timer.
  ball.hold=h;d.holds.push(h);ball.vx=0;ball.vy=0;ball.stuckTime=0;ball.progressTime=0;
  race.emit({type:'capture',kind:d.kind,deviceId:d.id,ballId:ball.id,x:ball.x,y:ball.y,time:race.raceTime,duration});return;
 }
}
