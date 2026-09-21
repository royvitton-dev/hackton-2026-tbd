import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import skyUrl from '../assets/kloppenheim-06-sky.hdr?url';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCastle } from './castle.js';
import { createLandmark } from './landmark.js';
import { createAttraction, buildCinema } from './attractions.js';
import { staticBatch, disposeSubtree, group, sphere, material } from './materials.js';
import { disneyCharacter } from './characters.js';
import { CHARACTERS } from '../lib/characters.mjs';
import { PLANET_RADIUS, surfacePoint, surfaceDrop, themeCoordinates } from '../lib/globe.mjs';
import { createGlobe, createThemeIsland, surfaceAnchor, surfacePatch, conformToSurface, surfaceMotion, CASTLE_COORDINATES, PLAZA_COORDINATES } from './globe.js';
import { createFireworks } from './fireworks.js';

const overviewPosition=[58,44,78],overviewTarget=[0,0,0];

export class ParkScene {
 constructor(container,{onSelect,onReady,onError,onLabels,video,capture=false}={}){
  this.container=container;this.onSelect=onSelect;this.onLabels=onLabels;this.video=video;this.capture=capture;this.fixedTime=6;this.running=true;this.night=false;this.mode='park';this.centeredOrbit=true;this.items=[];this.animations=[];this.attractions=[];this.picks=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e9eef0');this.scene.fog=new THREE.Fog('#e9eef0',180,400);this.backgroundDirty=true;
  this.camera=new THREE.PerspectiveCamera(38,1,.1,500);this.camera.position.fromArray(overviewPosition);
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){onError?.(error);return;}
  this.renderer.info.autoReset=false;this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.91;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','어린왕자의 작은 별처럼 펼쳐진 디즈니 테마파크. 성의 불꽃놀이와 열 명의 친구들을 만나고 별을 회전해 테마를 선택하세요.');this.renderer.domElement.setAttribute('role','img');container.append(this.renderer.domElement);
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.running=false;onError?.(new Error('WebGL context lost'));});
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.fromArray(overviewTarget);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=38;this.controls.maxDistance=180;this.controls.maxPolarAngle=Math.PI*.8;this.controls.minPolarAngle=.15;this.controls.enablePan=false;this.controls.screenSpacePanning=false;
  // Keep the planet pivot fixed, including a drag that interrupts the return animation.
  this.controls.addEventListener('start',()=>{this.transition=null;this.tour=false;if(this.centeredOrbit)this.controls.target.fromArray(overviewTarget);});
  this.sun=new THREE.DirectionalLight('#ffeacb',3.1);this.sun.position.set(-50,90,75);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);Object.assign(this.sun.shadow.camera,{left:-52,right:52,top:62,bottom:-52,near:.5,far:200});this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=2;this.scene.add(this.sun);
  this.hemisphere=new THREE.HemisphereLight('#d9efff','#667c43',.65);this.scene.add(this.hemisphere);
  const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04).texture;this.scene.environment=this.env;this.scene.environmentIntensity=.55;room.dispose();
  this.environmentReady=new RGBELoader().loadAsync(skyUrl).then(hdr=>{const previous=this.env;this.env=pmrem.fromEquirectangular(hdr).texture;this.scene.environment=this.env;hdr.dispose();previous.dispose();this.backgroundDirty=true;}).catch(()=>{}).finally(()=>pmrem.dispose());
  this.globe=createGlobe(this.scene);
  this.animations.push(...this.globe.animations);this.parkRoot=group(this.scene);this.parkRoot.name='Storybook landmarks';
  this.castleAnchor=surfaceAnchor(this.parkRoot,...CASTLE_COORDINATES);surfacePatch(this.castleAnchor,7,'#a7bb7c',.025,2).userData.dynamic=true;
  const castle=createCastle(this.castleAnchor);castle.position.set(0,0,0);castle.scale.multiplyScalar(.8);castle.name='Disney storybook castle';conformToSurface(castle,this.castleAnchor);
  this.plazaAnchor=surfaceAnchor(this.parkRoot,...PLAZA_COORDINATES);surfacePatch(this.plazaAnchor,7.1,'#d8d3ac',.026,1).userData.dynamic=true;
  const landmark=createLandmark(this.plazaAnchor,{grounded:true});landmark.position.set(0,.05,0);landmark.scale.setScalar(.83);conformToSurface(landmark,this.plazaAnchor);
  this.characters=CHARACTERS.map(definition=>{const root=disneyCharacter(this.plazaAnchor,definition.id,definition.scale*.83);const [x,y,z]=definition.position;root.position.set(x,y+surfaceDrop(x,z),z);root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,PLANET_RADIUS+surfaceDrop(x,z),z).normalize());root.rotateY(definition.angle);this.animations.push(t=>root.userData.animate(t,definition.motion));return {definition,root};});
  staticBatch(this.parkRoot);
  this.fireworks=createFireworks(this.castleAnchor);this.animations.push(t=>this.fireworks.animate(t));
  this.projects=group(this.scene);
  this.cinema=buildCinema(this.scene,video);this.cinema.root.visible=false;
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao=new SSAOPass(this.scene,this.camera,1,1);this.ao.kernelRadius=9;this.ao.minDistance=.002;this.ao.maxDistance=.11;this.composer.addPass(this.ao);
  this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.22,.4,1.1);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down;
  this.renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||this.mode!=='park')return;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects([...this.picks,this.globe.terrain])[0];if(hit?.object.userData.attraction)this.onSelect?.(hit.object.userData.attraction);});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  this.start=performance.now();this.last=0;this.frames=0;this.fps=0;this.fpsAt=this.start;this.frame=this.frame.bind(this);this.renderer.setAnimationLoop(this.frame);
  Promise.all([this.environmentReady,landmark.userData.ready,this.globe.ready]).then(()=>this.renderer.compileAsync(this.scene,this.camera)).then(()=>{container.dataset.ready='true';onReady?.();}).catch(onError);
 }
 positions(index){return surfacePoint(...themeCoordinates(index));}
 setAttractions(items){
  if(JSON.stringify(items.map(i=>[i.id,i.revision]))===JSON.stringify(this.items.map(i=>[i.id,i.revision])))return;
  this.items=items;disposeSubtree(this.projects);this.attractions=[];this.picks=[];this.globe.setAttractionClearings(items.length);
  items.forEach((item,i)=>{
   const anchor=createThemeIsland(this.projects,i,item.color);const attraction=createAttraction(anchor,item,[0,.02,0],i);attraction.pick.userData.dynamic=true;attraction.character.position.y=.08;{const p=attraction.character.position;attraction.character.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(p.x,PLANET_RADIUS+surfaceDrop(p.x,p.z),p.z).normalize());}conformToSurface(attraction.root,anchor);attraction.animation=[surfaceMotion(attraction.root,anchor,attraction.animation)];attraction.anchor=anchor;this.attractions.push(attraction);this.picks.push(attraction.pick);
   anchor.updateWorldMatrix(true,true);attraction.label=attraction.root.localToWorld(new THREE.Vector3(0,.6+surfaceDrop(0,5.5),5.5));
   if(item.model)new GLTFLoader().load(item.model,gltf=>{if(!this.attractions.includes(attraction))return;const b=new THREE.Box3().setFromObject(gltf.scene),size=b.getSize(new THREE.Vector3());gltf.scene.scale.setScalar(6/Math.max(size.x,size.y,size.z));gltf.scene.position.y=.5;attraction.root.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});},undefined,()=>{});
  });
  // Hit volumes and characters stay separate; all static architectural geometry is batched.
  for(const pick of this.picks)pick.userData.dynamic=true;staticBatch(this.projects);
  this.renderer.compileAsync(this.scene,this.camera).catch(()=>{});
 }
 resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.fov=width<650?44:38;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.composer.setSize(width,height);this.ao.setSize(Math.round(width*.75),Math.round(height*.75));}
 frame(now){
  if(!this.running)return;const dt=Math.min((now-this.last)/1000,.05);this.last=now;
  const t=this.capture||this.reduced?this.fixedTime:(now-this.start)/1000;
  if(this.mode==='park'){this.animations.forEach(f=>f(t));this.attractions.forEach(a=>a.animation.forEach(f=>f(t)));}else this.cinema.animate(t);
  if(this.transition){const p=Math.min(1,(now-this.transition.start)/1000/1.35),e=1-Math.pow(1-p,3);this.camera.position.lerpVectors(this.transition.from,this.transition.to,e);this.controls.target.lerpVectors(this.transition.targetFrom,this.transition.targetTo,e);if(p===1)this.transition=null;}
  if(this.tour&&!this.transition&&!this.reduced){const v=this.camera.position.clone().sub(this.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.06);this.camera.position.copy(this.controls.target).add(v);}
  this.controls.update();if(this.mode==='park'&&this.camera.position.length()<PLANET_RADIUS+2)this.camera.position.setLength(PLANET_RADIUS+2);this.renderer.info.reset();this.composer.render();
  if(this.backgroundDirty&&this.mode==='park'){const pixel=new Uint8Array(4),gl=this.renderer.getContext();gl.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(pixel[3]){const color=`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;this.container.closest('.park-page').style.backgroundColor=color;const loading=this.container.querySelector('.loading');if(loading)loading.style.backgroundColor=color;}this.backgroundDirty=false;}
  if(this.mode==='park'&&this.onLabels){const rect=this.container.getBoundingClientRect();this.onLabels(this.attractions.map((a,i)=>{const p=a.label.clone().project(this.camera),facing=a.anchor.position.dot(this.camera.position.clone().sub(a.anchor.position))>0;return {id:this.items[i].id,x:(p.x+1)/2*rect.width,y:(-p.y+1)/2*rect.height,visible:facing&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}));}
  this.frames++;if(now-this.fpsAt>1000){this.fps=Math.round(this.frames*1000/(now-this.fpsAt));this.frames=0;this.fpsAt=now;}
 }
 move(position,target,{centered=false}={}){this.centeredOrbit=centered;this.transition={from:this.camera.position.clone(),to:new THREE.Vector3(...position),targetFrom:this.controls.target.clone(),targetTo:new THREE.Vector3(...target),start:performance.now()};}
 overview(){this.tour=false;this.controls.minDistance=38;this.move(overviewPosition,overviewTarget,{centered:true});}
 focus(id){const attraction=this.attractions[this.items.findIndex(i=>i.id===id)];if(!attraction)return;this.tour=false;this.controls.minDistance=10;const anchor=attraction.anchor;this.move(anchor.localToWorld(new THREE.Vector3(12,15,21)).toArray(),anchor.localToWorld(new THREE.Vector3(0,2,0)).toArray());}
 focusCharacter(id){const character=this.characters.find(c=>c.definition.id===id);if(!character)return;this.tour=false;this.controls.minDistance=2;const height=id==='goofy'?1.3:id==='pluto'?.7:1;const target=character.root.localToWorld(new THREE.Vector3(0,height,0)),offset=new THREE.Vector3(1.6,1.1,6.2).applyQuaternion(character.root.getWorldQuaternion(new THREE.Quaternion()));this.move(target.clone().add(offset).toArray(),target.toArray());}
 focusCastle(){this.tour=false;this.controls.minDistance=12;this.move(this.castleAnchor.localToWorld(new THREE.Vector3(18,16,28)).toArray(),this.castleAnchor.localToWorld(new THREE.Vector3(0,8,0)).toArray());}
 setNight(night){this.night=night;const bg=night?'#091426':'#e9eef0';this.scene.background=new THREE.Color(bg);this.scene.fog.color.set(bg);this.globe.setNight(night);this.sun.intensity=night?.65:3.1;this.sun.color.set(night?'#b4cde8':'#ffeacb');this.hemisphere.intensity=night?.6:.85;this.bloom.strength=night?.45:.22;this.renderer.toneMappingExposure=night?1.1:.91;this.backgroundDirty=true;}
 setQuality(value){const ratio=value==='ultra'?Math.min(devicePixelRatio,2):value==='balanced'?1:Math.min(devicePixelRatio,1.75);this.renderer.setPixelRatio(ratio);this.ao.enabled=value!=='balanced';this.sun.shadow.mapSize.setScalar(value==='ultra'?4096:2048);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.resize();}
 enterCinema(){this.mode='cinema';this.parkRoot.visible=false;this.projects.visible=false;this.globe.root.visible=false;this.fireworks.root.visible=false;this.cinema.root.visible=true;this.scene.background=new THREE.Color('#121821');this.scene.fog=new THREE.Fog('#121821',35,75);this.sun.intensity=.05;this.hemisphere.intensity=.2;this.scene.environmentIntensity=.1;this.bloom.strength=.22;this.controls.minDistance=6;this.controls.maxDistance=28;this.controls.enablePan=false;this.controls.maxPolarAngle=Math.PI*.53;this.move([.2,5.3,13],[0,5.1,-13]);}
 leaveCinema(){this.video.pause();this.mode='park';this.parkRoot.visible=true;this.projects.visible=true;this.globe.root.visible=true;this.fireworks.root.visible=true;this.cinema.root.visible=false;this.scene.fog=new THREE.Fog('#e9eef0',180,400);this.scene.environmentIntensity=.55;this.controls.minDistance=38;this.controls.maxDistance=180;this.controls.maxPolarAngle=Math.PI*.8;this.controls.enablePan=false;this.setNight(this.night);this.overview();}
 setTime(time){this.capture=true;this.fixedTime=time;}
 captureImage(){return this.renderer.domElement.toDataURL('image/png');}
 dispose(){this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();this.controls.dispose();this.composer.dispose();this.renderer.dispose();}
}
