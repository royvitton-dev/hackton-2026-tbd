import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLandscape } from './landscape.js';
import { createCastle } from './castle.js';
import { createAttraction, buildCinema } from './attractions.js';
import { staticBatch, group, sphere, material } from './materials.js';
import { disneyCharacter } from './characters.js';

export class ParkScene {
 constructor(container,{onSelect,onReady,onError,onLabels,video,capture=false}={}){
  this.container=container;this.onSelect=onSelect;this.onLabels=onLabels;this.video=video;this.capture=capture;this.fixedTime=6;this.running=true;this.night=false;this.mode='park';this.items=[];this.animations=[];this.attractions=[];this.picks=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#f2eee5',105,210);
  this.camera=new THREE.PerspectiveCamera(34,1,.1,300);this.camera.position.set(36,36,49);
  try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setClearColor('#f2eee5',0);}catch(error){onError?.(error);return;}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.91;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','3D 미니어처 테마파크. 마우스로 회전하고 어트랙션을 선택하세요.');this.renderer.domElement.setAttribute('role','img');container.append(this.renderer.domElement);
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.running=false;onError?.(new Error('WebGL context lost'));});
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,2.7,-1);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=22;this.controls.maxDistance=95;this.controls.maxPolarAngle=Math.PI*.43;this.controls.minPolarAngle=.22;this.controls.enablePan=true;this.controls.screenSpacePanning=false;
  this.controls.addEventListener('start',()=>{this.transition=null;this.tour=false;});
  this.sun=new THREE.DirectionalLight('#fff1d9',2.6);this.sun.position.set(-24,40,26);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);Object.assign(this.sun.shadow.camera,{left:-34,right:34,top:32,bottom:-32,near:.5,far:100});this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=2;this.scene.add(this.sun);
  this.hemisphere=new THREE.HemisphereLight('#f3f5ef','#829775',1.3);this.scene.add(this.hemisphere);
  const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.env=pmrem.fromScene(room,.04).texture;this.scene.environment=this.env;this.scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.ShadowMaterial({color:'#405849',opacity:.17}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.28;ground.receiveShadow=true;this.scene.add(ground);this.ground=ground;
  this.parkRoot=group(this.scene);const landscape=createLandscape(this.parkRoot);this.animations.push(...landscape.animations);createCastle(this.parkRoot);
  const host=disneyCharacter(this.parkRoot,'mickey',1.4);host.position.set(-3.6,.4,4.6);host.rotation.y=.3;this.animations.push(t=>host.userData.animate(t,'wave'));
  staticBatch(this.parkRoot);
  this.projects=group(this.scene);
  this.cinema=buildCinema(this.scene,video);this.cinema.root.visible=false;
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao=new SSAOPass(this.scene,this.camera,1,1);this.ao.kernelRadius=9;this.ao.minDistance=.002;this.ao.maxDistance=.11;this.composer.addPass(this.ao);
  this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.12,.4,1.1);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down;
  this.renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||this.mode!=='park')return;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.picks)[0];if(hit)this.onSelect?.(hit.object.userData.attraction);});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  this.start=performance.now();this.last=0;this.frames=0;this.fps=0;this.fpsAt=this.start;this.frame=this.frame.bind(this);this.renderer.setAnimationLoop(this.frame);
  this.renderer.compileAsync(this.scene,this.camera).then(()=>{container.dataset.ready='true';onReady?.();}).catch(onError);
 }
 positions(index){return [[-11,.34,1.3],[10.5,.34,2.2],[-10,.34,-9.4],[-10,.34,9.8],[10,.34,10.5]][index] || [Math.sin((index-5)*2.4+.4)*(25+Math.floor((index-5)/7)*9),.35,Math.cos((index-5)*2.4+.4)*(20+Math.floor((index-5)/7)*7)];}
 setAttractions(items){
  if(JSON.stringify(items.map(i=>[i.id,i.revision]))===JSON.stringify(this.items.map(i=>[i.id,i.revision])))return;
  this.items=items;this.projects.clear();this.attractions=[];this.picks=[];
  items.forEach((item,i)=>{
   const attraction=createAttraction(this.projects,item,this.positions(i),i);this.attractions.push(attraction);this.picks.push(attraction.pick);
   if(item.model)new GLTFLoader().load(item.model,gltf=>{if(!this.projects.children.includes(attraction.root))return;const b=new THREE.Box3().setFromObject(gltf.scene),size=b.getSize(new THREE.Vector3());gltf.scene.scale.setScalar(6/Math.max(size.x,size.y,size.z));gltf.scene.position.y=.5;attraction.root.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});},undefined,()=>{});
  });
  // Hit volumes and characters stay separate; all static architectural geometry is batched.
  for(const pick of this.picks)pick.userData.dynamic=true;staticBatch(this.projects);
  this.renderer.compileAsync(this.scene,this.camera).catch(()=>{});
 }
 resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.fov=width<650?47:34;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.composer.setSize(width,height);this.ao.setSize(Math.round(width*.75),Math.round(height*.75));}
 frame(now){
  if(!this.running)return;const dt=Math.min((now-this.last)/1000,.05);this.last=now;
  const t=this.capture||this.reduced?this.fixedTime:(now-this.start)/1000;
  if(this.mode==='park'){this.animations.forEach(f=>f(t));this.attractions.forEach(a=>a.animation.forEach(f=>f(t)));}else this.cinema.animate(t);
  if(this.transition){const p=Math.min(1,(now-this.transition.start)/1000/1.35),e=1-Math.pow(1-p,3);this.camera.position.lerpVectors(this.transition.from,this.transition.to,e);this.controls.target.lerpVectors(this.transition.targetFrom,this.transition.targetTo,e);if(p===1)this.transition=null;}
  if(this.tour&&!this.transition&&!this.reduced){const v=this.camera.position.clone().sub(this.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.06);this.camera.position.copy(this.controls.target).add(v);}
  this.controls.update();this.composer.render();
  if(this.mode==='park'&&this.onLabels){const rect=this.container.getBoundingClientRect();this.onLabels(this.attractions.map((a,i)=>{const p=a.label.clone().project(this.camera);return {id:this.items[i].id,x:(p.x+1)/2*rect.width,y:(-p.y+1)/2*rect.height,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}));}
  this.frames++;if(now-this.fpsAt>1000){this.fps=Math.round(this.frames*1000/(now-this.fpsAt));this.frames=0;this.fpsAt=now;}
 }
 move(position,target){this.transition={from:this.camera.position.clone(),to:new THREE.Vector3(...position),targetFrom:this.controls.target.clone(),targetTo:new THREE.Vector3(...target),start:performance.now()};}
 overview(){this.tour=false;this.move([36,36,49],[0,2.7,-1]);}
 focus(id){const index=this.items.findIndex(i=>i.id===id);if(index<0)return;const [x,y,z]=this.positions(index);this.move([x+13,y+14,z+18],[x,y+2,z]);}
 setNight(night){this.night=night;const bg=night?'#192d36':'#f2eee5';this.scene.background=null;this.renderer.setClearColor(bg,0);this.scene.fog.color.set(bg);this.sun.intensity=night?.45:2.6;this.sun.color.set(night?'#b4cde8':'#fff1d9');this.hemisphere.intensity=night?.8:1.3;this.bloom.strength=night?.4:.12;this.renderer.toneMappingExposure=night?1.1:.91;}
 setQuality(value){const ratio=value==='ultra'?Math.min(devicePixelRatio,2):value==='balanced'?1:Math.min(devicePixelRatio,1.75);this.renderer.setPixelRatio(ratio);this.ao.enabled=value!=='balanced';this.sun.shadow.mapSize.setScalar(value==='ultra'?4096:2048);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.resize();}
 enterCinema(){this.mode='cinema';this.parkRoot.visible=false;this.projects.visible=false;this.ground.visible=false;this.cinema.root.visible=true;this.scene.background=new THREE.Color('#121821');this.scene.fog=new THREE.Fog('#121821',35,75);this.sun.intensity=.05;this.hemisphere.intensity=.2;this.scene.environmentIntensity=.1;this.bloom.strength=.22;this.controls.minDistance=6;this.controls.maxDistance=28;this.controls.enablePan=false;this.controls.maxPolarAngle=Math.PI*.53;this.move([.2,5.3,13],[0,5.1,-13]);}
 leaveCinema(){this.video.pause();this.mode='park';this.parkRoot.visible=true;this.projects.visible=true;this.ground.visible=true;this.cinema.root.visible=false;this.scene.fog=new THREE.Fog('#f2eee5',105,210);this.scene.environmentIntensity=.4;this.controls.minDistance=22;this.controls.maxDistance=95;this.controls.maxPolarAngle=Math.PI*.43;this.controls.enablePan=true;this.setNight(this.night);this.overview();}
 setTime(time){this.capture=true;this.fixedTime=time;}
 captureImage(){return this.renderer.domElement.toDataURL('image/png');}
 dispose(){this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();this.controls.dispose();this.composer.dispose();this.renderer.dispose();}
}
