import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createHead, box, cylinder, textTexture } from './models';
import { bakeStatic } from './scenery';
import { sponsorBackdrop } from './sponsors';
import type { RaceLog } from '../core/types';
import type { Playback } from './RaceScene';

export const CEREMONY_SECONDS=9;
function trophy(){
  const group=new THREE.Group(),gold=new THREE.MeshStandardMaterial({color:'#ffd35b',metalness:.74,roughness:.24});
  const points=[new THREE.Vector2(.13,0),new THREE.Vector2(.18,.15),new THREE.Vector2(.26,.23),new THREE.Vector2(.44,.46),new THREE.Vector2(.52,.83),new THREE.Vector2(.54,.91),new THREE.Vector2(.46,.91),new THREE.Vector2(.43,.76),new THREE.Vector2(.35,.48),new THREE.Vector2(.14,.23)];
  const bowl=new THREE.Mesh(new THREE.LatheGeometry(points,40),gold);bowl.castShadow=true;group.add(bowl);
  for(const side of [-1,1]){const handle=new THREE.Mesh(new THREE.TorusGeometry(.29,.065,10,24,Math.PI*1.6),gold);handle.position.set(side*.53,.61,0);handle.rotation.z=side===1?Math.PI*.2:Math.PI*.8;handle.castShadow=true;group.add(handle);}
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.075,.13,.42,20),gold);stem.position.y=-.15;group.add(stem);
  group.add(cylinder(.32,.38,.11,'#ffd762',0,-.39,0),box(.85,.2,.65,'#253c61',0,-.54,0));
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.52,.13),new THREE.MeshBasicMaterial({map:textTexture('CHAMPION','#ffdb68','#765020',256,64)}));plaque.position.set(0,-.53,.329);group.add(plaque);
  const star=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.10:.22,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i===0)star.moveTo(x,y);else star.lineTo(x,y);}star.closePath();
  const badge=new THREE.Mesh(new THREE.ExtrudeGeometry(star,{depth:.04,bevelEnabled:false}),gold);badge.position.set(0,.62,.48);group.add(badge);group.scale.setScalar(1.32);return group;
}

