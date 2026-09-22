import * as THREE from '../vendor/three.module.js';
import {assignLooks,drawBallLook} from './ball-looks.js';
import {installBoardTap} from './board-tap.js';
import {placeLabels} from './label-layout.js';
import {LANDS} from './lands.js';
import {batchStaticMeshes} from './geometry-batch.js';
import {returnPose,returnGateSegments} from './return-portals.js';
import {devicePose} from './devices.js';
import {rotorPose} from './physics.js';
const S=1/60, X=x=>(x-310)*S, Z=y=>y*S;
const UP=new THREE.Vector3(0,1,0);
const CAMERA_DIRECTIONS=[new THREE.Vector3(.18,.72,.67).normalize(),new THREE.Vector3(.35,.60,.72).normalize(),new THREE.Vector3(0,.995,.1).normalize()];

export class Renderer3D {
 constructor(canvas){
  Object.assign(this,{canvas,ballTheme:'sports',zoomTarget:null,labelOffsets:new Map(),mode:'webgl',overview:false,halfView:false,angle:2,lastRound:null,cameraCenter:400,finishedAt:new Map()});
  this.webgl=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  this.webgl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=THREE.PCFShadowMap;
  this.webgl.outputColorSpace=THREE.SRGBColorSpace;this.webgl.toneMapping=THREE.ACESFilmicToneMapping;this.webgl.toneMappingExposure=.88;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.1,180);
  this.scene.add(new THREE.HemisphereLight(0xfff4e7,0x887393,1.0));
  this.light=new THREE.DirectionalLight(0xfff1de,2.3);this.light.castShadow=true;this.light.shadow.mapSize.set(1024,1024);
  Object.assign(this.light.shadow.camera,{left:-11,right:11,top:15,bottom:-15,near:.1,far:55});
  this.light.shadow.normalBias=.025;this.light.shadow.bias=-.0002;this.scene.add(this.light,this.light.target);
  const rim=new THREE.DirectionalLight(0xc9dfff,.65);rim.position.set(8,6,15);this.scene.add(rim);
  const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,64);g.addColorStop(0,i===2?'#fffaf2':'#eee1fa');g.addColorStop(.5,'#af9ec9');g.addColorStop(1,'#473f6a');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);ctx.fillStyle='#fff9ec';ctx.fillRect(6,6,44,12);return c;});
  this.environment=new THREE.CubeTexture(faces);this.environment.needsUpdate=true;this.scene.environment=this.environment;
  this.labels=this.overlay('ball-labels');this.hud=this.overlay('camera-hud');this.progress=this.overlay('course-progress');
  this.angleButton=document.createElement('button');this.angleButton.className='camera-angle';this.angleButton.type='button';this.angleButton.textContent='◈ 상단 시점';this.angleButton.setAttribute('aria-label','3D 카메라 시점 변경');
  this.angleButton.addEventListener('click',()=>{this.resetZoom();this.angle=(this.angle+1)%3;this.angleButton.textContent=['◈ 입체 시점','◈ 측면 시점','◈ 상단 시점'][this.angle];});canvas.parentElement.append(this.angleButton);
  this.allLabels=true;this.labelButton=document.createElement('button');this.labelButton.className='label-toggle';this.labelButton.type='button';this.labelButton.textContent='이름 숨기기';this.labelButton.setAttribute('aria-label','공 이름표 표시');this.labelButton.setAttribute('aria-pressed','true');
  this.labelButton.addEventListener('click',()=>{this.allLabels=!this.allLabels;this.labelButton.textContent=this.allLabels?'이름 숨기기':'이름 표시';this.labelButton.setAttribute('aria-pressed',String(this.allLabels));});canvas.parentElement.append(this.labelButton);
  this.zoomButton=document.createElement('button');this.zoomButton.className='zoom-reset';this.zoomButton.textContent='↙ 확대 원래대로';this.zoomButton.hidden=true;this.zoomButton.addEventListener('click',()=>this.resetZoom());canvas.parentElement.append(this.zoomButton);
  installBoardTap(canvas,(x,y)=>this.toggleZoom(x,y),()=>this.resetZoom());
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new Event('pinball-renderer-lost'));});
  canvas.addEventListener('webglcontextrestored',()=>document.dispatchEvent(new Event('pinball-renderer-restored')));
 }
 resetZoom(){this.zoomTarget=null;if(this.zoomButton)this.zoomButton.hidden=true;}
 toggleZoom(clientX,clientY){
  if(this.zoomTarget){this.resetZoom();return;}if(!this.group)return;
  const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  // Generous touch hit area: choose the closest visible ball before the ground.
  const ball=[...this.balls.entries()].filter(([,e])=>e.pick?.visible).map(([id,e])=>({id,d:Math.hypot(x-e.pick.x,y-e.pick.y)})).sort((a,b)=>a.d-b.d)[0];
  if(ball&&ball.d<=22)this.zoomTarget={kind:'ball',id:ball.id};
  else{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),this.camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0).applyMatrix4(this.group.matrixWorld),point=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,point))return;this.group.worldToLocal(point);if(Math.abs(point.x)>5.3||point.z<0||point.z>Z(this.map.height))return;this.zoomTarget={kind:'area',x:point.x,y:point.z/S};}
  this.zoomButton.hidden=false;
 }
 overlay(className){const e=document.createElement('div');e.className=className;this.canvas.parentElement.append(e);return e;}
 resize(){const ratio=Math.min(devicePixelRatio||1,1.5);if(this.webgl.getPixelRatio()!==ratio)this.webgl.setPixelRatio(ratio);const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.webgl.setSize(this.width,this.height,false);this.aspect=this.width/this.height;}
 material(color,metalness=.05,roughness=.48){const m=new THREE.MeshStandardMaterial({color,metalness,roughness});m.envMapIntensity=.2;return m;}
 mesh(geometry,material,x=0,y=0,z=0,parent=this.group){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 instances(geometry,material,items){
  const mesh=new THREE.InstancedMesh(geometry,material,items.length),o=new THREE.Object3D();
  items.forEach((p,i)=>{o.position.set(...p.position);o.scale.set(...(p.scale||[1,1,1]));o.rotation.set(...(p.rotation||[0,0,0]));o.updateMatrix();mesh.setMatrixAt(i,o.matrix);if(p.color!==undefined)mesh.setColorAt(i,new THREE.Color(p.color));});
  mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);return mesh;
 }
 rail(s,mat,parent=this.group,y=.15){
  const dx=(s.bx-s.ax)*S,dz=(s.by-s.ay)*S,length=Math.hypot(dx,dz);
  const m=this.mesh(new THREE.CapsuleGeometry(s.r*S,Math.max(.001,length),3,8),mat,X((s.ax+s.bx)/2),y,Z((s.ay+s.by)/2),parent);
  m.quaternion.setFromUnitVectors(UP,new THREE.Vector3(dx,0,dz).normalize());return m;
 }
 ring(x,z,r,material,y=.07,tube=.055,parent=this.group){const m=this.mesh(new THREE.TorusGeometry(r,tube,6,32),material,x,y,z,parent);m.rotation.x=Math.PI/2;return m;}
 text(text,y,size=3.5,opacity=.5,x=310){
  const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.font='800 94px sans-serif';ctx.textAlign='center';ctx.fillStyle=`rgba(255,250,235,${opacity})`;ctx.fillText(text,512,113);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const m=this.mesh(new THREE.PlaneGeometry(size,size*160/1024),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),X(x),.015,Z(y));m.rotation.x=-Math.PI/2;m.castShadow=false;
 }
 stripeTexture(colorA,colorB){
  const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d');
  for(let x=0;x<128;x+=16){ctx.fillStyle=x%32?colorA:colorB;ctx.fillRect(x,0,16,64);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 clear(){
  if(this.ground){this.scene.remove(this.ground);this.ground.geometry.dispose();this.ground.material.dispose();this.ground=null;}
  if(!this.group)return;this.scene.remove(this.group);const geometries=new Set(),materials=new Set(),textures=new Set();
  this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);if(m.map)textures.add(m.map);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
 }
 carousel(p,mat){
  const r=p.r*S,x=X(p.x),z=Z(p.y),ride=new THREE.Group();ride.position.set(x,0,z);this.group.add(ride);
  this.mesh(new THREE.CylinderGeometry(r,r,.2,24),mat.dark,0,.1,0,ride);
  this.mesh(new THREE.CylinderGeometry(r*.97,r*.97,.1,24),mat.cream,0,.23,0,ride);
  this.ring(0,0,r*.92,mat.gold,.30,.035,ride);
  this.mesh(new THREE.CylinderGeometry(r*.11,r*.13,.48,8),mat.gold,0,.51,0,ride);
  const roof=this.mesh(new THREE.ConeGeometry(r*.9,.43,16),mat.canopy,0,.94,0,ride);
  this.mesh(new THREE.SphereGeometry(.055,8,6),mat.gold,0,1.2,0,ride);
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+.4,cx=Math.cos(a)*r*.63,cz=Math.sin(a)*r*.63;
   this.mesh(new THREE.CylinderGeometry(.025,.025,.49,6),mat.gold,cx,.56,cz,ride);
   const car=this.mesh(new THREE.SphereGeometry(r*.18,10,8),i%2?mat.pink:mat.mint,cx,.44,cz,ride);car.scale.y=.65;
  }
  const index=this.carousels.length;this.carousels.push({roof,ride,baseY:.94,phase:p.x*.01,rate:(.14+(index%5)*.07)*(index%2?-1:1),key:`${p.x}:${p.y}`,hitAt:-10});
 }
 saucer(p,mat){
  const r=p.r*S,ride=new THREE.Group();ride.position.set(X(p.x),0,Z(p.y));this.group.add(ride);
  this.mesh(new THREE.CylinderGeometry(r*.95,r,.19,28),mat.dark,0,.10,0,ride);
  this.mesh(new THREE.CylinderGeometry(r*.67,r*.97,.18,28),mat.mint,0,.27,0,ride);
  this.ring(0,0,r*.88,mat.neonCyan,.32,.047,ride);
  const roof=this.mesh(new THREE.SphereGeometry(r*.52,20,12,0,Math.PI*2,0,Math.PI/2),mat.glass,0,.37,0,ride);roof.scale.y=.85;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;this.mesh(new THREE.SphereGeometry(.046,7,5),i%2?mat.neonPink:mat.neonGold,Math.cos(a)*r*.79,.38,Math.sin(a)*r*.79,ride);}
  this.carousels.push({roof,ride,baseY:.37,phase:p.x*.01,rate:-.24,key:`${p.x}:${p.y}`,hitAt:-10});
 }
 bumperCar(p,mat){
  const r=p.r*S,ride=new THREE.Group();ride.position.set(X(p.x),0,Z(p.y));this.group.add(ride);
  this.mesh(new THREE.CylinderGeometry(r,r,.18,24),mat.dark,0,.1,0,ride);this.ring(0,0,r*.88,mat.neonPink,.23,.05,ride);
  const roof=new THREE.Group();roof.position.y=.28;ride.add(roof);
  const body=this.mesh(new THREE.CapsuleGeometry(r*.31,r*.72,3,12),mat.pink,0,0,0,roof);body.rotation.z=Math.PI/2;
  this.mesh(new THREE.BoxGeometry(r*.5,r*.21,r*.44),mat.dark,-r*.05,.16,0,roof);
  this.mesh(new THREE.BoxGeometry(r*.15,r*.28,r*.47),mat.cream,-r*.29,.19,0,roof);
  for(const z of [-1,1])this.mesh(new THREE.SphereGeometry(r*.06,8,6),mat.neonGold,r*.55,.06,z*r*.21,roof);
  this.mesh(new THREE.CylinderGeometry(.018,.018,.62,5),mat.gold,-r*.46,.53,0,roof);
  this.mesh(new THREE.SphereGeometry(.055,8,6),mat.neonCyan,-r*.46,.87,0,roof);
  batchStaticMeshes(roof);this.carousels.push({roof,ride,baseY:.28,phase:p.x*.01,rate:.21,key:`${p.x}:${p.y}`,hitAt:-10});
 }
 windmill(r,mat){
  const g=new THREE.Group();g.position.set(X(r.x),.2,Z(r.y));this.group.add(g);const length=r.length*S;
  for(let i=0;i<2;i++){
   const arm=this.mesh(new THREE.CapsuleGeometry(9*S,length*2,3,8),i?mat.mint:mat.pink,0,0,0,g);arm.rotation.z=Math.PI/2;arm.rotation.y=i*Math.PI/2;
   for(const sign of [-1,1]){const a=i*Math.PI/2,x=Math.cos(a)*sign*length*.86,z=Math.sin(a)*sign*length*.86;this.mesh(new THREE.CylinderGeometry(.105,.105,.065,8),i?mat.neonPink:mat.neonCyan,x,.17,z,g);}
  }
  this.mesh(new THREE.ConeGeometry(.21,.4,6),mat.gold,0,.23,0,g);return g;
 }
 pirateShip(r,mat){
  const g=new THREE.Group();g.position.set(X(r.x),.2,Z(r.y));this.group.add(g);const length=r.length*S;
  const hull=this.mesh(new THREE.CapsuleGeometry(9*S,length*2,3,10),mat.dark,0,0,0,g);hull.rotation.z=Math.PI/2;
  this.mesh(new THREE.BoxGeometry(length*1.75,.12,.23),mat.gold,0,.16,0,g);
  for(const x of [-length*.65,0,length*.65])this.mesh(new THREE.BoxGeometry(.11,.17,.27),mat.pink,x,.27,0,g);
  this.mesh(new THREE.CylinderGeometry(.035,.035,.87,7),mat.cream,0,.55,0,g);
  const sail=new THREE.Shape();sail.moveTo(-length*.32,0);sail.lineTo(length*.35,.13);sail.lineTo(0,.58);sail.closePath();
  const flag=this.mesh(new THREE.ShapeGeometry(sail),mat.sail,0,.49,.025,g);flag.rotation.x=-.35;
  for(const x of [-length*.88,length*.88])this.mesh(new THREE.SphereGeometry(.07,8,6),mat.neonPink,x,.18,0,g);return g;
 }
 teacupRotor(r,mat){
  const g=new THREE.Group();g.position.set(X(r.x),.20,Z(r.y));this.group.add(g);const length=r.length*S;
  const arm=this.mesh(new THREE.CapsuleGeometry(9*S,length*2,3,8),mat.cream,0,0,0,g);arm.rotation.z=Math.PI/2;
  this.mesh(new THREE.CylinderGeometry(.18,.18,.21,12),mat.gold,0,.1,0,g);
  for(const sign of [-1,1]){
   const x=sign*length*.82;
   this.mesh(new THREE.CylinderGeometry(.145,.10,.17,12),sign<0?mat.pink:mat.mint,x,.16,0,g);
   const rim=this.mesh(new THREE.TorusGeometry(.123,.025,5,12),mat.cream,x,.245,0,g);rim.rotation.x=Math.PI/2;
   this.mesh(new THREE.CylinderGeometry(.105,.105,.02,12),mat.dark,x,.238,0,g);
  }
  return g;
 }
 train(s,mat){
  const g=new THREE.Group();g.position.set(X(s.x),.16,Z(s.y));this.group.add(g);const length=s.length*S;
  const base=this.mesh(new THREE.CapsuleGeometry(10*S,length*2,3,8),mat.gold,0,0,0,g);base.rotation.z=Math.PI/2;
  const carLength=length*2/3*.83;
  for(let i=0;i<3;i++){
   const x=(i-1)*length*2/3;
   this.mesh(new THREE.BoxGeometry(carLength,.18,.27),i===0?mat.pink:mat.mint,x,.17,0,g);
   this.mesh(new THREE.BoxGeometry(carLength*.72,.12,.22),mat.cream,x,.31,0,g);
   this.mesh(new THREE.BoxGeometry(carLength*.46,.035,.16),mat.dark,x,.39,0,g);
  }
  this.mesh(new THREE.CylinderGeometry(.06,.06,.14,8),mat.gold,-length*.76,.37,0,g);
  return g;
 }
 bumperShuttle(s,mat){
  const g=new THREE.Group();g.position.set(X(s.x),.16,Z(s.y));this.group.add(g);const length=s.length*S;
  const base=this.mesh(new THREE.CapsuleGeometry(10*S,length*2,3,8),mat.dark,0,0,0,g);base.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
   const x=side*length*.5;
   this.mesh(new THREE.BoxGeometry(length*.65,.17,.29),side<0?mat.pink:mat.mint,x,.15,0,g);
   this.mesh(new THREE.BoxGeometry(length*.28,.09,.20),mat.dark,x,.28,0,g);
   this.mesh(new THREE.BoxGeometry(length*.06,.16,.24),mat.cream,x-side*length*.13,.3,0,g);
   this.mesh(new THREE.SphereGeometry(.05,7,5),mat.neonGold,x+side*length*.29,.24,0,g);
  }
  return g;
 }
 neonCourse(map,mat){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.52)');gradient.addColorStop(.5,'rgba(255,255,255,.22)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(c);this.neonHalos=[];
  const neon=[mat.neonPink,mat.neonCyan,mat.neonGold];
  for(let sector=0;sector<3;sector++){
   const y=500+sector*650,color=[0xff4fa4,0x41e9ff,0xffca54][sector];
   const glow=new THREE.MeshBasicMaterial({map:texture,color,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending});
   for(const side of [-1,1]){
    const h=this.mesh(new THREE.PlaneGeometry(3.5,5.5),glow,X(side<0?70:550),.035,Z(y));h.rotation.x=-Math.PI/2;h.castShadow=false;h.receiveShadow=false;this.neonHalos.push(h);
    for(let i=0;i<4;i++)this.rail({ax:side<0?36:584,ay:y-120+i*75,bx:side<0?36:584,by:y-72+i*75,r:3},neon[sector],this.group,.27);
    const post=this.mesh(new THREE.CylinderGeometry(.065,.065,1.8,8),neon[sector],side*5.1,.72,Z(y));post.castShadow=false;
    const star=this.mesh(new THREE.OctahedronGeometry(.22),neon[sector],side*5.1,1.75,Z(y));star.castShadow=false;
   }
   this.ring(0,Z(y+110),.78,neon[sector],.028,.022);
  }
  for(const b of map.bumpers)this.ring(X(b.x),Z(b.y),b.r*S+.10,b.ride==='ufo'?mat.neonCyan:mat.neonPink,.026,.021);
 }
 scenery(map,mat,theme){
  // All scenery lives outside the playable rails; it has no hidden collider.
  const length=map.height*S;
  const shrubs=[],stems=[],bulbs=[];
  for(let i=0;i<14;i++)for(const sign of [-1,1]){
   const x=sign*(5.7+(i%3)*.28),z=1.5+i*2.5;
   stems.push({position:[x,-.58,z],scale:[.06,.55,.06]});
   shrubs.push({position:[x,-.05,z],scale:[.32+(i%2)*.1,.46,.32],color:i%3?theme.secondary:theme.accent});
  }
  this.instances(new THREE.CylinderGeometry(1,1,1,6),mat.gold,stems);
  this.instances(new THREE.SphereGeometry(1,10,7),mat.cream,shrubs);
  for(let i=0;i<45;i++)for(const x of [-4.9,4.9])bulbs.push({position:[x,.27,.45+i*.82],scale:[.052,.052,.052]});
  this.instances(new THREE.SphereGeometry(1,6,5),mat.bulb,bulbs);
  // A tiny storybook entrance: towers, conical roofs and a striped ticket canopy.
  for(const x of [-4.3,4.3]){
   this.mesh(new THREE.CylinderGeometry(.42,.48,1.6,12),mat.cream,x,.2,-.48);
   this.mesh(new THREE.ConeGeometry(.61,.96,12),mat.canopy,x,1.43,-.48);
   this.mesh(new THREE.SphereGeometry(.10,8,6),mat.gold,x,1.95,-.48);
   this.mesh(new THREE.BoxGeometry(.20,.39,.05),mat.dark,x,.58,-.03);
  }
  const entry=this.mesh(new THREE.CapsuleGeometry(.10,8.6,3,8),mat.gold,0,.4,-.38);entry.rotation.z=Math.PI/2;
  for(let i=0;i<10;i++){
   const flag=new THREE.Shape();flag.moveTo(-.25,0);flag.lineTo(.25,0);flag.lineTo(0,-.42);flag.closePath();
   this.mesh(new THREE.ShapeGeometry(flag),i%2?mat.pink:mat.mint,-3.8+i*.84,.43,-.37).rotation.x=-Math.PI/4;
  }
  for(const [i,x,z] of [[0,-6.6,7],[1,6.7,19],[2,-6.6,30]]){
   const group=new THREE.Group();group.position.set(x,.9,z);this.group.add(group);
   for(let j=0;j<3;j++){
    const bx=(j-1)*.27,by=j===1?.52:.2;
    const balloon=this.mesh(new THREE.SphereGeometry(.3,12,9),[mat.pink,mat.mint,mat.gold][j],bx,by,0,group);balloon.scale.y=1.25;
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx,by-.32,0),new THREE.Vector3(0,-1.4,0)]),new THREE.LineBasicMaterial({color:theme.edge,transparent:true,opacity:.45}));group.add(line);
   }
   this.balloons.push({group,y:.9,phase:i*2.1});
  }
  this.ferris(-7.2,12,mat);this.ferris(7.3,29,mat);
  for(const [x,z] of [[-7,22],[7,4]]){
   for(let i=0;i<4;i++){const cloud=this.mesh(new THREE.SphereGeometry(.65,12,8),mat.cloud,x+(i-1.5)*.5,-.72+(i%2)*.15,z);cloud.scale.set(1,.55,.65);cloud.castShadow=false;}
  }
  for(const h of map.exits){
   const stars=[];for(let i=0;i<10;i++){const a=i*Math.PI/5;stars.push({position:[X(h.x)+Math.cos(a)*.61,.11,Z(h.y??map.finish)+Math.sin(a)*.61],scale:[.035,.035,.035]});}
   this.instances(new THREE.SphereGeometry(1,6,5),mat.bulb,stars);
  }
 }
 ferris(x,z,mat){
  const g=new THREE.Group();g.position.set(x,.7,z);g.rotation.x=-.64;this.group.add(g);
  const wheel=new THREE.Group();g.add(wheel);this.mesh(new THREE.TorusGeometry(1.15,.055,6,32),mat.gold,0,0,0,wheel);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   const spoke=this.mesh(new THREE.CylinderGeometry(.022,.022,2.3,5),mat.cream,0,0,0,wheel);spoke.rotation.z=a;
   this.mesh(new THREE.SphereGeometry(.19,8,6),i%2?mat.pink:mat.mint,Math.sin(a)*1.15,Math.cos(a)*1.15,0,wheel);
  }
  this.mesh(new THREE.SphereGeometry(.17,10,8),mat.gold,0,0,.04,g);this.wheels.push({wheel,rate:x<0?.10:-.17});
 }
 flowerGate(r,mat){
  const g=new THREE.Group();g.position.set(X(r.x),0,Z(r.y));this.group.add(g);
  const bar=this.mesh(new THREE.CapsuleGeometry(9*S,r.length*2*S,3,8),mat.mint,0,.16,0,g);bar.rotation.z=Math.PI/2;
  for(const side of [-1,1]){const leaf=this.mesh(new THREE.SphereGeometry(.14,10,7),side<0?mat.pink:mat.gold,side*r.length*S,.23,0,g);leaf.scale.set(1.35,.48,.82);}
  this.mesh(new THREE.CylinderGeometry(.14,.14,.34,12),mat.gold,0,.19,0,g);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,petal=this.mesh(new THREE.SphereGeometry(.095,8,6),mat.pink,Math.cos(a)*.105,.40,Math.sin(a)*.105,g);petal.scale.y=.5;}
  this.mesh(new THREE.SphereGeometry(.075,8,6),mat.neonGold,0,.425,0,g);return g;
 }
 deviceRide(d,mat){
  const g=new THREE.Group();g.position.set(X(d.x),0,Z(d.y));this.group.add(g);
  const glowMat=new THREE.MeshBasicMaterial({color:d.kind==='cannon'?0xffc650:0x77e7ff,transparent:true,opacity:.35,depthWrite:false});
  const glow=this.ring(0,0,d.kind==='cannon'?.36:.48,glowMat,.035,.026,g);glow.castShadow=false;
  let pivot=null;
  if(d.kind==='magnet'){
   for(const [i,side]of [-1,1].entries()){
    this.mesh(new THREE.CylinderGeometry(9*S,9*S,.42,12),i?mat.neonCyan:mat.neonPink,side*29*S,.21,0,g);
    this.mesh(new THREE.CylinderGeometry(9*S,9*S,.09,12),mat.cream,side*29*S,.465,0,g);
   }
   // The connecting U is elevated above the marble plane; only its poles collide.
   const bridge=this.mesh(new THREE.TorusGeometry(29*S,.105,8,24,Math.PI),mat.gold,0,.59,0,g);bridge.rotation.x=-Math.PI/2;
   const field=new THREE.Mesh(new THREE.RingGeometry(.74,.77,40),new THREE.MeshBasicMaterial({color:0x77e7ff,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));field.rotation.x=-Math.PI/2;field.position.y=.016;g.add(field);
   this.mesh(new THREE.OctahedronGeometry(.105),mat.neonCyan,0,.13,-.18,g);
  }else{
   // An open funnel marks the two physical intake walls on the board.
   for(const side of [-1,1])this.rail({ax:d.x+side*60,ay:d.y-46,bx:d.x+side*24,by:d.y+9,r:3},mat.gold,this.group,.24);
   const bowl=this.mesh(new THREE.CylinderGeometry(.34,.23,.18,24,1,true),mat.gold,0,.13,0,g);bowl.material.side=THREE.DoubleSide;
   this.ring(0,0,.34,mat.neonGold,.22,.045,g);
   pivot=new THREE.Group();pivot.position.y=.47;g.add(pivot);
   const barrelMat=this.material(0x7252cf,.38,.26);barrelMat.side=THREE.DoubleSide;
   const barrel=this.mesh(new THREE.CylinderGeometry(.23,.27,.85,20,1,true),barrelMat,.34,0,0,pivot);barrel.rotation.z=-Math.PI/2;
   const muzzle=this.mesh(new THREE.TorusGeometry(.24,.045,8,20),mat.gold,.78,0,0,pivot);muzzle.rotation.y=Math.PI/2;
   this.mesh(new THREE.SphereGeometry(.27,14,10),barrelMat,-.08,0,0,pivot);
   const stripe=this.mesh(new THREE.TorusGeometry(.267,.025,6,20),mat.neonPink,.06,0,0,pivot);stripe.rotation.y=Math.PI/2;
   for(const side of [-1,1]){const wheel=this.mesh(new THREE.CylinderGeometry(.18,.18,.10,12),mat.dark,-.05,-.25,side*.30,pivot);wheel.rotation.x=Math.PI/2;}
   batchStaticMeshes(pivot);
  }
  const label=document.createElement('span');label.className='device-label';this.labels.append(label);this.deviceRides.push({id:d.id,pivot,glow,label});
 }
 build(race){
  const newRound=this.lastRound!==race.roundId;
  if(newRound){this.resetZoom();this.looks=assignLooks(race.balls,race.config.mode==='lotto'?'classic':this.ballTheme);this.labelOffsets.clear();}
  this.clear();this.group=new THREE.Group();this.scene.add(this.group);this.labels.replaceChildren();this.progress.replaceChildren();
  this.balls=new Map();this.deviceRides=[];this.rotors=[];this.sliders=[];this.carousels=[];this.balloons=[];this.wheels=[];this.finishedAt.clear();this.map=race.map;this.lastRound=race.roundId;this.cameraCenter=400;
  const map=race.map,theme=LANDS[map.id],length=map.height*S;
  const mat={cream:this.material(0xfff6dc),gold:this.material(theme.accent,.15,.35),pink:this.material(theme.secondary),mint:this.material(0xa4ddca),dark:this.material(theme.edge),cloud:this.material(0xfff8ef)};
  mat.bulb=new THREE.MeshStandardMaterial({color:0xffedbb,emissive:0xffcb73,emissiveIntensity:.45,roughness:.3});
  for(const [key,color]of [['neonPink',0xff46a4],['neonCyan',0x36e4ff],['neonGold',0xffc650]])mat[key]=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.2,roughness:.25});
  this.neonMaterials=[mat.neonPink,mat.neonCyan,mat.neonGold];mat.glass=new THREE.MeshPhysicalMaterial({color:0xa4edf6,metalness:.3,roughness:.1,clearcoat:1});mat.sail=new THREE.MeshStandardMaterial({color:0xfff1cb,side:THREE.DoubleSide,roughness:.6});
  mat.canopy=this.material(0xffffff);mat.canopy.map=this.stripeTexture('#fff2d2','#'+new THREE.Color(theme.secondary).getHexString());
  const shape=new THREE.Shape();shape.moveTo(-5.08,-length+.25);shape.lineTo(-5.08,-.25);shape.quadraticCurveTo(-5.08,0,-4.83,0);shape.lineTo(4.83,0);shape.quadraticCurveTo(5.08,0,5.08,-.25);shape.lineTo(5.08,-length+.25);shape.quadraticCurveTo(5.08,-length,4.83,-length);shape.lineTo(-4.83,-length);shape.quadraticCurveTo(-5.08,-length,-5.08,-length+.25);
  for(const h of map.exits){const hole=new THREE.Path();hole.absarc(X(h.x),-Z(h.y??map.finish),h.width*S/2-.033,0,Math.PI*2,true);shape.holes.push(hole);}
  const deck=this.material(theme.floor,.03,.65);deck.envMapIntensity=.05;
  const board=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.035}),[deck,mat.dark],0,-.81,0);board.rotation.x=-Math.PI/2;
  const ground=this.mesh(new THREE.PlaneGeometry(70,100),this.material(theme.ground,0,.95),0,-1.55,length/2);ground.rotation.x=-Math.PI/2;ground.castShadow=false;this.group.remove(ground);this.scene.add(ground);this.ground=ground;
  for(const z of [1.4,length/2,length-1.4])for(const x of [-4.2,4.2])this.mesh(new THREE.CylinderGeometry(.28,.4,.7,10),mat.dark,x,-1.14,z);
  this.rail({ax:24,ay:18,bx:24,by:map.height-20,r:10},mat.cream);this.rail({ax:596,ay:18,bx:596,by:map.height-20,r:10},mat.cream);this.rail({ax:24,ay:18,bx:596,by:18,r:10},mat.cream);
  this.instances(new THREE.CylinderGeometry(1,1,1,8),mat.gold,map.pins.map(p=>({position:[X(p.x),.14,Z(p.y)],scale:[p.r*S*.48,.28,p.r*S*.48]})));
  this.instances(new THREE.SphereGeometry(1,12,8),mat.cream,map.pins.map((p,i)=>({position:[X(p.x),.31,Z(p.y)],scale:[p.r*S,p.r*S,p.r*S],color:[0xfff4d9,theme.secondary,theme.accent][i%3]})));
  for(const p of map.bumpers)if(p.ride==='ufo')this.saucer(p,mat);else if(p.ride==='bumper-car')this.bumperCar(p,mat);else this.carousel(p,mat);
  for(const s of map.rails)this.rail(s,mat.cream);
  for(const r of map.rotors)this.rotors.push(r.ride==='flower-gate'?this.flowerGate(r,mat):r.ride==='windmill'?this.windmill(r,mat):r.ride==='pirate'?this.pirateShip(r,mat):this.teacupRotor(r,mat));
  for(const s of map.sliders)this.sliders.push(s.ride==='bumper-shuttle'?this.bumperShuttle(s,mat):this.train(s,mat));
  this.gate=this.rail({ax:32,ay:map.gate,bx:588,by:map.gate,r:7},mat.pink);
  for(const h of map.exits){const radius=h.width*S/2-.033;this.ring(X(h.x),Z(h.y??map.finish),radius+.01,h.kind==='return'?mat.neonPink:mat.gold,.08,.085);this.mesh(new THREE.CylinderGeometry(radius-.01,radius-.01,.75,24,1,true),mat.dark,X(h.x),-.4,Z(h.y??map.finish));this.mesh(new THREE.CircleGeometry(radius-.01,24),new THREE.MeshBasicMaterial({color:0x24162d}),X(h.x),-.78,Z(h.y??map.finish)).rotation.x=-Math.PI/2;}
  for(const h of map.exits)this.text(h.kind==='return'?'BACK':'GOAL',map.finish+63,1.12,.9,h.x);
  if(map.returnPoint){const p=map.returnPoint;this.ring(X(p.x),Z(p.y),.46,mat.neonCyan,.025,.027);this.text('BACK AGAIN',p.y+48,1.8,.6,p.x);}
  this.text('BON VOYAGE!',253,3.9);this.text('A LITTLE WONDER',525,4.5,.4);this.text('EXPECT THE UNEXPECTED',1010,5.6,.35);this.text('YOUR LUCKY MOMENT',2008,5,.45);
  this.scenery(map,mat,theme);
  this.neonCourse(map,mat);
  this.returnGate=new THREE.Group();this.group.add(this.returnGate);for(const s of returnGateSegments(map,Infinity))this.rail(s,mat.neonGold,this.returnGate,.20);this.returnGate.visible=false;
  for(const d of race.devices)this.deviceRide(d,mat);
  // Moving rides keep independent transforms; their internal pieces are batched.
  for(const g of [...this.rotors,...this.sliders,...this.wheels.map(w=>w.wheel)])batchStaticMeshes(g);
  const moving=new Set([this.returnGate,...this.deviceRides.flatMap(d=>[d.pivot,d.glow].filter(Boolean)),this.gate,...this.rotors,...this.sliders,...this.carousels.map(c=>c.roof),...this.balloons.map(b=>b.group),...this.wheels.map(w=>w.wheel)]);
  batchStaticMeshes(this.group,moving);
  const sphere=new THREE.SphereGeometry(10*S,24,16);
  // Project the illustration across a real lit sphere, keeping faces readable.
  const position=sphere.attributes.position,uv=sphere.attributes.uv;for(let i=0;i<position.count;i++)uv.setXY(i,position.getX(i)/(20*S)+.5,position.getY(i)/(20*S)+.5);
  const lookMaterials=new Map();
  for(const b of race.balls){
   const kind=this.looks.get(b.id);let material=lookMaterials.get(kind);
   if(kind&&!material){const texture=new THREE.CanvasTexture(drawBallLook(kind));texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.64,metalness:0});lookMaterials.set(kind,material);}
   const m=this.mesh(sphere,material||new THREE.MeshPhysicalMaterial({color:b.color,metalness:.18,roughness:.18,clearcoat:1,clearcoatRoughness:.1}),X(b.x),.19,Z(b.y));
   const label=document.createElement('span');label.className='ball-label';label.textContent=[...b.label].slice(0,5).join('')+([...b.label].length>5?'…':'')+(race.config.people.find(p=>p.id===b.participantId).count>1?`·${b.number}`:'');label.title=b.label;label.style.borderColor=b.color;this.labels.append(label);
   const dot=document.createElement('i');dot.style.background=b.color;this.progress.append(dot);this.balls.set(b.id,{m,label,dot,kind,spin:0,history:[],lastTrail:-1,lastX:b.x,lastY:b.y});
  }
  for(const entry of this.balls.values())entry.labelWidth=entry.label.getBoundingClientRect().width;
  // Reserve the maximum two-digit ride counter once, without per-frame layout reads.
  for(const ride of this.deviceRides){ride.label.textContent='자석 · 60';const box=ride.label.getBoundingClientRect();ride.labelWidth=box.width;ride.labelHeight=box.height;}
  this.impactCursor=0;this.impacts=[];
  const impactGeometry=new THREE.TorusGeometry(.22,.022,4,20);
  for(let i=0;i<18;i++){const material=new THREE.MeshBasicMaterial({color:0xfff3c7,transparent:true,opacity:0,depthWrite:false});const mesh=this.mesh(impactGeometry,material,0,.055,0);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;mesh.visible=false;this.impacts.push({mesh,born:-10});}
  this.trails=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:.19,depthWrite:false}),race.balls.length*2);this.trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.trails.frustumCulled=false;
  race.balls.forEach((b,i)=>{this.trails.setColorAt(i*2,new THREE.Color(b.color));this.trails.setColorAt(i*2+1,new THREE.Color(b.color));});this.group.add(this.trails);
  this.trailTransform=new THREE.Object3D();
  this.winnerHalo=this.ring(0,0,.26,mat.neonGold,.045,.035);this.winnerHalo.visible=false;
 }
 impact(event,elapsed,reduced){
  if(reduced||!this.impacts?.length||!Number.isFinite(event.x+event.y))return;
  const effect=this.impacts[this.impactCursor++%this.impacts.length];effect.born=elapsed;effect.mesh.position.set(X(event.x),.055,Z(event.y));effect.mesh.material.color.set(event.kind==='bumper'?0xffdd88:0xfff5e8);effect.mesh.visible=true;
  if(event.kind==='bumper'){const ride=this.carousels.find(c=>c.key===`${event.obstacleX}:${event.obstacleY}`);if(ride)ride.hitAt=elapsed;}
 }
 requestRebuild(){this.rebuildPending=true;}
 draw(race,reduced=false,selected=null){
  if(this.lastRound!==race.roundId||this.rebuildPending){
   const previous=this.lastRound===race.roundId?{cameraCenter:this.cameraCenter,finishedAt:new Map(this.finishedAt)}:null;
   this.build(race);if(previous){this.cameraCenter=previous.cameraCenter;this.finishedAt=previous.finishedAt;}this.rebuildPending=false;
  }
  if(this.webgl.getPixelRatio()!==Math.min(devicePixelRatio||1,1.5))this.resize();
  const map=race.map,aspect=this.aspect||1,direction=CAMERA_DIRECTIONS[this.angle];
  const horizontal=false; // Preserve the course direction in every view and aspect ratio.
  const active=race.balls.filter(b=>!b.finished).sort((a,b)=>a.y-b.y);const progress=active[Math.floor(active.length*.65)]?.y??map.finish;
  const target=['ready','mixing','countdown'].includes(race.state)?270:Math.max(270,Math.min(map.finish-200,progress+60));
  if(race.state!=='paused')this.cameraCenter=reduced?target:this.cameraCenter+(target-this.cameraCenter)*.08;
  const span=this.overview?map.height:this.halfView?map.height/2:520;
  let center=this.overview?map.height/2:this.halfView?Math.max(span/2,Math.min(map.height-span/2,this.cameraCenter)):this.cameraCenter;
  this.camera.zoom=1;this.camera.aspect=aspect;this.camera.up.set(horizontal?1:0,horizontal?0:1,0);this.camera.updateProjectionMatrix();
  // Fit playable rails, not distant scenery. Keep the camera roll unchanged;
  // game positions, collision radii and the simulation remain unchanged.
  const key=[this.width,this.height,this.angle,span,horizontal].join(':');
  if(this.framingKey!==key){
   const low=-span*S/2-.45,high=span*S/2+.45;
   const corners=[];for(const x of [-5.6,5.6])for(const y of [-.8,1.1])for(const z of [low,high])corners.push(new THREE.Vector3(x,y,z));
   let near=1,far=100;
   for(let fit=0;fit<18;fit++){
    const d=(near+far)/2;this.camera.position.copy(direction).multiplyScalar(d);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    if(corners.every(c=>{const v=c.clone().project(this.camera);return Math.abs(v.x)<.95&&Math.abs(v.y)<.94&&v.z<1;}))far=d;else near=d;
   }
   this.framingDistance=far;this.framingKey=key;
   this.camera.position.copy(direction).multiplyScalar(far);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
   // A tall viewport can show much more track than the requested span. Anchor its
   // actual visible ground to the course ends instead of leaving half a blank screen.
   const axis=horizontal?'x':'y';
   this.groundEdges=[-.88,.88].map(edge=>{
    const point=new THREE.Vector3(0,0,.5);point[axis]=edge;point.unproject(this.camera);
    const ray=point.sub(this.camera.position).normalize();
    return (this.camera.position.z-ray.z*this.camera.position.y/ray.y)/S;
   }).sort((a,b)=>a-b);
  }
  if(!this.overview){
   const minimum=-30-this.groundEdges[0],maximum=map.height+30-this.groundEdges[1];
   center=minimum<=maximum?Math.max(minimum,Math.min(maximum,center)):map.height/2;
  }
  this.camera.position.copy(direction).multiplyScalar(this.framingDistance).add(new THREE.Vector3(0,0,Z(center)));this.camera.lookAt(0,0,Z(center));this.camera.updateMatrixWorld();
  if(this.zoomTarget){
   let point;const zoom=this.zoomTarget;
   if(zoom.kind==='ball'){const b=race.balls.find(b=>b.id===zoom.id);if(!b||b.finished)this.resetZoom();else point=new THREE.Vector3(X(b.x),.19,Z(b.y));}
   else point=new THREE.Vector3(zoom.x,0,Z(zoom.y));
   if(point){point.applyMatrix4(this.group.matrixWorld);this.camera.zoom=2.3;this.camera.updateProjectionMatrix();this.camera.position.copy(direction).multiplyScalar(this.framingDistance).add(point);this.camera.lookAt(point);this.camera.updateMatrixWorld();}
  }
  const a=new THREE.Vector3(-5.17,0,Z(center)).project(this.camera),b=new THREE.Vector3(5.17,0,Z(center)).project(this.camera);
  const startPoint=new THREE.Vector3(0,0,0).project(this.camera);
  this.framing={horizontal,visibleSpan:span,center,courseStartPixels:(1-startPoint.y)*this.height/2,boardWidthPixels:Math.hypot((a.x-b.x)*this.width/2,(a.y-b.y)*this.height/2),canvasWidth:this.width,canvasHeight:this.height};
  this.light.position.set(-6,16,Z(center)-5);this.light.target.position.set(0,0,Z(center));
  map.rotors.forEach((r,i)=>this.rotors[i].rotation.y=-rotorPose(r,race.rotationTime).angle);
  race.sliderSegments().forEach((s,i)=>this.sliders[i].position.x=X((s.ax+s.bx)/2));
  this.returnGate.visible=race.returnClosed();
  this.gate.visible=['ready','mixing','countdown'].includes(race.state)||(race.state==='paused'&&race.resumeState!=='racing');
  for(const ride of this.deviceRides){const d=race.devices.find(d=>d.id===ride.id),pose=devicePose(d,race.raceTime);if(ride.pivot)ride.pivot.rotation.y=-pose.angle;
   ride.glow.material.opacity=pose.holding?(reduced?.75:.55+Math.sin(pose.progress*Math.PI*4)*.2):.25;
   ride.label.hidden=!pose.holding||this.overview;ride.label.textContent=`${d.kind==='cannon'?'대포':'자석'} · ${pose.count}`;
   const pulse=!reduced&&pose.holding?1+Math.sin(pose.progress*Math.PI)*.3:1;ride.glow.scale.setScalar(pulse);
  }
  const decorTime=reduced?0:race.elapsed;
  this.wheels.forEach(({wheel,rate})=>wheel.rotation.z=decorTime*rate);
  this.balloons.forEach(b=>{b.group.position.y=b.y+Math.sin(decorTime*1.3+b.phase)*.1;b.group.rotation.z=Math.sin(decorTime*.7+b.phase)*.045;});
  this.carousels.forEach(c=>{c.roof.rotation.y=decorTime*c.rate+c.phase;const hit=decorTime-c.hitAt,pulse=!reduced&&hit>=0&&hit<.32?Math.sin(hit/.32*Math.PI):0;c.roof.scale.y=1-pulse*.18;c.roof.position.y=c.baseY-pulse*.08;});
  this.neonMaterials.forEach((m,i)=>{m.emissiveIntensity=reduced?1.05:1.05+Math.sin(decorTime*.95+i*2)*.32;});
  for(const effect of this.impacts){const age=race.elapsed-effect.born;effect.mesh.visible=!reduced&&age>=0&&age<.32;effect.mesh.scale.setScalar(1+Math.max(0,age)*4);effect.mesh.material.opacity=Math.max(0,1-age/.32)*.72;}
  const motion=!reduced&&['racing','paused','complete'].includes(race.state)?race.motion():{roll:0,pitch:0,offsetX:0,offsetY:0};
  this.group.rotation.set(motion.pitch,0,motion.roll);const pivot=new THREE.Vector3(0,0,map.height*S/2);this.group.position.copy(pivot).sub(pivot.clone().applyEuler(this.group.rotation));this.group.position.x+=motion.offsetX*S;this.group.position.z+=motion.offsetY*S;this.group.updateMatrixWorld(true);
  const deviceBoxes=[];
  for(const ride of this.deviceRides){const d=race.devices.find(d=>d.id===ride.id),v=new THREE.Vector3(X(d.x),1.1,Z(d.y)).applyMatrix4(this.group.matrixWorld).project(this.camera);ride.label.hidden=ride.label.hidden||Math.abs(v.x)>.95||Math.abs(v.y)>.9;const x=(v.x*.5+.5)*this.width,y=(-v.y*.5+.5)*this.height;ride.label.style.left=`${x/this.width*100}%`;ride.label.style.top=`${y/this.height*100}%`;if(!ride.label.hidden)deviceBoxes.push({l:x-ride.labelWidth/2,r:x+ride.labelWidth/2,t:y-ride.labelHeight,b:y});}
  const now=performance.now();
  this.trails.visible=!reduced&&race.state==='racing';this.winnerHalo.visible=false;let trailIndex=0;const labelCandidates=[];
  for(const b of race.balls){
   const entry=this.balls.get(b.id),{m,label,dot,history}=entry;if(b.finished&&!this.finishedAt.has(b.id))this.finishedAt.set(b.id,now);
   const portal=returnPose(b,race.raceTime);const sink=b.finished?Math.min(1,(now-this.finishedAt.get(b.id))/380):0;m.visible=portal?portal.visible:sink<1;m.position.set(X(b.x),portal?.height??.19-sink*.8,Z(b.y));m.scale.setScalar(portal?.scale??1-sink*.6);if(b.hold){if(b.hold.kind==='cannon')m.visible=false;else{const d=race.devices.find(d=>d.id===b.hold.deviceId),slot=d.holds.findIndex(h=>h.ballId===b.id);m.position.y=.6+slot*.13;m.scale.setScalar(.85);}}
   if(entry.kind){m.quaternion.copy(this.group.quaternion).invert().multiply(this.camera.quaternion);if(!reduced&&this.ballTheme==='sports')entry.spin+=(b.x-entry.lastX)/b.r*.35;m.rotateZ(entry.spin);}else{m.rotation.x+=(b.y-entry.lastY)/b.r;m.rotation.z-=(b.x-entry.lastX)/b.r;}entry.lastX=b.x;entry.lastY=b.y;dot.style.top=`${b.y/map.height*100}%`;
   if(b.id===selected&&!b.finished){this.winnerHalo.visible=true;this.winnerHalo.position.set(X(b.x),.045,Z(b.y));}
   if(b.portal||b.hold){history.length=0;entry.lastX=b.x;entry.lastY=b.y;}
   if(!b.portal&&!b.hold&&race.state==='racing'&&race.elapsed-entry.lastTrail>=.035){history.unshift({x:X(b.x),z:Z(b.y)});if(history.length>5)history.pop();entry.lastTrail=race.elapsed;}
   for(let i=0;i<2;i++){const old=history[i*2+2];this.trailTransform.position.set(old?.x??X(b.x),.12,old?.z??Z(b.y));this.trailTransform.scale.setScalar(!b.finished&&old?(i===0?.12:.075):0);this.trailTransform.updateMatrix();this.trails.setMatrixAt(trailIndex++,this.trailTransform.matrix);}
   const projected=m.position.clone().applyMatrix4(this.group.matrixWorld).project(this.camera);entry.pick={x:(projected.x*.5+.5)*this.width,y:(-projected.y*.5+.5)*this.height,visible:!b.finished&&m.visible&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1};
   const v=new THREE.Vector3(X(b.x),m.position.y+.41,Z(b.y)).applyMatrix4(this.group.matrixWorld).project(this.camera);label.hidden=true;
   if(this.allLabels&&entry.pick.visible){const x=(v.x*.5+.5)*this.width,y=(-v.y*.5+.5)*this.height;labelCandidates.push({label,x,y,progress:b.y,width:entry.labelWidth,id:b.id});}
  }
  for(const c of placeLabels(labelCandidates,this.width,this.height,this.labelOffsets,deviceBoxes)){c.label.hidden=false;c.label.style.left=`${c.x/this.width*100}%`;c.label.style.top=`${c.y/this.height*100}%`;}
  this.trails.instanceMatrix.needsUpdate=true;
  this.hud.textContent=this.zoomTarget?(this.zoomTarget.kind==='ball'?'공 따라 확대 · 다시 누르면 복귀':'부분 확대 · 다시 누르면 복귀'):(horizontal?'가로 코스 · ':'')+(this.overview?`PARK MAP / ${map.exits.length===1?'ONE LUCKY GOAL':'ONE GOAL + ONE BACK'}`:this.halfView?`HALF MAP / ${Math.round(Math.max(0,center-span/2)/map.height*100)}–${Math.round(Math.min(map.height,center+span/2)/map.height*100)}%`:`3D / SECTOR ${Math.max(1,Math.min(3,Math.floor((center-200)/750)+1)).toString().padStart(2,'0')} / 03`);
  this.webgl.render(this.scene,this.camera);
 }
 graphics(){const i=this.webgl.info;return {zoom:this.zoomTarget?{...this.zoomTarget}:null,ballTheme:this.ballTheme,ballLooks:[...this.balls].map(([id,e])=>({id,kind:e.kind||'classic',pick:e.pick,labelVisible:!e.label.hidden})),framing:{...this.framing},geometries:i.memory.geometries,textures:i.memory.textures,programs:i.programs.length,drawCalls:i.render.calls,triangles:i.render.triangles,pixelRatio:this.webgl.getPixelRatio()};}
}
