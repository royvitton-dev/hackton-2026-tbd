import * as THREE from 'three';
import {ParkScene} from '../park/src/scene.js';
import {loadDemos,paintDemo} from './tour-demo.js';

const W=1920,H=1080,OPENING=4,MODEL=2,FINALE=10;
const canvas=document.querySelector('#tour-film'),ctx=canvas.getContext('2d',{alpha:false});
const catalog=await fetch('/api/park').then(r=>r.json()),items=catalog.attractions;
const demos=await loadDemos(items);
const endStart=OPENING+items.reduce((sum,a)=>sum+MODEL+(demos[a.id].duration||6),0),duration=endStart+FINALE;
const GOLD='#efd09a',WHITE='#fff9ed',SERIF='Baskerville, Georgia, serif',SANS='"Apple SD Gothic Neo", Arial, sans-serif';
const summaries={
 dopamin:'커피 한 잔을 건, 짜릿한 범퍼카 레이스.',
 movie:'우리의 상상과 이야기를 한 편의 영화로.',
 voice:'목소리로 다음 아이디어를 시작하는 스테이지.',
 battery_health:'배터리 상태와 충전 습관을 살피는 EV 피트 스톱.',
 map:'서울의 도면을 3D로 탐험하는 설계 연구소.',
 map_new:'도로부터 주차면까지, 3D로 찾아가는 길.',
 pinball:'작은 공이 달리는, 행운 가득한 물리 레이스.',
 trading:'실시간 호가와 체결로 경험하는 모의 휴가 시장.',
};
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
let ready,failed;
const loaded=new Promise((resolve,reject)=>{ready=resolve;failed=reject;});
const world=new ParkScene(document.querySelector('#world'),{capture:true,video:document.createElement('video'),onReady:ready,onError:failed});
world.renderer.setAnimationLoop(null);world.controls.enabled=false;world.setQuality('balanced');world.setAttractions(items);
await loaded;await document.fonts.ready;await world.renderer.compileAsync(world.scene,world.camera);
let cursor=OPENING;
const chapters=[{id:'opening',name:'작은 별, 여덟 개의 모험',start:0,end:OPENING,summary:`${items.length}개의 모험이 연결되는 작은 별.`},
 ...items.map(a=>{const start=cursor,demoDuration=demos[a.id].duration||6;cursor+=MODEL+demoDuration;return {...a,start,end:cursor,demoStart:start+MODEL,demoDuration,segments:demos[a.id].segments,features:demos[a.id].features,summary:`${summaries[a.id]||a.description} ${demos[a.id].features.join(' · ')}.`};}),
 {id:'finale',name:'GS 폭죽 피날레',start:endStart,end:duration,summary:'우리의 상상이, 하나의 빛으로.'}];
