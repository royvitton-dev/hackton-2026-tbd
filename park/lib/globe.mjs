export const PLANET_RADIUS = 24;
export function themeCoordinates(index){
 return [[37,-15],[38,96],[9,-2],[9,78],[-24,38]][index]
  || [24*Math.sin(index*2.4),((index*137.508+180)%360)-180];
}
export function surfacePoint(latitude,longitude,radius=PLANET_RADIUS){
 const lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;
 return [radius*Math.cos(lat)*Math.sin(lon),radius*Math.sin(lat),radius*Math.cos(lat)*Math.cos(lon)];
}
export function surfaceDrop(x,z,radius=PLANET_RADIUS){
 return Math.sqrt(Math.max(0,radius*radius-x*x-z*z))-radius;
}
// Absolute time makes both the perpetual show and golden captures deterministic.
export function fireworkPhase(time,index){
 const age=((time-index*1.35)%8+8)%8;
 if(age<1)return {stage:'launch',progress:age,opacity:1};
 if(age<3.8){const progress=(age-1)/2.8;return {stage:'burst',progress,opacity:Math.pow(1-progress,1.2)};}
 return {stage:'rest',progress:0,opacity:0};
}

export function gsFireworkPhase(time){
 const age=((time-2.7)%8+8)%8;
 if(age<.9)return {stage:'launch',progress:age/.9,opacity:1};
 if(age<2)return {stage:'form',progress:(age-.9)/1.1,opacity:1};
 if(age<3.6)return {stage:'hold',progress:(age-2)/1.6,opacity:1};
 if(age<5.5){const progress=(age-3.6)/1.9;return {stage:'fade',progress,opacity:Math.pow(1-progress,1.7)};}
 return {stage:'rest',progress:0,opacity:0};
}
