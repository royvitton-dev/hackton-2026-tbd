// A visible return portal is a game mechanic, never a finish or rescue shortcut.
export function beginReturn(race,ball,crossing){
 if(ball.portal||ball.finished)return;
 ball.x=crossing.x;ball.y=crossing.y;ball.vx=0;ball.vy=0;
 ball.portal={exitId:crossing.exitId,enteredAt:crossing.time,moveAt:crossing.time+.42,landAt:crossing.time+1.07,moved:false,launchVx:(race.rng()-.5)*150};
 ball.returnCount=(ball.returnCount??0)+1;race.returnCount++;
 race.emit({type:'return',ballId:ball.id,time:crossing.time,exitId:crossing.exitId});
}
export function advanceReturn(race,ball){
 const p=ball.portal;if(!p)return false;
 if(!p.moved&&race.raceTime>=p.moveAt){ball.x=race.map.returnPoint.x;ball.y=race.map.returnPoint.y;ball.prevX=ball.x;ball.prevY=ball.y;p.moved=true;}
 if(race.raceTime<p.landAt)return true;
 ball.portal=null;ball.vx=p.launchVx;ball.vy=70;ball.deviceCooldownUntil=race.raceTime+1;
 ball.anchorX=ball.x;ball.anchorY=ball.y;ball.progressY=ball.y;ball.stuckTime=0;ball.progressTime=0;
 race.emit({type:'return-land',ballId:ball.id,time:race.raceTime,x:ball.x,y:ball.y});return false;
}
export function returnPose(ball,time){
 const p=ball.portal;if(!p)return null;
 if(time<p.moveAt){const t=Math.max(0,Math.min(1,(time-p.enteredAt)/.42));return {height:.19-t*.85,scale:1-t*.75,visible:t<.95};}
 const t=Math.max(0,Math.min(1,(time-p.moveAt)/.65));return {height:.19+2*(1-t)*(1-t),scale:1,visible:true};
}

export const RETURN_CLOSE_TIME=60;
export function returnGateSegments(map,time){
 if(!map.returnPoint||time<RETURN_CLOSE_TIME)return [];
 return [{ax:310,ay:2000,bx:588,by:1940,r:9},{ax:310,ay:2000,bx:310,by:2055,r:9}];
}
