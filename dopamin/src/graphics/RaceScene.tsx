import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { sampleRace } from '../core/race';
import { cameraKick, raceMoment } from '../core/presentation';
import type { Driver, RaceLog, Track } from '../core/types';
import { createKart } from './models';
import { createWorld } from './world';
import { bakeStatic, createSky, LANE_SCALE, themeFor } from './scenery';
import { RaceEffects } from './effects';

export type Playback = { mode: 'lobby'|'race'|'replay'|'highlights'; time: number; log: RaceLog|null; focus: string|null; paused: boolean; speed: number; overview: boolean };
type Props={track:Track;drivers:Driver[];playback:React.RefObject<Playback>;onReady?:()=>void};

export default function RaceScene({track,drivers,playback,onReady}:Props) {
  const container=useRef<HTMLDivElement>(null),[error,setError]=useState(false);
  const key=drivers.map(d=>`${d.id}-${d.color}-${d.avatar}`).join(',');
  useEffect(()=>{
    const host=container.current!;let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); } catch {setError(true);return;}
    setError(false);renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
    renderer.domElement.setAttribute('aria-label',`${track.name} 3D 레이싱 트랙`);renderer.domElement.setAttribute('role','img');host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),theme=themeFor(track);scene.fog=new THREE.Fog(theme.horizon,160,620);scene.add(createSky(track));scene.add(new THREE.HemisphereLight('#e7f7ff','#7a8050',1.6));
    const sun=new THREE.DirectionalLight('#fff2d2',2.8);sun.position.set(-90,155,65);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-140;sun.shadow.camera.right=140;sun.shadow.camera.top=140;sun.shadow.camera.bottom=-140;sun.shadow.camera.far=400;sun.shadow.normalBias=.06;sun.shadow.bias=-.0001;scene.add(sun);
    const {world,curve,pickups,coinGroups}=createWorld(track);scene.add(world);host.dataset.sponsors=world.userData.sponsors.join(',');host.dataset.sponsorVenue=world.userData.sponsorVenue;
    renderer.domElement.setAttribute('aria-label',`${track.name} 3D 레이싱 트랙 · ${world.userData.sponsors.join(', ')} 광고 배너`);
    const effects=new RaceEffects();scene.add(effects.group);
    const karts=drivers.map(d=>{
      const kart=createKart(d.avatar,d.color),body=new THREE.Group();
      for(const child of [...kart.children])if(!child.name)body.add(child);
      for(const child of kart.children)if(child.name==='head'||child.name==='wheel')bakeStatic(child as THREE.Group);
      bakeStatic(body);kart.add(body);scene.add(kart);return kart;
    });
    const camera=new THREE.PerspectiveCamera(38,1,.1,1500);camera.position.set(152,143,174);camera.lookAt(0,0,0);
    // A small cockpit grounds the first-person impact view without obscuring the track.
    const cockpit=new THREE.Group(),hood=new THREE.Mesh(new THREE.BoxGeometry(1.7,.22,1.1),new THREE.MeshStandardMaterial({color:drivers[0]?.color||'#ff953f',metalness:.3,roughness:.4}));hood.position.set(0,-1.02,-1.65);cockpit.add(hood);
    const steering=new THREE.Mesh(new THREE.TorusGeometry(.3,.036,8,24),new THREE.MeshStandardMaterial({color:'#263343'}));steering.position.set(0,-.64,-1.18);steering.rotation.x=-.4;cockpit.add(steering);camera.add(cockpit);scene.add(camera);
    const look=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),desiredLook=new THREE.Vector3();
    let initialized=false,disposed=false,lastMode='',lastSignature='',lastDraw=0,needsRender=true,previousTime=0;
    const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();needsRender=true;};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previousFrame=0;
    const animate=(now:number)=>{
      if(disposed)return;
      const state=playback.current,lobby=state.mode==='lobby',clock=lobby?(reduced?0:now/1000):state.time;
      const signature=`${state.mode}:${state.time}:${state.focus}:${state.overview}:${state.paused}`;
      if(initialized&&!needsRender&&((state.paused||(reduced&&lobby))&&lastSignature===signature))return;
      if(lobby&&!needsRender&&now-lastDraw<1000/24)return;
      const delta=Math.min(.1,(now-previousFrame)/1000);previousFrame=now;lastDraw=now;lastSignature=signature;needsRender=false;
      const snapshot=state.log&&!lobby?sampleRace(state.log,state.time):null;
      const moment=state.log&&!lobby?raceMoment(state.log,state.time,state.focus):null;
      const firstPerson=moment?.phase==='hit'&&!state.overview,focus=moment?.focus||state.focus||drivers[0]?.id;
      const focusIndex=Math.max(0,drivers.findIndex(d=>d.id===focus)),kick=moment?cameraKick(moment,state.time,reduced):{x:0,y:0,roll:0,fov:0};
      const fov=lobby||state.overview?38:firstPerson?76+kick.fov:62+kick.fov;
      if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
      karts.forEach((kart,i)=>{
        const car=snapshot?.cars[i],progress=car?car.progress:((.74+i*.035)%1),t=((progress%1)+1)%1,p=curve.getPointAt(t),tangent=curve.getTangentAt(t),normal=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
        const ahead=curve.getTangentAt((t+.007)%1),bend=tangent.clone().cross(ahead).y;
        kart.position.copy(p).addScaledVector(normal,(car?.lane??(i%2?1.1:-1.1))*LANE_SCALE);kart.position.y+=.18;
        kart.rotation.set(0,Math.atan2(tangent.x,tangent.z)+(!lobby?THREE.MathUtils.clamp(bend*2,-.27,.27):0),!lobby?THREE.MathUtils.clamp(-bend*.5,-.08,.08):0);
        kart.scale.setScalar(lobby?1.4:1.12);
        const hit=state.log?.events.findLast(e=>e.type==='hit'&&e.target===drivers[i].id&&clock>=e.time&&clock-e.time<.9);
        if(hit&&!lobby){const a=(clock-hit.time)/.9;kart.position.y+=Math.sin(a*Math.PI)*1.5;kart.rotation.y+=a*Math.PI*4;kart.rotation.z+=Math.sin(a*Math.PI)*.25;}
        kart.getObjectByName('boost')!.visible=car?.effect==='boost';kart.getObjectByName('shield')!.visible=car?.effect==='shield';
        kart.children.filter(c=>c.name==='wheel').forEach(w=>w.rotation.x=progress*curve.getLength()/.47);
        kart.getObjectByName('head')!.rotation.z=!lobby?Math.sin(clock*9+i)*.025:0;
        kart.visible=!(firstPerson&&i===focusIndex);
      });
      cockpit.visible=Boolean(firstPerson);(hood.material as THREE.MeshStandardMaterial).color.set(drivers[focusIndex]?.color||'#ff953f');cockpit.rotation.z=kick.roll*3;
      if(lobby||state.overview){
        const bob=lobby&&!reduced?Math.sin(now*.00012)*3:0;
        desiredCamera.set(152+bob,143,174);desiredLook.set(0,0,0);
      }else if(karts[focusIndex]){
        const kart=karts[focusIndex],car=snapshot!.cars[focusIndex],tangent=curve.getTangentAt((car.progress%1+1)%1),normal=new THREE.Vector3(-tangent.z,0,tangent.x);
        // Follow the road heading during a hit, rather than inheriting the kart's spin.
        const base=curve.getPointAt((car.progress%1+1)%1).addScaledVector(normal,car.lane*LANE_SCALE);
        desiredCamera.copy(firstPerson?base:kart.position).addScaledVector(tangent,firstPerson?.25:-10.8);desiredCamera.y+=firstPerson?2.0:4.4;
        desiredLook.copy(base).addScaledVector(tangent,firstPerson?22:8);desiredLook.y+=1.5;
        desiredCamera.addScaledVector(normal,kick.x);desiredCamera.y+=kick.y;
      }
      if(!initialized||state.paused||lastMode!==state.mode||Math.abs(state.time-previousTime)>.5){camera.position.copy(desiredCamera);look.copy(desiredLook);initialized=true;}else{camera.position.lerp(desiredCamera,1-Math.exp(-delta*9));look.lerp(desiredLook,1-Math.exp(-delta*11));}
      lastMode=state.mode;previousTime=state.time;camera.lookAt(look);camera.rotateZ(kick.roll);
      pickups.forEach((g,i)=>{g.rotation.y=clock*1.3+i;g.rotation.z=Math.sin(clock*2+i)*.18;g.position.y=g.userData.baseY+Math.sin(clock*2+i)*.22;});
      coinGroups.forEach((g,i)=>{g.rotation.y=clock*2+i;g.position.y=g.userData.baseY+Math.sin(clock*2+i)*.12;});
      effects.update(lobby?null:state.log,state.time,curve);
      host.dataset.phase=moment?.phase||'cruise';host.dataset.camera=lobby||state.overview?'overview':firstPerson?'first-person':'third-person';host.dataset.particles=String(effects.count);host.dataset.time=state.time.toFixed(1);
      renderer.render(scene,camera);host.dataset.drawCalls=String(renderer.info.render.calls);
      if(host.dataset.ready!=='true'){host.dataset.ready='true';onReady?.();}
    };
    renderer.setAnimationLoop(animate);
    const onContextLost=(event:Event)=>{event.preventDefault();setError(true);};renderer.domElement.addEventListener('webglcontextlost',onContextLost);
    return()=>{disposed=true;observer.disconnect();renderer.setAnimationLoop(null);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);
      const geometries=new Set<THREE.BufferGeometry>(),textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>();
      scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if('map'in m&&(m as THREE.MeshStandardMaterial).map)textures.add((m as THREE.MeshStandardMaterial).map!);}}});
      geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();delete host.dataset.ready;
    };
  // Scene rebuilds only when the track or roster changes, never on playback ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[track.id,key,playback]);
  return <div className="race-canvas" ref={container}>{error&&<div className="webgl-error"><strong>WebGL을 시작할 수 없어요</strong><span>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</span></div>}</div>;
}
