import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { box, cylinder, mesh, sphere, textTexture } from './models';
import { createNintendoHead } from './characters';
import { bakeStatic } from './scenery';
import { GS_SPONSORS, sponsorBoard } from './sponsors';
import { coffeeCast, coffeeDuration, coffeeServiceAt } from '../core/coffee';
import type { RaceLog } from '../core/types';
import type { Playback } from './RaceScene';

function sign(text:string,width:number,height:number,color:string,background:string){
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:textTexture(text,background,color,768,144)}));
}
function cup(){
  const group=new THREE.Group();group.add(cylinder(.18,.135,.38,'#fff8df',0,.19,0),cylinder(.19,.19,.055,'#fffdf4',0,.40,0),cylinder(.15,.15,.009,'#73432a',0,.43,0));
  group.add(cylinder(.17,.155,.15,'#e97d43',0,.20,0));const logo=sign('B',.15,.13,'#fff4ce','#e97d43');logo.position.set(0,.20,.173);group.add(logo);return group;
}
function happyHead(variant:number){
  const head=createNintendoHead(variant,true);bakeStatic(head);return head;
}
function coffeeTruck(nickname:string){
  const truck=new THREE.Group();
  truck.add(box(5.1,1.18,2.2,'#eb804f',-2.6,1.04,-.8),box(5.1,.26,2.25,'#ffefd0',-2.6,1.55,-.8));
  // The serving window is open geometry: the barista can be seen behind the counter.
  truck.add(box(3.40,1.72,.16,'#f9e3bb',-1.75,2.55,-1.83),box(.17,1.78,2.2,'#fff0ce',-.13,2.53,-.8),box(.17,1.78,2.2,'#fff0ce',-3.38,2.53,-.8));
  truck.add(box(5.25,.22,2.4,'#fff5d9',-2.6,3.48,-.8));
  truck.add(box(1.52,1.63,2.18,'#f7c573',-4.48,2.23,-.8));
  truck.add(box(1.09,.94,.08,'#88c7c8',-4.47,2.37,.323),box(1.12,.08,.09,'#fff3d3',-4.47,1.85,.37));
  truck.add(box(.12,.94,.10,'#fff5dd',-4.47,2.37,.40),box(.30,.06,.10,'#91472d',-4.70,1.65,.38));
  for(const x of [-4.45,-.70])for(const z of [-1.90,.34]){
    const tire=cylinder(.47,.47,.20,'#2d403b',x,.49,z);tire.rotation.x=Math.PI/2;truck.add(tire);
    const hub=cylinder(.25,.25,.22,'#fff2cf',x,.49,z+.02);hub.rotation.x=Math.PI/2;truck.add(hub);
  }
  truck.add(box(5.38,.16,2.32,'#5a7156',-2.6,.65,-.8),box(.10,.19,.12,'#fff5b3',-5.19,1.07,.1));
  const awning=new THREE.Group();for(let i=0;i<10;i++){const stripe=box(.38,.085,1.22,i%2?'#fff2cf':'#ed7753',-3.40+i*.38,3.40,.61);stripe.rotation.x=.12;awning.add(stripe);awning.add(box(.38,.25,.08,i%2?'#fff2cf':'#ed7753',-3.40+i*.38,3.25,1.20));}truck.add(awning);
  truck.add(box(3.8,.16,1.0,'#966039',-1.72,1.78,.80),box(3.85,.05,1.05,'#e1ac70',-1.72,1.87,.80));
  const board=sign('DALDA COFFEE',3.30,.48,'#fff5cf','#406251');board.position.set(-1.76,3.91,.13);truck.add(board);
  truck.add(box(3.52,.69,.20,'#406251',-1.76,3.91,-.02));
  const name=sign(`${nickname} 님이 쏜다!`,2.68,.42,'#fff3ce','#b85936');name.position.set(-1.7,1.14,.318);truck.add(name);
  // Espresso machine, grinder and the small menu beside the service hatch.
  truck.add(box(.82,.72,.50,'#d6e6d7',-2.62,2.27,.38),box(.73,.22,.53,'#456658',-2.62,2.32,.39),box(.64,.06,.58,'#485b53',-2.62,1.94,.42));
  for(const x of [-2.81,-2.47])truck.add(cylinder(.045,.045,.15,'#bcc9ba',x,2.14,.55));
  truck.add(cylinder(.18,.16,.37,'#9b5f33',-3.19,2.55,.16),box(.37,.31,.37,'#e6d8b5',-3.19,2.20,.16));
  const menu=sign('COFFEE  /  ON ME',1.40,.32,'#fff4c9','#405b4d');menu.position.set(-1.63,2.81,-1.73);truck.add(menu);
  const badge=sign('☕',.75,.72,'#fff0c9','#ed8050');badge.position.set(-4.52,1.16,.322);truck.add(badge);
  for(let i=0;i<7;i++){const light=sphere(.065,i%2?'#fff3a9':'#ffd7a1',-3.36+i*.55,3.12,1.18);truck.add(light);}
  return truck;
}

