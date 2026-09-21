import {dampHeading} from '../core/camera.js';
import {buildingModel,buildingType} from './buildings.js';
import {concreteMaterial,batchStatic} from './surfaces.js';
import {detailedCar} from './vehicle.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const palette={slab:'#aaaead',floor:'#87988b',white:'#eceee8',ink:'#35493f',green:'#538b72',yellow:'#e7c274',blue:'#9eafbd'};
const unit=new THREE.BoxGeometry(1,1,1), mats=new Map();
function material(color,options={}){const key=color+JSON.stringify(options);if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.72,...options}));return mats.get(key);}
function box(parent,w,h,d,color,x=0,y=0,z=0,options={}){const mesh=new THREE.Mesh(unit,material(color,options));mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function round(parent,w,h,d,color,x,y,z,r=.2){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),material(color,{metalness:.3,roughness:.27}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(parent,r,h,color,x,y,z){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function line(parent,points,color,width=.13){if(points.length<2)return;const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(20,points.length*8),width,6,false),material(color,{emissive:color,emissiveIntensity:.18}));parent.add(mesh);return mesh;}
function label(parent,text,x,y,z,{color='#f4f3e9',background='#3d6856',width=4,height=1}={}){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,512,128);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='600 54px sans-serif';c.fillText(text,256,66,490);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;
}
function car(parent,color='#e7ece7'){
 const detailed=detailedCar(parent,color);if(detailed)return detailed;
 const root=group(parent);root.userData.wheels=[];round(root,1.82,.63,4.1,color,0,.64,0,.22);round(root,1.6,.68,2.05,'#3e5558',0,1.18,-.1,.24);round(root,1.7,.12,1.4,color,0,1.53,-.22,.15);
 for(const x of [-.91,.91])for(const z of [-1.27,1.27]){const t=cylinder(root,.36,.22,'#252b2b',x,.43,z);t.rotation.z=Math.PI/2;const hub=cylinder(root,.21,.235,'#adb7b6',x,.43,z);hub.rotation.z=Math.PI/2;root.userData.wheels.push(t,hub);}
 for(const x of [-.63,.63]){box(root,.38,.11,.05,'#fff7d9',x,.81,2.06,{emissive:'#fff2b4',emissiveIntensity:.4});box(root,.42,.1,.06,'#9f5347',x,.8,-2.06);}
 box(root,.73,.22,.05,'#dfe4df',0,.47,-2.065);return root;
}
function person(parent){const root=group(parent);const body=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.5,4,8),material('#ce784c'));body.position.y=1.12;root.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),material('#d9b594'));head.position.y=1.72;root.add(head);const limbs=[];for(const x of [-.15,.15]){const l=box(root,.17,.64,.19,'#374646',x,.4,0);limbs.push(l);box(root,.12,.56,.14,'#ce784c',x*2.2,1.05,0);}root.userData.limbs=limbs;return root;}
function tree(parent,x,z,scale=1){const g=group(parent,x,0,z);cylinder(g,.12,1.7,'#82755e',0,.85,0);for(const [a,b,c,r] of [[0,2.2,0,.85],[-.4,1.85,.2,.6],[.4,1.95,-.1,.6]]){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),material('#77957b'));m.position.set(a,b,c);m.castShadow=true;g.add(m);}g.scale.setScalar(scale);return g;}