export default function PodiumScene({log,playback,onComplete}:{log:RaceLog;playback:React.RefObject<Playback>;onComplete:()=>void}){
  const host=useRef<HTMLDivElement>(null),complete=useRef(onComplete),[failed,setFailed]=useState(false);complete.current=onComplete;
  useEffect(()=>{
    const container=host.current!;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setFailed(true);const timer=setTimeout(()=>complete.current(),CEREMONY_SECONDS*1000);return()=>clearTimeout(timer);}
    setFailed(false);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','1·2·3위 시상대와 우승 트로피 · 52G 2026 해커톤 스폰서 월');container.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#d1e9ff','#3d426b',2));
    const key=new THREE.DirectionalLight('#fff2c7',4);key.position.set(-4,12,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-9;key.shadow.camera.right=9;key.shadow.camera.top=12;key.shadow.camera.bottom=-8;scene.add(key);
    const rim=new THREE.PointLight('#72c9ff',100,30);rim.position.set(7,6,-3);scene.add(rim);
    const stage=new THREE.Group(),positions=[0,-3.15,3.15],heights=[2.6,1.65,1.05],colors=['#edb52f','#aebfd4','#bd855e'];
    stage.add(box(18.3,.35,7.5,'#e1ddd0',0,-.23,.25),box(18,.07,7.3,'#af4749',0,-.035,.25));
    log.order.slice(0,3).forEach((id,rank)=>{
      const driver=log.drivers.find(d=>d.id===id)!,x=positions[rank],height=heights[rank];
      stage.add(box(2.8,height,2.8,'#fffdf5',x,height/2,0),box(2.95,.13,2.95,colors[rank],x,height+.03,0));
      const front=new THREE.Mesh(new THREE.PlaneGeometry(2.1,Math.min(.85,height*.65)),new THREE.MeshStandardMaterial({map:textTexture(`${rank+1}`,'#fffdf5','#183f43',256,128)}));front.position.set(x,height*.52,1.411);stage.add(front);
      const name=new THREE.Mesh(new THREE.PlaneGeometry(2.55,.42),new THREE.MeshBasicMaterial({map:textTexture(driver.nickname,'#203455','#f4e8b9',512,96)}));name.position.set(x,.18,1.423);stage.add(name);
    });
    const backdrop=sponsorBackdrop();backdrop.position.z=-2.8;stage.add(backdrop);container.dataset.backdrop='step-and-repeat';
    bakeStatic(stage);scene.add(stage);
    const heads=log.order.slice(0,3).map((id,rank)=>{
      const driver=log.drivers.find(d=>d.id===id)!,head=createHead(driver.avatar,driver.color);head.scale.multiplyScalar(rank===0?1.25:1.12);bakeStatic(head);head.position.set(positions[rank],heights[rank]+1.10,.1);head.userData.baseY=head.position.y;scene.add(head);return head;
    });
    const cup=trophy();scene.add(cup);
    const halo=new THREE.Mesh(new THREE.RingGeometry(1.3,1.36,64),new THREE.MeshBasicMaterial({color:'#ffdc77',transparent:true,opacity:.45,side:THREE.DoubleSide}));halo.position.set(0,6.55,-.6);scene.add(halo);
    const confetti=new THREE.InstancedMesh(new THREE.PlaneGeometry(.10,.24),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),100),dummy=new THREE.Object3D();confetti.frustumCulled=false;scene.add(confetti);
    for(let i=0;i<100;i++)confetti.setColorAt(i,new THREE.Color(['#ffe36e','#ef6b79','#89ddff','#a6edb5','#d7b4ff'][i%5]));
    const camera=new THREE.PerspectiveCamera(36,1,.1,100),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let needsRender=true,elapsed=0,last=0,done=false;
    const resize=()=>{const rect=container.getBoundingClientRect();renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();needsRender=true;};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const animate=(now:number)=>{
      const delta=last?Math.min(.1,(now-last)/1000):0;last=now;
      if(!playback.current.paused)elapsed+=delta;
      if(elapsed>=CEREMONY_SECONDS&&!done){done=true;complete.current();return;}
      if(playback.current.paused&&!needsRender)return;
      const time=reduced?3:elapsed,raise=1-(1-Math.min(1,Math.max(0,(time-.4)/1.7)))**3;
      cup.position.set(0,3.9+raise*2.55,.48);cup.rotation.y=reduced?-.18:Math.sin(time*.9)*.18;
      cup.scale.setScalar(1.32+(reduced?0:Math.sin(time*2)*.018));
      heads.forEach((head,rank)=>{head.position.y=head.userData.baseY+(reduced?0:Math.sin(time*2.5+rank)*.05);head.rotation.y=reduced?.1:Math.sin(time*.7+rank)*.10;});
      halo.rotation.z=time*.2;halo.scale.setScalar(1+Math.sin(time*1.5)*.035);halo.visible=raise>.8;
      confetti.visible=!reduced;
      if(!reduced)for(let i=0;i<100;i++){dummy.position.set(Math.sin(i*5.71)*6+(Math.sin(time+i)*.4),9-((time*(.7+i%3*.18)+i*.23)%10),Math.cos(i*3.61)*4);dummy.rotation.set(time+i,time*1.3+i,i);dummy.updateMatrix();confetti.setMatrixAt(i,dummy.matrix);}confetti.instanceMatrix.needsUpdate=true;
      const distance=Math.max(15,16.4/(2*Math.tan(THREE.MathUtils.degToRad(18))*camera.aspect));camera.position.set(0,5.0,distance);camera.lookAt(0,4.0,0);
      renderer.render(scene,camera);container.dataset.ready='true';container.dataset.trophy=raise>.99?'raised':'raising';container.dataset.winner=log.order[0];container.dataset.time=elapsed.toFixed(2);needsRender=false;
    };
    renderer.setAnimationLoop(animate);
    return()=>{observer.disconnect();renderer.setAnimationLoop(null);scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const mat of Array.isArray(object.material)?object.material:[object.material]){if('map'in mat)(mat as THREE.MeshStandardMaterial).map?.dispose();mat.dispose();}}});renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[log,playback]);
  return <div className="podium-canvas" ref={host}>{failed&&<div className="podium-fallback">🏆<strong>{log.drivers.find(d=>d.id===log.order[0])?.nickname} 우승!</strong></div>}</div>;
}