chapters[0].name=`작은 별, ${items.length}개의 모험`;
const worldUp=new THREE.Vector3(0,1,0),transitionFrames=new Map();
function cameraAt(anchor,offset,target){
 anchor.updateWorldMatrix(true,false);
 world.camera.position.copy(anchor.localToWorld(new THREE.Vector3(...offset)));
 world.camera.up.copy(worldUp).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
 world.camera.lookAt(anchor.localToWorld(new THREE.Vector3(...target)));
}
function shotFor(t){return chapters.find(c=>t>=c.start&&t<c.end)||chapters.at(-1);}
function renderWorld(t){
 const shot=shotFor(t),local=t-shot.start,night=shot.id==='finale';
 if(world.night!==night)world.setNight(night);
 world.fireworks.root.visible=night;
 let simulationTime=5+t;
 if(shot.id==='opening'){
  const a=.58+local*.085,r=109-local*2.3;
  world.camera.up.copy(worldUp);world.camera.position.set(Math.sin(a)*r,48-local*1.2,Math.cos(a)*r);world.camera.lookAt(0,1,0);
 }else if(night){
  simulationTime=local;
  const p=ease(local/3),a=.31-local*.008;
  cameraAt(world.castleAnchor,[Math.sin(a)*(50-17*p),27-8*p,Math.cos(a)*(50-17*p)],[0,9.5+2*p,0]);
  world.bloom.strength=.58;
 }else{
  const index=items.findIndex(i=>i.id===shot.id),anchor=world.attractions[index].anchor;
  const p=local/(shot.end-shot.start),angle=.58-p*.2,r=20-p*1.7;
  cameraAt(anchor,[Math.sin(angle)*r,12-p,Math.cos(angle)*r],[0,2.1,0]);
 }
 world.animations.forEach(fn=>fn(simulationTime));world.attractions.forEach(a=>a.animation.forEach(fn=>fn(simulationTime)));
 world.camera.updateMatrixWorld();world.fireworks.faceCamera(world.camera);world.renderer.info.reset();world.composer.render();
 return {shot,local,simulationTime};
}
function text(value,x,y,size,color=WHITE,font=SANS,weight=500,align='left'){
 ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(value,x,y);ctx.textAlign='left';
}
function tracked(value,x,y,size=17,color=GOLD,spacing=3){
 ctx.font=`500 ${size}px ${SANS}`;ctx.fillStyle=color;ctx.textAlign='left';
 for(const ch of value){ctx.fillText(ch,x,y);x+=ctx.measureText(ch).width+spacing;}
}
function gradient(){
 let g=ctx.createLinearGradient(0,0,0,260);g.addColorStop(0,'#0612217a');g.addColorStop(1,'#06122100');ctx.fillStyle=g;ctx.fillRect(0,0,W,260);
 g=ctx.createLinearGradient(0,620,0,H);g.addColorStop(0,'#06122100');g.addColorStop(.45,'#06122180');g.addColorStop(1,'#061221ef');ctx.fillStyle=g;ctx.fillRect(0,620,W,460);
}
window.drawTourFrame=async time=>{
 const t=Math.max(0,Math.min(duration-.001,time)),shot=shotFor(t),local=t-shot.start;
 ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
 const dissolve=shot.start>0?ease(local/.42):1;
 if(dissolve<1){
  if(!transitionFrames.has(shot.id)){
   renderWorld(shot.start-.001);const still=document.createElement('canvas');still.width=W;still.height=H;
   const previous=shotFor(shot.start-.001),sc=still.getContext('2d');sc.drawImage(world.renderer.domElement,0,0);
   if(previous.features)await paintDemo(sc,previous,previous.demoDuration-.05);transitionFrames.set(shot.id,still);
  }
  ctx.drawImage(transitionFrames.get(shot.id),0,0);
 }
 const inDemo=Boolean(shot.features&&local>=MODEL),demoFade=inDemo?ease((local-MODEL)/.35):0;
 const state=inDemo&&demoFade===1?{simulationTime:t}:renderWorld(t);
 ctx.globalAlpha=dissolve;
 if(demoFade<1){ctx.drawImage(world.renderer.domElement,0,0);gradient();}
 let demonstration;
 if(inDemo){ctx.save();ctx.globalAlpha*=demoFade;demonstration=await paintDemo(ctx,shot,local-MODEL);ctx.restore();}
 ctx.globalAlpha=1;
 tracked('TBD  /  WONDER PARK',76,68,17,WHITE,3);
 text(shot.id==='finale'?'THE GRAND FINALE':shot.id==='opening'?'A WORLD OF LITTLE ADVENTURES':`${String(items.findIndex(a=>a.id===shot.id)+1).padStart(2,'0')}  /  ${String(items.length).padStart(2,'0')}`,W-76,68,17,WHITE,SANS,500,'right');
 ctx.save();ctx.globalAlpha=ease(local/.55)*Math.min(1,(shot.end-t)/.22);
 if(shot.id==='opening'){
  tracked(`${items.length} ATTRACTIONS · ONE LITTLE WORLD`,80,783,18,GOLD,3);
  text('Wonder Park',74,914,132,WHITE,SERIF,400);text(`${items.length}개의 모험이 연결되는 작은 별.`,82,978,34);
 }else if(shot.id==='finale'){
  const titleAlpha=ease((local-1)/1.2);ctx.globalAlpha*=titleAlpha;
  text('Wonder Park',W/2,930,100,WHITE,SERIF,400,'center');
  text('우리의 상상이, 하나의 빛으로.',W/2,992,33,GOLD,SANS,500,'center');
 }else if(!inDemo){
  ctx.fillStyle=shot.color;ctx.fillRect(80,821,54,4);
  tracked(shot.english.replace(' · UNDER CONSTRUCTION',' · DESIGN LAB'),80,798,19,GOLD,2);
  text(shot.name,77,907,62,WHITE,SANS,650);
  text(summaries[shot.id]||shot.description,80,972,32);
  if(shot.status==='construction'){ctx.fillStyle='#d7a455';ctx.fillRect(80,715,172,37);text('공사 중 · 미리보기',94,741,20,'#182932',SANS,650);}
 }
 ctx.restore();
 // A quiet eight-stop map makes the complete tour easy to follow.
 const selected=items.findIndex(a=>a.id===shot.id);
 for(let i=0;i<items.length;i++){ctx.fillStyle=i<=selected||shot.id==='finale'?GOLD:'#ffffff50';ctx.fillRect(80+i*34,1034,22,3);}
 if(!inDemo)text(shot.id==='finale'?'GS · FIREWORKS':`DREAM. BUILD. BELONG.`,W-80,1042,15,'#d8e1e7',SANS,400,'right');
 const fadeIn=1-ease(t/.6),fadeOut=ease((t-duration+.8)/.8);
 if(fadeIn||fadeOut){ctx.fillStyle=`rgba(5,12,24,${Math.max(fadeIn,fadeOut)})`;ctx.fillRect(0,0,W,H);}
 window.tourFrameState={chapter:shot.id,time:t,simulationTime:state.simulationTime,demonstration,gsStage:world.fireworks.root.userData.gsStage,triangles:world.renderer.info.render.triangles};
 return window.tourFrameState;
};
window.tour={duration,fps:30,width:W,height:H,chapters,attractionIds:items.map(a=>a.id)};
await window.drawTourFrame(2);window.tourReady=true;