export class AtlasScene {
 constructor(container,{onSelect,onFrame,capture=false}={}){
  this.container=container;this.onSelect=onSelect;this.onFrame=onFrame;this.capture=capture;this.mode='city';this.view='orbit';this.objects=[];this.picks=[];this.heading=0;this.elapsed=0;this.floorMaterial=concreteMaterial();this.frames=0;this.fps=0;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e6e9e3');this.scene.fog=new THREE.Fog('#e6e9e3',130,330);
  this.camera=new THREE.PerspectiveCamera(38,1,.08,800);this.camera.position.set(70,76,84);
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','3D 건축 모델. 드래그로 회전하고 스크롤로 확대합니다.');this.renderer.domElement.setAttribute('role','img');container.append(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI*.48;this.controls.minDistance=5;this.controls.maxDistance=230;this.controls.target.set(0,0,0);
  this.scene.add(new THREE.HemisphereLight('#f7faf7','#879689',1.3));const sun=new THREE.DirectionalLight('#fff5dc',2.4);sun.position.set(-45,80,35);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:220});sun.shadow.normalBias=.12;sun.shadow.bias=-.0003;this.scene.add(sun);
  const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.5;room.dispose();pmrem.dispose();
  this.world=group(this.scene);this.pathGroup=group(this.scene);this.hazards=group(this.scene);this.car=car(this.scene,'#afbfad');this.person=person(this.scene);this.car.visible=false;this.person.visible=false;
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.ao=new SSAOPass(this.scene,this.camera,1,1);this.ao.kernelRadius=8;this.ao.minDistance=.001;this.ao.maxDistance=.08;this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());
  this.raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let down=null;
  this.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=container.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(pointer,this.camera);const hit=this.raycaster.intersectObjects(this.picks,true)[0];if(hit){let obj=hit.object;while(obj&&!obj.userData.siteId)obj=obj.parent;this.onSelect?.(obj?.userData.siteId);}});
  this.contextLost=e=>{e.preventDefault();container.dataset.ready='false';container.dispatchEvent(new CustomEvent('atlas-error',{detail:'그래픽 연결이 끊겼습니다. 페이지를 새로고침해 주세요.'}));};this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();this.last=performance.now();this.fpsAt=this.last;
  this.renderer.setAnimationLoop(now=>this.frame(now));
 }
 clear(root){root.traverse(o=>{if(o.isMesh){if(o.geometry!==unit&&!o.geometry.userData.sharedVehicle)o.geometry.dispose();if(o.material?.map&&!o.material.userData.persistent){o.material.map.dispose();o.material.dispose();}}});root.clear();}
 reset(){this.clear(this.world);this.clear(this.pathGroup);this.clear(this.hazards);this.picks=[];this.ceiling=null;this.car.visible=false;this.person.visible=false;this.view='orbit';this.cameraYaw=null;this.cameraPosition=null;this.controls.enabled=true;}
 async ready(){
  const version=this.readyVersion=(this.readyVersion||0)+1;this.container.dataset.ready='false';this.resize();await this.floorMaterial.userData.ready;
  if(version!==this.readyVersion)return;
  // compileAsync polls material programs after disposal during rapid scene changes.
  // Compile the latest scene in one synchronous turn so reset cannot invalidate it.
  this.renderer.compile(this.scene,this.camera);this.container.dataset.ready='true';
 }
 showCity(sites){
  this.reset();this.mode='city';this.camera.position.set(86,95,110);this.controls.target.set(0,2,0);
  box(this.world,150,1,112,'#d2d9cc',0,-1,0);box(this.world,152,.07,17,'#a0bcc0',0,-.43,13);
  for(let x=-65;x<75;x+=14)box(this.world,1.1,.035,110,'#eeefe7',x,-.4,0);for(let z=-48;z<52;z+=13)box(this.world,148,.035,.9,'#eeefe7',0,-.38,z);
  let seed=7;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<230;i++){const x=rand()*138-69,z=rand()*98-49;if(z>3&&z<24)continue;const h=1+rand()*6;box(this.world,2+rand()*3,h,2+rand()*3,'#c5cdc1',x,h/2-.3,z);}
  sites.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).forEach((site,i)=>{const x=(site.lng-126.99)*290,z=-(site.lat-37.56)*420;const root=group(this.world,x,0,z);root.userData.siteId=site.id;
   const model=buildingModel(buildingType(site));model.scale.setScalar(.35);root.add(model);
   const ring=new THREE.Mesh(new THREE.RingGeometry(7,7.2,48),new THREE.MeshBasicMaterial({color:'#5c8d76',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;root.add(ring);this.picks.push(root);label(root,String(i+1).padStart(2,'0'),0,12,0,{width:3,height:1.4});
  });
  for(let i=0;i<45;i++)tree(this.world,rand()*135-67,-24+rand()*10,.7+rand()*.6);
  this.ready();
 }
 showPlan(plan,{garage=false}={}){
  this.reset();this.mode=garage?'garage':'plan';this.plan=plan;
  const span=Math.max(plan.width,plan.depth);this.camera.position.set(span*.94,span*1.06,span*1.11);this.controls.target.set(0,0,0);this.controls.maxDistance=Math.max(80,span*3);
  box(this.world,plan.width+2,1.0,plan.depth+2,palette.slab,0,-.7,0);const floor=box(this.world,plan.width,.12,plan.depth,palette.floor,0,-.13,0);floor.material=this.floorMaterial;
  // Fine concrete joints and aggregate-like tonal lines provide scale without textures.
  for(let x=-plan.width/2;x<plan.width/2;x+=6)box(this.world,.025,.015,plan.depth,'#aebbb1',x,-.058,0);
  for(let z=-plan.depth/2;z<plan.depth/2;z+=6)box(this.world,plan.width,.015,.025,'#aebbb1',0,-.058,z);
  for(const wall of plan.walls){const length=Math.hypot(wall.x2-wall.x1,wall.z2-wall.z1);if(length<.02)continue;const m=box(this.world,length,wall.height,wall.thickness,palette.white,(wall.x1+wall.x2)/2,wall.height/2,(wall.z1+wall.z2)/2);m.rotation.y=-Math.atan2(wall.z2-wall.z1,wall.x2-wall.x1);}
  if(garage)this.garageDetails(plan);
  batchStatic(this.world);this.ready();
 }
 showSourceBlueprint(plan){
  if(!plan.sourceAsset)return;
  const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.78,depthWrite:false,side:THREE.DoubleSide});
  const overlay=new THREE.Mesh(new THREE.PlaneGeometry(plan.width,plan.depth),material);overlay.name='source-blueprint';overlay.rotation.x=-Math.PI/2;overlay.position.y=-.025;this.world.add(overlay);
  new THREE.TextureLoader().load(plan.sourceAsset,texture=>{
   if(overlay.parent!==this.world){texture.dispose();material.dispose();return;}
   texture.colorSpace=THREE.SRGBColorSpace;const crop=plan.sourceCrop;
   if(crop){texture.repeat.set(crop.width,crop.height);texture.offset.set(crop.x,1-crop.y-crop.height);}
   material.map=texture;material.needsUpdate=true;overlay.userData.ready=true;
  },undefined,()=>{overlay.visible=false;});
 }
 garageDetails(plan){
  if(plan.layoutType==='source-traced'){this.sourceGarageDetails(plan);return;}
  for(const e of plan.edges){const a=plan.nodes.find(n=>n.id===e.from),b=plan.nodes.find(n=>n.id===e.to);if(!e.modes.includes('car')){line(this.world,[new THREE.Vector3(a.x,.04,a.z),new THREE.Vector3(b.x,.04,b.z)],'#85b4a0',.33);continue;}
   const len=Math.hypot(b.x-a.x,b.z-a.z),angle=-Math.atan2(b.z-a.z,b.x-a.x);for(let t=2;t<len;t+=3){const m=box(this.world,1.2,.014,.12,'#edf0d9',a.x+(b.x-a.x)*t/len,.015,a.z+(b.z-a.z)*t/len);m.rotation.y=angle;}
  }
  let i=0;for(const s of plan.spaces){if(s.kind==='parking'){
   for(const dx of [-s.width/2,s.width/2])box(this.world,.07,.02,s.depth,'#f1f1d9',s.x+dx,.04,s.z);box(this.world,s.width,.02,.07,'#f1f1d9',s.x,.04,s.z-s.depth/2);
   box(this.world,1.6,.15,.19,'#595d52',s.x,.085,s.z-s.depth/2+.5);if(i++%4===1){const c=car(this.world,['#d5d6ce','#526678','#a6b6aa','#a79c8c','#6c7a78'][i%5]);c.position.set(s.x,0,s.z);}
  }else if(s.kind==='core'){
   box(this.world,s.width,3.6,s.depth,'#e5e5db',s.x,1.8,s.z);box(this.world,s.width+.05,.7,s.depth+.05,palette.green,s.x,2.7,s.z);
   const front=s.z<0?s.z+s.depth/2+.03:s.z-s.depth/2-.03;
   box(this.world,1.9,2.25,.1,'#6c8583',s.x,1.125,front,{metalness:.7,roughness:.28});box(this.world,.05,2.25,.13,'#b1beb6',s.x,1.125,front);
   const sign=label(this.world,s.label,s.x,2.75,front+(s.z<0?.07:-.07),{width:3,height:.62});if(s.z>0)sign.rotation.y=Math.PI;
   label(this.world,s.label,s.x,4.1,s.z,{width:4,height:1});
  }}
  for(const x of [-37,-22,-7,8,23,37])for(const z of [-12,6]){
   box(this.world,.65,3.4,.65,'#e8e9df',x,1.7,z);box(this.world,.67,.8,.67,palette.green,x,1.25,z);box(this.world,.71,.15,.71,palette.yellow,x,.4,z);
   box(this.world,8,.13,.3,'#a2aaa4',x,3.42,z);box(this.world,3,.05,.18,'#fcfae7',x,3.34,z,{emissive:'#fff5d9',emissiveIntensity:.6});
  }
  for(const x of [-36,36]){const pipe=cylinder(this.world,.09,47,'#b75e4d',x,3.15,0);pipe.rotation.x=Math.PI/2;}
  for(const exit of plan.nodes.filter(n=>n.kind==='exit')){box(this.world,2.5,.035,3.8,'#79a78b',exit.x,.04,exit.z);label(this.world,'EXIT →',exit.x,2.7,exit.z,{width:3.5,height:.8});}
  label(this.world,'B1   /   ATLAS',0,2.9,-27,{width:9,height:1.2});label(this.world,'ENTRANCE',0,.04,23,{width:5,height:.7}).rotation.x=-Math.PI/2;
  this.ceiling=box(this.world,plan.width,.2,plan.depth,'#c6ccc1',0,3.7,0);this.ceiling.visible=false;this.ceiling.userData.dynamic=true;this.car.visible=true;this.setPose({x:0,z:27,heading:Math.PI},'car');
 }
 sourceGarageDetails(plan){
  for(const edge of plan.edges){const a=plan.nodes.find(n=>n.id===edge.from),b=plan.nodes.find(n=>n.id===edge.to),length=Math.hypot(b.x-a.x,b.z-a.z);for(let t=1;t<length;t+=3){const mark=box(this.world,1.1,.02,.1,'#f3efce',a.x+(b.x-a.x)*t/length,.02,a.z+(b.z-a.z)*t/length);mark.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);}}
  let count=0;
  for(const s of plan.spaces){
   if(s.kind==='core'){box(this.world,s.width,3.4,s.depth,'#e0e3d9',s.x,1.7,s.z);box(this.world,s.width+.04,.6,s.depth+.04,'#638d78',s.x,2.7,s.z);label(this.world,s.label,s.x,3.9,s.z,{width:5,height:.85});continue;}
   for(const x of [-s.width/2,s.width/2])box(this.world,.06,.02,s.depth,'#efeedd',s.x+x,.035,s.z);for(const z of [-s.depth/2,s.depth/2])box(this.world,s.width,.02,.06,'#efeedd',s.x,.035,s.z+z);
   if(count++%12===1){const parked=car(this.world,['#d8ded6','#678082','#aaa59a'][count%3]);parked.position.set(s.x,0,s.z);if(s.width>s.depth)parked.rotation.y=Math.PI/2;}
  }
  for(const x of [-12,-3,6,15,24])for(const z of [-2,15,31]){box(this.world,.5,3.3,.5,'#e1e4db',x,1.65,z);box(this.world,.52,.65,.52,'#698674',x,1.2,z);box(this.world,5,.1,.22,'#bfc9c0',x,3.35,z);box(this.world,2.5,.05,.15,'#fff9dd',x,3.25,z,{emissive:'#fff5ce',emissiveIntensity:.6});}
  const entrance=plan.nodes.find(n=>n.kind==='entrance');this.setPose({...entrance,heading:entrance.heading},'car');
 }
 showExterior(plan){
  this.reset();this.mode='exterior';const scale=Math.min(1,40/Math.max(plan.width,plan.depth));
  box(this.world,80,.8,60,'#d7ddcf',0,-.6,0);const building=group(this.world);building.scale.setScalar(scale);
  for(let floor=0;floor<5;floor++){box(building,plan.width,.2,plan.depth,'#d0d3c8',0,floor*3.1,0);for(const w of plan.walls){const m=box(building,Math.hypot(w.x2-w.x1,w.z2-w.z1),2.8,w.thickness,'#e6e8e0',(w.x1+w.x2)/2,floor*3.1+1.5,(w.z1+w.z2)/2);m.rotation.y=-Math.atan2(w.z2-w.z1,w.x2-w.x1);}}
  for(let i=0;i<16;i++)tree(this.world,Math.cos(i/16*Math.PI*2)*30,Math.sin(i/16*Math.PI*2)*23,1.5);
  this.camera.position.set(53,45,55);this.controls.target.set(0,5,0);this.ready();
 }
 setRoute(route,color='#5baf88'){this.clear(this.pathGroup);if(!route)return;line(this.pathGroup,route.points.map(p=>new THREE.Vector3(p.x,.16,p.z)),color,.07);const end=route.points.at(-1);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.1,8,40),material(color,{emissive:color,emissiveIntensity:.3}));ring.rotation.x=Math.PI/2;ring.position.set(end.x,.2,end.z);this.pathGroup.add(ring);}
 setHazards(hazards){this.clear(this.hazards);for(const h of hazards){const disk=new THREE.Mesh(new THREE.CylinderGeometry(h.radius,h.radius,.1,48),new THREE.MeshStandardMaterial({color:'#ce6844',transparent:true,opacity:.35}));disk.position.set(h.x,.13,h.z);this.hazards.add(disk);for(let i=0;i<8;i++){const smoke=new THREE.Mesh(new THREE.IcosahedronGeometry(.8+i*.12,1),new THREE.MeshStandardMaterial({color:i<3?'#cc8b5a':'#747a72',transparent:true,opacity:.45}));smoke.position.set(h.x+Math.sin(i*2)*1.2,1+i*.55,h.z+Math.cos(i)*1.2);this.hazards.add(smoke);}label(this.hazards,'위험 구역',h.x,6,h.z,{background:'#a15037',width:5,height:1});}}
 setPose(pose,mode){const movement=this.pose?Math.hypot(pose.x-this.pose.x,pose.z-this.pose.z):0;this.walkPhase=(this.walkPhase||0)+movement*5;this.person.userData.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(this.walkPhase+i*Math.PI)*.6);this.car.userData.wheels.forEach(wheel=>wheel.rotation.x+=movement/.36);this.pose={...pose};this.moveMode=mode;this.car.visible=mode==='car';this.person.visible=mode==='person';const body=mode==='car'?this.car:this.person;body.position.set(pose.x,0,pose.z);body.rotation.y=pose.heading;this.heading=pose.heading;}
 setView(view){this.view=view;this.cameraYaw=this.pose?.heading;this.cameraPosition=null;if(this.ceiling)this.ceiling.visible=view==='first';this.controls.enabled=view==='orbit';if(view==='orbit'&&this.plan){const span=Math.max(this.plan.width,this.plan.depth);this.camera.position.set(span*.94,span*1.06,span*1.11);this.controls.target.set(0,0,0);}this.camera.clearViewOffset();this.resize();this.car.visible=this.moveMode==='car'&&view!=='first';this.person.visible=this.moveMode==='person'&&view!=='first';}
 resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;if(this.mode!=='city'&&this.view==='orbit')this.camera.setViewOffset(width,height,width*.13,0,width,height);else this.camera.clearViewOffset();this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.composer.setSize(width,height);this.ao.setSize(Math.round(width*.6),Math.round(height*.6));}
 frame(now){const delta=Math.min(.12,(now-this.last)/1000);this.last=now;this.elapsed+=delta;this.onFrame?.(delta);if(this.view!=='orbit'&&this.pose){const p=this.pose;this.cameraYaw=dampHeading(this.cameraYaw??p.heading,p.heading,delta);const forward=new THREE.Vector3(Math.sin(this.cameraYaw),0,Math.cos(this.cameraYaw));const target=new THREE.Vector3(p.x,this.moveMode==='person'?1.65:1.45,p.z);if(this.view==='first'){const desired=target.clone().addScaledVector(forward,.6);if(!this.cameraPosition)this.cameraPosition=desired.clone();this.cameraPosition.lerp(desired,1-Math.exp(-12*delta));this.camera.position.copy(this.cameraPosition);this.camera.lookAt(this.camera.position.clone().addScaledVector(forward,8));}else{this.camera.position.lerp(target.clone().addScaledVector(forward,-9).add(new THREE.Vector3(0,5,0)),.1);this.camera.lookAt(target.clone().addScaledVector(forward,3));}this.car.visible=this.moveMode==='car'&&this.view!=='first';this.person.visible=this.moveMode==='person'&&this.view!=='first';}else this.controls.update();
  if(this.container.clientWidth&&this.container.clientHeight)this.composer.render();this.frames++;if(now-this.fpsAt>1000){this.fps=Math.round(this.frames*1000/(now-this.fpsAt));this.frames=0;this.fpsAt=now;}
 }
 dispose(){this.readyVersion=(this.readyVersion||0)+1;this.renderer.setAnimationLoop(null);this.observer.disconnect();this.controls.dispose();this.clear(this.world);this.clear(this.pathGroup);this.clear(this.hazards);this.environment.dispose();this.composer.dispose();this.renderer.dispose();}
}