export default function CoffeeScene({log,playback,onComplete}:{log:RaceLog;playback:React.RefObject<Playback>;onComplete:()=>void}){
  const host=useRef<HTMLDivElement>(null),complete=useRef(onComplete),[failed,setFailed]=useState(false);complete.current=onComplete;
  useEffect(()=>{
    const container=host.current!,{barista,guests}=coffeeCast(log),duration=coffeeDuration(guests.length);let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setFailed(true);const timer=setTimeout(()=>complete.current(),duration*1000);return()=>clearTimeout(timer);}
    setFailed(false);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',`${barista.nickname}의 커피차와 웃으며 기다리는 ${guests.length}명의 레이서`);container.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff7d5','#75947d',2.4));
    const sun=new THREE.DirectionalLight('#fff2c7',3.2);sun.position.set(-4,10,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-11,right:11,top:9,bottom:-9});scene.add(sun);
    const world=new THREE.Group();world.add(cylinder(9,9,.22,'#d7dfae',.6,-.16,0),cylinder(9.3,9.3,.08,'#95b47d',.6,-.31,0));world.add(coffeeTruck(barista.nickname));
    for(const [x,z] of [[-6.3,-1.4],[6.5,-2.3]]){world.add(cylinder(.44,.31,.65,'#cf9064',x,.24,z),cylinder(.09,.12,1.8,'#836340',x,1.1,z),sphere(.83,'#779c60',x,2.20,z),sphere(.64,'#95b477',x-.35,2.52,z));}
    GS_SPONSORS.slice(0,2).forEach((brand,i)=>{const board=sponsorBoard(brand,2.75,.94,2.75);board.position.set(1.35+i*3.15,0,-2.8);world.add(board);});
    const queue=guests.map((_,i)=>({x:1.0+i*1.02,z:1.60-i*.32}));
    queue.forEach((p,i)=>{world.add(cylinder(.53,.53,.07,i%2?'#efc49b':'#eee8c1',p.x,.015,p.z));const arrow=sign(`${i+1}`, .28,.25,'#809164',i%2?'#efc49b':'#eee8c1');arrow.rotation.x=-Math.PI/2;arrow.position.set(p.x,.055,p.z+.27);world.add(arrow);});
    bakeStatic(world);scene.add(world);
    const maker=happyHead(barista.avatar);maker.scale.setScalar(.76);maker.position.set(-1.42,2.53,-.24);scene.add(maker);
    const customers=guests.map((guest,i)=>{const head=happyHead(guest.avatar);head.scale.setScalar(.69);head.position.set(queue[i].x,1.13,queue[i].z);head.rotation.y=-.28;scene.add(head);return head;});
    const cups=guests.map((_,i)=>{const object=cup();object.position.set(queue[i].x, .58,queue[i].z+.47);scene.add(object);return object;});
    const serving=cup();scene.add(serving);
    const pitcher=new THREE.Group();pitcher.add(cylinder(.17,.13,.40,'#e7eee0',0,0,0));const handle=mesh(new THREE.TorusGeometry(.15,.035,8,16),'#ccd9ce',.17,0,0);pitcher.add(handle);scene.add(pitcher);
    const stream=mesh(new THREE.CylinderGeometry(.022,.025,.6,10),'#f5ead4');scene.add(stream);
    const steam=new THREE.Group();for(let i=0;i<6;i++)steam.add(new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:'#fffaf0',transparent:true,opacity:.34,depthWrite:false})));scene.add(steam);
    const hearts=new THREE.Group();for(let i=0;i<guests.length;i++){const spark=sign('♥',.22,.24,'#e87252','#fff3d7');hearts.add(spark);}scene.add(hearts);
    const camera=new THREE.PerspectiveCamera(36,1,.1,100),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let elapsed=0,last=0,needsRender=true,done=false;
    const resize=()=>{const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();needsRender=true;};const observer=new ResizeObserver(resize);observer.observe(container);resize();
    renderer.setAnimationLoop((now:number)=>{
      const delta=last?Math.min(.1,(now-last)/1000):0;last=now;if(!playback.current.paused)elapsed+=delta;
      if(elapsed>=duration&&!done){done=true;complete.current();return;}if(playback.current.paused&&!needsRender)return;
      const time=reduced?1.35:elapsed,service=coffeeServiceAt(time,guests.length),target=queue[Math.max(0,service.recipient)],pouring=service.phase==='pour';
      maker.position.y=2.53+(reduced?0:Math.sin(time*5)*.035);maker.rotation.z=pouring?-.10:Math.sin(time*3)*.055;maker.rotation.y=pouring?.14:-.10;
      customers.forEach((head,i)=>{const happy=i<service.served;head.position.y=1.13+(reduced?0:Math.max(0,Math.sin(time*(happy?5:2.7)+i))*(happy?.16:.06));head.rotation.z=reduced?0:Math.sin(time*2.5+i)*.045;});
      const start=new THREE.Vector3(-1.15,1.93,1.05),end=new THREE.Vector3(target?.x??0,.70,(target?.z??0)+.50),delivery=service.delivery;
      serving.position.lerpVectors(start,end,delivery);serving.position.y+=Math.sin(delivery*Math.PI)*.65;serving.visible=service.phase!=='cheers';
      cups.forEach((object,i)=>{object.visible=i<service.served;object.position.y=.61+(reduced?0:Math.sin(time*3+i)*.035);});
      pitcher.position.set(-.91,2.64,.96);pitcher.rotation.z=pouring?-.72:-.12;
      stream.visible=pouring;stream.position.set(-1.12,2.44,1.03);stream.scale.y=.70+service.pour*.18;
      steam.position.copy(serving.position);steam.visible=service.phase!=='grind';steam.children.forEach((puff,i)=>{const up=((time*.45+i*.16)%.85);puff.position.set(Math.sin(time*2+i)*.06,.5+up,Math.cos(i)*.06);puff.scale.setScalar(.7+up);});
      hearts.children.forEach((heart,i)=>{heart.position.set(queue[i].x+.36,1.97+(reduced?0:Math.sin(time*2+i)*.10),queue[i].z);heart.rotation.z=.12;});
      const width=Math.max(12.8,7.1+guests.length*1.04),distance=Math.max(11.7,width/(2*Math.tan(THREE.MathUtils.degToRad(18))*camera.aspect));camera.position.set(.8,distance*.26+2.8,distance);camera.lookAt(.7,1.95,0);
      renderer.render(scene,camera);needsRender=false;container.dataset.ready='true';container.dataset.barista=barista.id;container.dataset.guests=guests.map(g=>g.id).join(',');container.dataset.phase=service.phase;container.dataset.served=String(service.served);container.dataset.time=elapsed.toFixed(2);
    });
    return()=>{observer.disconnect();renderer.setAnimationLoop(null);scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const mat of Array.isArray(object.material)?object.material:[object.material]){if('map'in mat)(mat as THREE.MeshStandardMaterial).map?.dispose();mat.dispose();}}});renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[log,playback]);
  return <div className="coffee-canvas" ref={host}>{failed&&<div className="coffee-fallback">☕<strong>커피가 준비되고 있어요!</strong></div>}</div>;
}
