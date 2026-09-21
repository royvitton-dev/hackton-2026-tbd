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
  this.config=structuredClone(config);this.seed=seed;this.rng=seededRandom(seed);this.state='ready';this.elapsed=0;this.raceTime=0;this.finishOrder=[];this.events=[];this.winner=null;this.assists=0;this.roundId=globalThis.crypto?.randomUUID?.()??String(seed);this.phaseTime=0;this.resumeState=null;this.rotationTime=0;this.stats={steps:0,collisions:0,maxPenetration:0};
  const entries=[];for(const p of this.config.people)for(let i=0;i<p.count;i++)entries.push({id:`${p.id}-b${i+1}`,participantId:p.id,name:p.name,label:p.label,color:p.color,number:i+1});shuffle(entries,this.rng);
  const slots=shuffle(Array.from({length:60},(_,i)=>({x:62+(i%10)*55,y:54+Math.floor(i/10)*27})),this.rng);
  this.balls=entries.map((b,i)=>({...b,x:slots[i].x,y:slots[i].y,vx:(this.rng()-.5)*100,vy:(this.rng()-.5)*50,r:RADIUS,finished:false,rank:null,stuckTime:0,anchorX:slots[i].x,anchorY:slots[i].y,assistCount:0,tieKey:this.rng()}));
 }
 start(){if(this.state!=='ready')return false;this.state='mixing';this.phaseTime=0;return true;}
 pause(){if(!['mixing','countdown','racing'].includes(this.state))return false;this.resumeState=this.state;this.state='paused';return true;}
 resume(){if(this.state!=='paused')return false;this.state=this.resumeState;this.resumeState=null;return true;}
 emit(event){this.events.push(event);if(this.events.length>200)this.events.shift();}
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
  const active=this.balls.filter(b=>!b.finished),rotors=this.rotorSegments();const crossing=[];
  for(const b of active){b.prevX=b.x;b.prevY=b.y;
   if(!racing){b.vx+=Math.sin(this.elapsed*5+b.tieKey*18)*430*dt;b.vy+=Math.cos(this.elapsed*4+b.tieKey*13)*290*dt;}else b.vy+=255*dt;
   b.vx*=Math.exp(-.09*dt);b.vy*=Math.exp(-.04*dt);const speed=Math.hypot(b.vx,b.vy);if(speed>560){b.vx*=560/speed;b.vy*=560/speed;}
   b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  // Iterative positional solving: equal radius and mass for every marble.
  for(let iteration=0;iteration<4;iteration++){
   for(const b of active){
    this.boundaries(b,racing);
    if(racing){for(const p of this.map.pins)this.circle(b,p,.78);for(const p of this.map.bumpers)this.circle(b,p,1.03);for(const s of this.map.rails)this.segment(b,s,.55);for(const s of rotors)this.segment(b,s,.65);}
   }
   for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)this.pair(active[i],active[j]);
  }
  for(const b of active){this.boundaries(b,racing);
   if(!Number.isFinite(b.x+b.y+b.vx+b.vy)){this.state='invalid';this.winner=null;this.emit({type:'invalid',reason:'물리 상태 오류'});return;}
   if(racing){
    if(b.prevY<this.map.finish&&b.y>=this.map.finish){crossing.push({b,time:this.raceTime-dt+dt*(this.map.finish-b.prevY)/(b.y-b.prevY)});}
    const moved=Math.hypot(b.x-b.anchorX,b.y-b.anchorY);if(moved>20){b.anchorX=b.x;b.anchorY=b.y;b.stuckTime=0;}else b.stuckTime+=dt;
    if(b.stuckTime>4.5){b.vx+=(this.rng()<.5?-1:1)*150;b.vy-=145;b.stuckTime=0;b.assistCount++;this.assists++;this.emit({type:'assist',id:b.id,time:this.raceTime});}
   }
  }
  // No pre-selected outcome. Substep crossing time defines order; pre-shuffled key breaks exact ties.
  crossing.sort((a,b)=>a.time-b.time||a.b.tieKey-b.b.tieKey||a.b.id.localeCompare(b.b.id));
  for(const c of crossing)this.finish(c.b,c.time);
  if(this.finishOrder.length===this.balls.length){this.state='complete';this.emit({type:'complete'});}
  else if(this.raceTime>=90){this.state='invalid';this.winner=null;this.emit({type:'invalid',reason:'90초 진행 제한'});}
 }
 boundaries(b,racing){
  if(b.x<this.map.left+b.r){b.x=this.map.left+b.r;b.vx=Math.abs(b.vx)*.7;}
  if(b.x>this.map.right-b.r){b.x=this.map.right-b.r;b.vx=-Math.abs(b.vx)*.7;}
  if(b.y<28+b.r){b.y=28+b.r;b.vy=Math.abs(b.vy)*.65;}
  if(!racing&&b.y>this.map.gate-b.r){b.y=this.map.gate-b.r;b.vy=-Math.abs(b.vy)*.7;}
 }
 circle(b,p,e){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),min=b.r+p.r;if(d>=min)return;const nx=d>1e-7?dx/d:1,ny=d>1e-7?dy/d:0;this.contact(b,nx,ny,min-d,e,0,0);}
 segment(b,s,e){const dx=s.bx-s.ax,dy=s.by-s.ay,t=clamp(((b.x-s.ax)*dx+(b.y-s.ay)*dy)/(dx*dx+dy*dy),0,1);const x=s.ax+t*dx,y=s.ay+t*dy;const bx=b.x-x,by=b.y-y,d=Math.hypot(bx,by),min=b.r+s.r;if(d>=min)return;const nx=d>1e-7?bx/d:-dy/Math.hypot(dx,dy),ny=d>1e-7?by/d:dx/Math.hypot(dx,dy);this.contact(b,nx,ny,min-d,e,s.omega?-s.omega*(y-s.y):0,s.omega?s.omega*(x-s.x):0);}
 contact(b,nx,ny,penetration,e,svx,svy){b.x+=nx*penetration;b.y+=ny*penetration;const v=(b.vx-svx)*nx+(b.vy-svy)*ny;if(v<0){b.vx-=(1+e)*v*nx;b.vy-=(1+e)*v*ny;this.stats.collisions++;if(-v>80)this.emit({type:'hit',speed:-v});}this.stats.maxPenetration=Math.max(this.stats.maxPenetration,penetration);}
 pair(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d>=min)return;const nx=d>1e-7?dx/d:1,ny=d>1e-7?dy/d:0,p=(min-d)/2;a.x-=nx*p;a.y-=ny*p;b.x+=nx*p;b.y+=ny*p;const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){const impulse=-(1+.6)*v/2;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}}
 finish(b,time){if(b.finished)return false;b.finished=true;b.y=this.map.finish;b.rank=this.finishOrder.length+1;b.time=time;b.vx=0;b.vy=0;const result={id:b.id,participantId:b.participantId,name:b.name,label:b.label,color:b.color,number:b.number,rank:b.rank,time};this.finishOrder.push(result);if(b.rank===this.config.target){this.winner=result;this.emit({type:'winner',result});}this.emit({type:'finish',result});return true;}
 snapshot(){return {roundId:this.roundId,state:this.state,seed:this.seed,time:this.raceTime,target:this.config.target,total:this.balls.length,winner:this.winner,finishOrder:this.finishOrder.map(r=>({...r})),assists:this.assists,balls:this.balls.map(b=>({id:b.id,x:b.x,y:b.y,finished:b.finished,rank:b.rank}))};}
}
