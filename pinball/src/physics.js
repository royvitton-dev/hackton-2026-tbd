import {boardMotionAt} from './board-motion.js';
export const MAX_BALLS=60, STEP=1/120, RADIUS=10;
export const COLORS=['#c6ff58','#bca7ff','#ff82af','#64e4e0','#ffc168','#8daaff','#edeeed','#ff826c'];
export const MAP={width:620,height:1060,finish:990,left:30,right:590,gate:218,
 pins:Array.from({length:4},(_,row)=>Array.from({length:row%2?7:8},(_,col)=>({x:70+col*68+(row%2?34:0),y:300+row*61,r:8}))).flat(),
 bumpers:[{x:165,y:590,r:31},{x:455,y:590,r:31},{x:310,y:638,r:35}],
 rails:[{ax:30,ay:765,bx:210,by:868,r:9},{ax:590,ay:765,bx:410,by:868,r:9},{ax:267,ay:890,bx:285,by:944,r:8},{ax:353,ay:890,bx:335,by:944,r:8}],
 rotors:[{x:166,y:715,length:65,omega:1.35,phase:.2},{x:454,y:715,length:65,omega:-1.35,phase:1.4}]};
export const MAPS=[
 {...MAP,id:'neon',name:'NEON DROP',subtitle:'핀 숲',accent:'#bca7ff',surface:'#302343',description:'촘촘한 핀을 지나 회전 게이트로'},
 {...MAP,id:'orbit',name:'ORBIT CLUB',subtitle:'원형 범퍼',accent:'#ffad75',surface:'#382a31',pins:[{x:310,y:302,r:9},{x:100,y:448,r:9},{x:520,y:448,r:9},{x:220,y:730,r:9},{x:400,y:730,r:9}],bumpers:[{x:200,y:360,r:44},{x:420,y:360,r:44},{x:310,y:520,r:54},{x:140,y:640,r:35},{x:480,y:640,r:35},{x:310,y:838,r:30}],rotors:[{x:190,y:775,length:55,omega:1.1,phase:0},{x:430,y:775,length:55,omega:-1.1,phase:1}],rails:[{ax:30,ay:840,bx:165,by:926,r:8},{ax:590,ay:840,bx:455,by:926,r:8}],description:'둥근 범퍼 사이로 튀어 오르는 궤도'},
 {...MAP,id:'zigzag',name:'SWITCHBACK',subtitle:'지그재그 통로',accent:'#64e4e0',surface:'#203739',pins:[{x:490,y:410,r:9},{x:125,y:575,r:9},{x:490,y:740,r:9}],bumpers:[{x:270,y:436,r:24},{x:350,y:615,r:24}],rotors:[{x:320,y:893,length:75,omega:1.2,phase:0}],rails:[{ax:30,ay:280,bx:435,by:380,r:9},{ax:590,ay:460,bx:185,by:560,r:9},{ax:30,ay:640,bx:435,by:740,r:9}],description:'세 번 꺾이는 긴 경사와 마지막 회전문'},
 {...MAP,id:'split',name:'FORK & FLOW',subtitle:'갈림길',accent:'#ff82af',surface:'#382239',pins:[{x:145,y:345,r:9},{x:475,y:345,r:9},{x:310,y:565,r:10},{x:180,y:655,r:9},{x:440,y:655,r:9},{x:265,y:810,r:8},{x:355,y:810,r:8}],bumpers:[{x:150,y:500,r:36},{x:470,y:500,r:36},{x:310,y:735,r:38}],rotors:[{x:160,y:835,length:57,omega:1.8,phase:1},{x:460,y:835,length:57,omega:-1.8,phase:0}],rails:[{ax:310,ay:285,bx:230,by:430,r:9},{ax:310,ay:285,bx:390,by:430,r:9},{ax:230,ay:430,bx:310,by:515,r:9},{ax:390,ay:430,bx:310,by:515,r:9},{ax:30,ay:600,bx:125,by:695,r:8},{ax:590,ay:600,bx:495,by:695,r:8}],description:'둘로 나뉜 길, 다시 만나는 결승선'}
];
// Each course has three acts, with distinct physical geometry in the second half.
const extraCourses={
 neon:{pins:Array.from({length:3},(_,r)=>Array.from({length:7},(_,i)=>({x:95+i*70+(r%2?22:0),y:1030+r*62,r:9}))).flat(),bumpers:[{x:200,y:1410,r:42},{x:420,y:1410,r:42},{x:310,y:1590,r:35}],rotors:[{x:155,y:1260,length:74,omega:1.45,phase:0},{x:465,y:1260,length:74,omega:-1.45,phase:1},{x:310,y:1770,length:95,omega:1.25,phase:0}],rails:[{ax:30,ay:1460,bx:140,by:1550,r:9},{ax:590,ay:1460,bx:480,by:1550,r:9},{ax:30,ay:1850,bx:245,by:1970,r:10},{ax:590,ay:1850,bx:375,by:1970,r:10}],sliders:[{x:310,y:1190,length:58,amplitude:150,omega:.9,phase:0},{x:310,y:1680,length:62,amplitude:160,omega:1.2,phase:1}]},
 orbit:{pins:[{x:85,y:1190,r:10},{x:535,y:1190,r:10},{x:310,y:1390,r:10},{x:215,y:1880,r:9},{x:405,y:1880,r:9}],bumpers:[{x:195,y:1090,r:50},{x:425,y:1090,r:50},{x:310,y:1295,r:62},{x:135,y:1485,r:38},{x:485,y:1485,r:38},{x:220,y:1765,r:43},{x:400,y:1765,r:43}],rotors:[{x:310,y:1570,length:100,omega:1.35,phase:0},{x:310,y:1970,length:73,omega:-1.5,phase:1}],rails:[{ax:30,ay:1640,bx:155,by:1710,r:9},{ax:590,ay:1640,bx:465,by:1710,r:9}],sliders:[{x:310,y:940,length:66,amplitude:130,omega:1.1,phase:0},{x:310,y:1430,length:60,amplitude:160,omega:1.25,phase:1},{x:310,y:1880,length:70,amplitude:130,omega:.85,phase:0}]},
 zigzag:{pins:[{x:110,y:950,r:9},{x:505,y:1125,r:9},{x:110,y:1320,r:9},{x:505,y:1510,r:9},{x:230,y:1850,r:10},{x:390,y:1850,r:10}],bumpers:[{x:510,y:1055,r:24},{x:510,y:1435,r:24},{x:310,y:1800,r:32}],rotors:[{x:310,y:1655,length:80,omega:-1.4,phase:1},{x:310,y:1985,length:75,omega:1.4,phase:0}],rails:[{ax:590,ay:825,bx:185,by:925,r:9},{ax:30,ay:1010,bx:435,by:1110,r:9},{ax:590,ay:1195,bx:185,by:1295,r:9},{ax:30,ay:1380,bx:435,by:1480,r:9}],sliders:[{x:310,y:1560,length:55,amplitude:150,omega:1.1,phase:0}]},
 split:{pins:[{x:140,y:1040,r:10},{x:480,y:1040,r:10},{x:150,y:1340,r:10},{x:470,y:1340,r:10},{x:210,y:1720,r:10},{x:410,y:1720,r:10}],bumpers:[{x:135,y:1220,r:34},{x:485,y:1220,r:34},{x:310,y:1610,r:42},{x:190,y:1880,r:31},{x:430,y:1880,r:31}],rotors:[{x:310,y:1050,length:80,omega:1.7,phase:0},{x:160,y:1510,length:62,omega:1.5,phase:0},{x:460,y:1510,length:62,omega:-1.5,phase:1}],rails:[{ax:310,ay:1140,bx:230,by:1300,r:9},{ax:310,ay:1140,bx:390,by:1300,r:9},{ax:230,ay:1300,bx:310,by:1440,r:9},{ax:390,ay:1300,bx:310,by:1440,r:9},{ax:30,ay:1640,bx:130,by:1720,r:9},{ax:590,ay:1640,bx:490,by:1720,r:9},{ax:30,ay:1940,bx:230,by:2030,r:9},{ax:590,ay:1940,bx:390,by:2030,r:9}],sliders:[{x:310,y:950,length:65,amplitude:155,omega:1.2,phase:0},{x:310,y:1770,length:60,amplitude:175,omega:1.1,phase:1}]}
};
for(const map of MAPS){const extra=extraCourses[map.id];map.height=2240;map.finish=2150;map.sliders=extra.sliders;for(const key of ['pins','bumpers','rails','rotors'])map[key].push(...extra[key]);}
// The short-course rotor in switchback is replaced by its fourth ramp.
MAPS.find(m=>m.id==='zigzag').rotors=MAPS.find(m=>m.id==='zigzag').rotors.filter(r=>r.y!==893);
// Distinct, fixed speeds per ride: both directions, no dependence on participants.
const rideSpeeds={neon:[.79,-1.13,1.49,-.94,1.72],orbit:[1.07,-1.56,.73,-1.31],zigzag:[-.86,1.39],split:[1.42,-.78,1.14,-1.63,.95]};
for(const map of MAPS)map.rotors.forEach((r,i)=>{r.omega=rideSpeeds[map.id][i];});
// Four real exit throats. Sloping divider rails prevent a flat dead zone between holes.
for(const map of MAPS){
 map.exits=[100,240,380,520].map((x,i)=>({id:i+1,x,width:64}));
 map.rails.push({ax:30,ay:2040,bx:68,by:2120,r:8},{ax:552,ay:2120,bx:590,by:2040,r:8});
 for(let i=0;i<3;i++){const left=map.exits[i].x+32,right=map.exits[i+1].x-32,mid=(left+right)/2;map.rails.push({ax:left,ay:2120,bx:mid,by:2055,r:8},{ax:mid,ay:2055,bx:right,by:2120,r:8});}
 for(const hole of map.exits)map.rails.push({ax:hole.x-32,ay:2120,bx:hole.x-32,by:2178,r:8},{ax:hole.x+32,ay:2120,bx:hole.x+32,by:2178,r:8});
}
export const SAMPLE_NAMES=['하늘','지우','민준','서연','도윤','수빈','지호','예린','우진','다은','시우','소윤','준서','하린','건우','유나','현우','채원','지안','태오'];
export function integer(value,min,max,label){const s=String(value).trim();if(!/^\d+$/.test(s)||!Number.isSafeInteger(+s)||+s<min||+s>max)throw new Error(`${label}: ${min}~${max} 사이 정수를 입력해 주세요.`);return +s;}
export function parseParticipants(text,defaultCount=1,overrides={}){
 const count=integer(defaultCount,1,10,'기본 공 개수');if(text.length>6000)throw new Error('입력은 전체 6,000자까지 가능합니다.');
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length)throw new Error('참가자를 한 명 이상 입력해 주세요.');if(lines.length>60)throw new Error('참가자는 최대 60명입니다.');
 const seen=new Map();const people=lines.map((line,i)=>{const parts=line.split('|');if(parts.length>2)throw new Error(`${i+1}번째 줄: 이름 | 공 개수 형식을 확인해 주세요.`);const name=parts[0].trim();if(!name||[...name].length>40)throw new Error(`${i+1}번째 이름은 1~40자로 입력해 주세요.`);if(/[\u0000-\u001f\u007f]/.test(name))throw new Error('이름에 제어 문자를 사용할 수 없습니다.');const n=integer(overrides[i]??parts[1]?.trim()??count,1,10,`${i+1}번째 공 개수`);const occurrence=(seen.get(name)||0)+1;seen.set(name,occurrence);return {id:`p${i+1}`,name,label:name+(occurrence>1?` (${occurrence})`:''),count:n,color:COLORS[i%COLORS.length]};});
 const total=people.reduce((s,p)=>s+p.count,0);if(total>MAX_BALLS)throw new Error(`공은 합계 ${MAX_BALLS}개까지 가능합니다. 현재 ${total}개예요.`);return people;
}
export function makeConfig(text,defaultCount,rule,nth,overrides){const people=parseParticipants(text,defaultCount,overrides);const total=people.reduce((s,p)=>s+p.count,0);if(!['first','last','nth'].includes(rule))throw new Error('당첨 규칙을 선택해 주세요.');return {people,total,rule,target:rule==='first'?1:rule==='last'?total:integer(nth,1,total,'당첨 순위')};}
export function randomSeed(){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];}
export function seededRandom(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Race {
 constructor(config,seed=randomSeed()){
  this.map=MAPS.find(m=>m.id===config.mapId)??MAPS[0];
  this.config=structuredClone(config);this.seed=seed;this.rng=seededRandom(seed);this.state='ready';this.elapsed=0;this.raceTime=0;this.finishOrder=[];this.events=[];this.winner=null;this.assists=0;this.lastMotionCycle=-1;this.roundId=globalThis.crypto?.randomUUID?.()??String(seed);this.phaseTime=0;this.resumeState=null;this.rotationTime=0;this.stats={steps:0,collisions:0,maxPenetration:0};
  const entries=[];for(const p of this.config.people)for(let i=0;i<p.count;i++)entries.push({id:`${p.id}-b${i+1}`,participantId:p.id,name:p.name,label:p.label,color:p.color,number:i+1});shuffle(entries,this.rng);
  const slots=shuffle(Array.from({length:60},(_,i)=>({x:62+(i%10)*55,y:54+Math.floor(i/10)*27})),this.rng);
  this.balls=entries.map((b,i)=>({...b,x:slots[i].x,y:slots[i].y,vx:(this.rng()-.5)*100,vy:(this.rng()-.5)*50,r:RADIUS,finished:false,rank:null,stuckTime:0,progressTime:0,progressY:slots[i].y,anchorX:slots[i].x,anchorY:slots[i].y,assistCount:0,tieKey:this.rng()}));
 }
 start(){if(this.state!=='ready')return false;this.state='mixing';this.phaseTime=0;return true;}
 pause(){if(!['mixing','countdown','racing'].includes(this.state))return false;this.resumeState=this.state;this.state='paused';return true;}
 resume(){if(this.state!=='paused')return false;this.state=this.resumeState;this.resumeState=null;return true;}
 emit(event){this.events.push(event);if(this.events.length>200)this.events.shift();}
 motion(){return boardMotionAt(this.raceTime,this.seed,this.config.boardMotion===true);}
 sliderSegments(){return (this.map.sliders??[]).map(s=>{const phase=this.rotationTime*s.omega+s.phase,x=s.x+Math.sin(phase)*s.amplitude;return {...s,ax:x-s.length,ay:s.y,bx:x+s.length,by:s.y,r:10,svx:Math.cos(phase)*s.amplitude*s.omega,svy:0};});}
 rotorSegments(){return this.map.rotors.map(o=>{const a=o.phase+this.rotationTime*o.omega;return {...o,ax:o.x-Math.cos(a)*o.length,ay:o.y-Math.sin(a)*o.length,bx:o.x+Math.cos(a)*o.length,by:o.y+Math.sin(a)*o.length,r:9};});}
 step(dt=STEP){
  if(!['mixing','countdown','racing'].includes(this.state))return;
  // Public stepping is bounded too: no giant timestep can tunnel through the board.
  let remaining=Math.min(Math.max(dt,0),.1);while(remaining>1e-9){const h=Math.min(STEP,remaining);this.integrate(h);remaining-=h;}
 }
 integrate(dt){
  this.stats.steps++;this.elapsed+=dt;this.phaseTime+=dt;const racing=this.state==='racing';this.rotationTime+=dt;
  if(this.state==='mixing'&&this.phaseTime>=1.8){this.state='countdown';this.phaseTime=0;}
  if(this.state==='countdown'&&this.phaseTime>=3){this.state='racing';this.phaseTime=0;this.emit({type:'gate'});}
  if(racing)this.raceTime+=dt;
  const motion=this.motion();
  if(racing&&motion.active&&motion.cycle!==this.lastMotionCycle){this.lastMotionCycle=motion.cycle;this.emit({type:'board-motion',axis:motion.axis,cycle:motion.cycle,time:this.raceTime});}
  const active=this.balls.filter(b=>!b.finished),rotors=this.rotorSegments(),sliders=this.sliderSegments();const crossing=[];
  for(const b of active){b.prevX=b.x;b.prevY=b.y;
   if(!racing){b.vx+=Math.sin(this.elapsed*5+b.tieKey*18)*430*dt;b.vy+=Math.cos(this.elapsed*4+b.tieKey*13)*290*dt;}else{b.vx+=motion.forceX*dt;b.vy+=(255+motion.forceY)*dt;}
   b.vx*=Math.exp(-.09*dt);b.vy*=Math.exp(-.04*dt);const speed=Math.hypot(b.vx,b.vy);if(speed>560){b.vx*=560/speed;b.vy*=560/speed;}
   b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  // Iterative positional solving: equal radius and mass for every marble.
  for(let iteration=0;iteration<4;iteration++){
   for(const b of active){
    this.boundaries(b,racing);
    if(racing){for(const p of this.map.pins)this.circle(b,p,.78);for(const p of this.map.bumpers)this.circle(b,p,1.12);for(const s of this.map.rails)this.segment(b,s,.55);for(const s of rotors)this.segment(b,s,.65);for(const s of sliders)this.segment(b,s,.65);}
   }
   for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)this.pair(active[i],active[j]);
  }
  for(const b of active){this.boundaries(b,racing);
   if(!Number.isFinite(b.x+b.y+b.vx+b.vy)){this.state='invalid';this.winner=null;this.emit({type:'invalid',reason:'물리 상태 오류'});return;}
   if(racing){
    if(b.prevY<this.map.finish&&b.y>=this.map.finish){const fraction=(this.map.finish-b.prevY)/(b.y-b.prevY),crossX=b.prevX+(b.x-b.prevX)*fraction;const exit=this.map.exits.find(h=>Math.abs(crossX-h.x)<=h.width/2-b.r);if(exit)crossing.push({b,time:this.raceTime-dt+dt*fraction,exitId:exit.id});else{b.y=this.map.finish-.01;b.vy=-Math.abs(b.vy)*.55;}}
    const moved=Math.hypot(b.x-b.anchorX,b.y-b.anchorY);if(moved>20){b.anchorX=b.x;b.anchorY=b.y;b.stuckTime=0;}else b.stuckTime+=dt;
    if(b.y>b.progressY+24){b.progressY=b.y;b.progressTime=0;}else b.progressTime+=dt;
    if(b.stuckTime>4.5||b.progressTime>8.5){b.vx+=(this.rng()<.5?-1:1)*150;b.vy-=145;b.stuckTime=0;b.progressTime=0;b.progressY=b.y;b.assistCount++;this.assists++;this.emit({type:'assist',id:b.id,time:this.raceTime});}
   }
  }
  // No pre-selected outcome. Substep crossing time defines order; pre-shuffled key breaks exact ties.
  crossing.sort((a,b)=>a.time-b.time||a.b.tieKey-b.b.tieKey||a.b.id.localeCompare(b.b.id));
  for(const c of crossing)this.finish(c.b,c.time,c.exitId);
  if(this.finishOrder.length===this.balls.length){this.state='complete';this.emit({type:'complete'});}
  else if(this.raceTime>=90){this.state='invalid';this.winner=null;this.emit({type:'invalid',reason:'90초 진행 제한'});}
 }
 boundaries(b,racing){
  if(b.x<this.map.left+b.r){b.x=this.map.left+b.r;b.vx=Math.abs(b.vx)*.7;}
  if(b.x>this.map.right-b.r){b.x=this.map.right-b.r;b.vx=-Math.abs(b.vx)*.7;}
  if(b.y<28+b.r){b.y=28+b.r;b.vy=Math.abs(b.vy)*.65;}
  if(!racing&&b.y>this.map.gate-b.r){b.y=this.map.gate-b.r;b.vy=-Math.abs(b.vy)*.7;}
 }
 circle(b,p,e){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),min=b.r+p.r;if(d>=min)return;const nx=d>1e-7?dx/d:1,ny=d>1e-7?dy/d:0;this.contact(b,nx,ny,min-d,e,0,0,p.r>20?'bumper':'pin',p);}
 segment(b,s,e){const dx=s.bx-s.ax,dy=s.by-s.ay,t=clamp(((b.x-s.ax)*dx+(b.y-s.ay)*dy)/(dx*dx+dy*dy),0,1);const x=s.ax+t*dx,y=s.ay+t*dy;const bx=b.x-x,by=b.y-y,d=Math.hypot(bx,by),min=b.r+s.r;if(d>=min)return;const nx=d>1e-7?bx/d:-dy/Math.hypot(dx,dy),ny=d>1e-7?by/d:dx/Math.hypot(dx,dy);this.contact(b,nx,ny,min-d,e,s.svx??(s.omega?-s.omega*(y-s.y):0),s.svy??(s.omega?s.omega*(x-s.x):0));}
 contact(b,nx,ny,penetration,e,svx,svy,kind='rail',obstacle=null){b.x+=nx*penetration;b.y+=ny*penetration;const v=(b.vx-svx)*nx+(b.vy-svy)*ny;if(v<0){b.vx-=(1+e)*v*nx;b.vy-=(1+e)*v*ny;this.stats.collisions++;if(-v>80)this.emit({type:'hit',speed:-v,ballId:b.id,x:b.x-nx*b.r,y:b.y-ny*b.r,kind,obstacleX:obstacle?.x,obstacleY:obstacle?.y});}this.stats.maxPenetration=Math.max(this.stats.maxPenetration,penetration);}
 pair(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d>=min)return;const nx=d>1e-7?dx/d:1,ny=d>1e-7?dy/d:0,p=(min-d)/2;a.x-=nx*p;a.y-=ny*p;b.x+=nx*p;b.y+=ny*p;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-(1+.6)*v/2;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
 finish(b,time,exitId=null){if(b.finished)return false;b.finished=true;b.y=this.map.finish;b.rank=this.finishOrder.length+1;b.time=time;b.vx=0;b.vy=0;const result={id:b.id,participantId:b.participantId,name:b.name,label:b.label,color:b.color,number:b.number,rank:b.rank,time,exitId};this.finishOrder.push(result);if(b.rank===this.config.target){this.winner=result;this.emit({type:'winner',result});}this.emit({type:'finish',result});return true;}
 snapshot(){return {roundId:this.roundId,state:this.state,seed:this.seed,time:this.raceTime,target:this.config.target,total:this.balls.length,winner:this.winner,finishOrder:this.finishOrder.map(r=>({...r})),assists:this.assists,motion:this.motion(),balls:this.balls.map(b=>({id:b.id,x:b.x,y:b.y,finished:b.finished,rank:b.rank}))};}
}
