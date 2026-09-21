import {returnPose} from './return-portals.js';
import {devicePose} from './devices.js';
import {MAPS} from './physics.js';
export class Renderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.width=760;this.height=1100;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=760*dpr;canvas.height=1100*dpr;this.ctx.scale(dpr,dpr);this.map=MAPS[0];this.cameraY=0;this.overview=false;this.halfView=false;canvas.style.objectFit="contain";this.lastRound=null;}
 project(x,y,z=0){return {x:380+(x-310)*(.83+Math.max(0,Math.min(y/this.map.height,1))*.17),y:32+(y-this.cameraY)*.9-z};}
 path(points,fill,stroke,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 line(ax,ay,bx,by,color,width,z=0){const c=this.ctx,a=this.project(ax,ay,z),b=this.project(bx,by,z);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=width;c.lineCap='round';c.strokeStyle=color;c.stroke();}
 disk(x,y,r,color,z=0,glow=false){const c=this.ctx,p=this.project(x,y,z),s=.83+y/1060*.17;
 c.save();c.fillStyle='#0007';c.beginPath();c.ellipse(p.x+7,p.y+z+7,r*s*1.15,r*.48,0,0,Math.PI*2);c.fill();
 if(glow){c.shadowColor=color;c.shadowBlur=20;}c.fillStyle='#111119';c.beginPath();c.ellipse(p.x,p.y+7,r*s,r*.80,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
 const g=c.createRadialGradient(p.x-r*.33,p.y-r*.4,1,p.x,p.y,r);g.addColorStop(0,'#fff');g.addColorStop(.2,color);g.addColorStop(.8,color);g.addColorStop(1,'#34303e');c.fillStyle=g;c.beginPath();c.ellipse(p.x,p.y,r*s,r*.8,0,0,Math.PI*2);c.fill();c.restore();}
 draw(race,reduced=false,selection=null){const c=this.ctx,map=race?.map??this.map;this.map=map;c.clearRect(0,0,760,1100);
 if(this.lastRound!==race.roundId){this.lastRound=race.roundId;this.cameraY=0;}
 const active=race.balls.filter(b=>!b.finished).sort((a,b)=>a.y-b.y);const progress=active[Math.floor(active.length*.7)]?.y??map.finish;
 const target=['ready','mixing','countdown'].includes(race.state)?0:Math.max(0,Math.min(map.height-1080,progress-550));
 if(race.state!=='paused')this.cameraY=reduced?target:this.cameraY+(target-this.cameraY)*.07;
 const savedCamera=this.cameraY;c.save();if(this.overview){this.cameraY=0;const scale=1060/map.height;c.translate(380,0);c.scale(scale,scale);c.translate(-380,0);}else if(this.halfView){const scale=1060/(map.height*.5*.9);c.translate(380,0);c.scale(scale,scale);c.translate(-380,0);}

 c.save();c.fillStyle='#0004';c.filter='blur(18px)';c.beginPath();c.ellipse(391,660,280,390,0,0,Math.PI*2);c.fill();c.restore();
 const corners=[[17,22],[603,22],[603,map.height-25],[17,map.height-25]],top=corners.map(([x,y])=>this.project(x,y)),bottom=corners.map(([x,y])=>this.project(x,y,-24));
 this.path([top[1],top[2],bottom[2],bottom[1]],'#17111f','#473254');this.path([top[2],top[3],bottom[3],bottom[2]],'#32243e','#564167');
 const g=c.createLinearGradient(0,30,0,1010);g.addColorStop(0,map.surface);g.addColorStop(1,'#171320');this.path(top,g,'#675372',3);
 for(let y=60;y<map.finish;y+=42)for(let x=48;x<590;x+=42){const p=this.project(x,y);c.fillStyle='#ffffff0b';c.fillRect(p.x,p.y,1.5,1.5);}
 for(const x of [25,595]){this.line(x,30,x,map.height-32,'#111019',18,-3);this.line(x,30,x,map.height-32,'#625074',11,7);this.line(x,30,x,map.height-32,map.accent,2,11);}
 this.line(25,26,595,26,'#887197',11,6);
 // Board graphics are part of the playable track, not a background screenshot.
 let p=this.project(310,253);
 for(const [y,text] of [[1000,'02 / THE TWIST'],[1750,'03 / LAST CHANCE']]){const q=this.project(310,y);c.textAlign='center';c.fillStyle=map.accent+'77';c.font='italic 800 18px sans-serif';c.fillText(text,q.x,q.y);}
c.textAlign='center';c.font='600 11px sans-serif';c.fillStyle='#a196b5';c.fillText('↓  LET IT ROLL  ↓',p.x,p.y);
 p=this.project(310,530);c.save();c.globalAlpha=.12;c.textAlign='center';c.font='italic 900 46px sans-serif';c.fillStyle=map.accent;c.fillText(map.id==='neon'?'GOOD LUCK':map.name,p.x,p.y);c.restore();
 for(const pin of map.pins)this.disk(pin.x,pin.y,pin.r,'#c2b8e1',9);
 for(const b of map.bumpers){this.disk(b.x,b.y,b.r+4,map.accent,5,true);this.disk(b.x,b.y,b.r-6,'#302941',14);p=this.project(b.x,b.y,14);c.fillStyle=map.accent;c.font='800 22px sans-serif';c.fillText('✦',p.x,p.y+7);}
 for(const s of map.rails){this.line(s.ax,s.ay,s.bx,s.by,'#0008',s.r*2+5,-8);this.line(s.ax,s.ay,s.bx,s.by,'#735887',s.r*2,8);this.line(s.ax,s.ay,s.bx,s.by,map.accent,3,13);}
 for(const s of race.returnGateSegments())this.line(s.ax,s.ay,s.bx,s.by,'#ffcf68',s.r*2,12);
 for(const s of race.rotorSegments()){this.line(s.ax,s.ay,s.bx,s.by,'#0008',25,-10);this.line(s.ax,s.ay,s.bx,s.by,'#258783',21,10);this.line(s.ax,s.ay,s.bx,s.by,'#77f1d9',12,16);this.disk(s.x,s.y,13,'#e5ffcd',21);}
 for(const slider of race.sliderSegments()) {this.line(slider.ax,slider.ay,slider.bx,slider.by,'#0008',26,-8);this.line(slider.ax,slider.ay,slider.bx,slider.by,'#bc7525',22,10);this.line(slider.ax,slider.ay,slider.bx,slider.by,'#ffd177',13,17);const q=this.project((slider.ax+slider.bx)/2,slider.y,17);c.fillStyle='#50331c';c.font='800 20px sans-serif';c.textAlign='center';c.fillText('↔',q.x,q.y+5);}
 for(const d of race.devices){const q=this.project(d.x,d.y),pose=devicePose(d,race.raceTime);c.save();c.strokeStyle=d.kind==='cannon'?'#ffc650':'#77e7ff';c.globalAlpha=pose.holding?.9:.4;c.lineWidth=3;c.beginPath();c.ellipse(q.x,q.y,28,22,0,0,Math.PI*2);c.stroke();c.restore();
  if(d.kind==='magnet'){this.disk(d.x-29,d.y,9,'#ff46a4',12);this.disk(d.x+29,d.y,9,'#36e4ff',12);c.font='bold 26px sans-serif';c.fillStyle='#9aeaff';c.fillText('U',q.x,q.y-10);}
  else{this.disk(d.x,d.y,20,'#ffd17a',4);this.line(d.x,d.y,d.x+Math.cos(pose.angle)*48,d.y+Math.sin(pose.angle)*48,'#8062d9',22,18);this.disk(d.x+Math.cos(pose.angle)*48,d.y+Math.sin(pose.angle)*48,11,'#33244a',18);}
 }
 const held=['ready' ,'mixing','countdown'].includes(race.state)||(race.state==='paused'&&race.resumeState!=='racing');
 if(held){this.line(32,map.gate,588,map.gate,'#100e15',15,2);this.line(32,map.gate,588,map.gate,map.accent,8,10);for(let x=50;x<590;x+=27)this.line(x,map.gate-3,x+9,map.gate+3,'#f4ecff',3,13);}
 // Only the physical goal throat can register a finish.
 for(const hole of map.exits){const p=this.project(hole.x,hole.y??map.finish);c.save();c.fillStyle=map.accent;c.shadowColor=map.accent;c.shadowBlur=15;c.beginPath();c.ellipse(p.x,p.y,hole.width/2-1,23,0,0,Math.PI*2);c.fill();c.shadowBlur=0;c.fillStyle='#05050b';c.beginPath();c.ellipse(p.x,p.y+1,hole.width/2-6,18,0,0,Math.PI*2);c.fill();c.fillStyle='#b1a8c4';c.font='700 15px sans-serif';c.textAlign='center';c.fillText(hole.kind==='return'?'BACK':'GOAL',p.x,p.y+38);c.restore();}
 p=this.project(310,map.finish-135);c.font='italic 800 16px sans-serif';c.fillStyle='#e6dfef';c.textAlign='center';c.fillText('F I N A L   D R O P',p.x,p.y);
 for(const b of [...race.balls].filter(b=>!b.finished).sort((a,b)=>a.y-b.y)){
  if(b.hold?.kind==='cannon')continue;const portal=returnPose(b,race.raceTime);if(portal&&!portal.visible)continue;
  if(!b.portal&&!reduced&&Math.hypot(b.vx,b.vy)>190)this.line(b.x-b.vx*.038,b.y-b.vy*.038,b.x,b.y,b.color+'55',6,9);
  p=this.project(b.x,b.y,portal?portal.height*60:10);if(selection===b.id){c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,18,0,Math.PI*2);c.stroke();}
  // A radial sphere highlight gives each equal physical marble a rounded appearance.
  const shade=c.createRadialGradient(p.x-4,p.y-5,1,p.x+2,p.y+3,13);shade.addColorStop(0,'#fff');shade.addColorStop(.22,b.color);shade.addColorStop(.72,b.color);shade.addColorStop(1,'#302433');
  c.fillStyle='#0006';c.beginPath();c.ellipse(p.x+5,p.y+14,12,5,0,0,Math.PI*2);c.fill();c.fillStyle=shade;c.beginPath();c.arc(p.x,p.y,12,0,Math.PI*2);c.fill();c.fillStyle='#fff9';c.beginPath();c.arc(p.x-4,p.y-5,2,0,Math.PI*2);c.fill();
  if(this.overview)continue;
  const label=[...b.label].slice(0,5).join('')+([...b.label].length>5?'…':'')+(race.config.people.find(v=>v.id===b.participantId)?.count>1?`·${b.number}`:'');const font=innerWidth<701?27:20;c.font=`600 ${font}px sans-serif`;const w=c.measureText(label).width;c.fillStyle='#131019d9';c.beginPath();c.roundRect(p.x-w/2-4,p.y-20-font,w+8,font+5,5);c.fill();c.fillStyle='#f5f0ff';c.fillText(label,p.x,p.y-18);
 }
 c.restore();this.cameraY=savedCamera;
 // A progress rail keeps off-screen marbles visible during camera follow.
 c.fillStyle='#30263e';c.beginPath();c.roundRect(730,55,7,940,4);c.fill();c.strokeStyle=map.accent+'aa';c.lineWidth=1;c.strokeRect(723,55+this.cameraY/map.height*940,21,1080/map.height*940);
 for(const b of race.balls){c.fillStyle=b.color;c.beginPath();c.arc(733,55+b.y/map.height*940,3,0,Math.PI*2);c.fill();}
 c.font='500 15px sans-serif';c.fillStyle='#b6a7ca';c.textAlign='center';c.fillText(this.overview?'전체 맵':this.halfView?'하프 모드 · 진행 구간 따라가기':`${Math.min(3,Math.floor((this.cameraY+500)/750)+1)} / 3 구간`,380,1070);c.textAlign='left';
 }
}
