import * as THREE from '../vendor/three.module.js';
import {LANDS} from './lands.js';
const S=1/60, X=x=>(x-310)*S, Z=y=>y*S;
const UP=new THREE.Vector3(0,1,0);
const CAMERA_DIRECTIONS=[new THREE.Vector3(.18,.72,.67).normalize(),new THREE.Vector3(.35,.60,.72).normalize(),new THREE.Vector3(0,.995,.1).normalize()];

export class Renderer3D {
 constructor(canvas){
  Object.assign(this,{canvas,mode:'webgl',overview:false,angle:2,lastRound:null,cameraCenter:400,finishedAt:new Map()});
  this.webgl=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  this.webgl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=THREE.PCFSoftShadowMap;
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
  this.angleButton.addEventListener('click',()=>{this.angle=(this.angle+1)%3;this.angleButton.textContent=['◈ 입체 시점','◈ 측면 시점','◈ 상단 시점'][this.angle];});canvas.parentElement.append(this.angleButton);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new Event('pinball-renderer-lost'));});
 }
 overlay(className){const e=document.createElement('div');e.className=className;this.canvas.parentElement.append(e);return e;}
 resize(){const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.webgl.setSize(this.width,this.height,false);this.aspect=this.width/this.height;}
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
 text(text,y,size=3.5,opacity=.5){
  const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.font='800 94px sans-serif';ctx.textAlign='center';ctx.fillStyle=`rgba(255,250,235,${opacity})`;ctx.fillText(text,512,113);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const m=this.mesh(new THREE.PlaneGeometry(size,size*160/1024),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),0,.015,Z(y));m.rotation.x=-Math.PI/2;m.castShadow=false;
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
  const index=this.carousels.length;this.carousels.push({roof,ride,phase:p.x*.01,rate:(.14+(index%5)*.07)*(index%2?-1:1),key:`${p.x}:${p.y}`,hitAt:-10});
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
   const stars=[];for(let i=0;i<10;i++){const a=i*Math.PI/5;stars.push({position:[X(h.x)+Math.cos(a)*.61,.11,Z(map.finish)+Math.sin(a)*.61],scale:[.035,.035,.035]});}
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
 build(race){
  this.clear();this.group=new THREE.Group();this.scene.add(this.group);this.labels.replaceChildren();this.progress.replaceChildren();
  this.balls=new Map();this.rotors=[];this.sliders=[];this.carousels=[];this.balloons=[];this.wheels=[];this.finishedAt.clear();this.map=race.map;this.lastRound=race.roundId;this.cameraCenter=400;
  const map=race.map,theme=LANDS[map.id],length=map.height*S;
  const mat={cream:this.material(0xfff6dc),gold:this.material(theme.accent,.15,.35),pink:this.material(theme.secondary),mint:this.material(0xa4ddca),dark:this.material(theme.edge),cloud:this.material(0xfff8ef)};
  mat.bulb=new THREE.MeshStandardMaterial({color:0xffedbb,emissive:0xffcb73,emissiveIntensity:.45,roughness:.3});
  mat.canopy=this.material(0xffffff);mat.canopy.map=this.stripeTexture('#fff2d2','#'+new THREE.Color(theme.secondary).getHexString());
  const shape=new THREE.Shape();shape.moveTo(-5.08,-length+.25);shape.lineTo(-5.08,-.25);shape.quadraticCurveTo(-5.08,0,-4.83,0);shape.lineTo(4.83,0);shape.quadraticCurveTo(5.08,0,5.08,-.25);shape.lineTo(5.08,-length+.25);shape.quadraticCurveTo(5.08,-length,4.83,-length);shape.lineTo(-4.83,-length);shape.quadraticCurveTo(-5.08,-length,-5.08,-length+.25);
  for(const h of map.exits){const hole=new THREE.Path();hole.absarc(X(h.x),-Z(map.finish),.5,0,Math.PI*2,true);shape.holes.push(hole);}
  const deck=this.material(theme.floor,.03,.65);deck.envMapIntensity=.05;
  const board=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.035}),[deck,mat.dark],0,-.81,0);board.rotation.x=-Math.PI/2;
  const ground=this.mesh(new THREE.PlaneGeometry(70,100),this.material(theme.ground,0,.95),0,-1.55,length/2);ground.rotation.x=-Math.PI/2;ground.castShadow=false;this.group.remove(ground);this.scene.add(ground);this.ground=ground;
  for(const z of [1.4,length/2,length-1.4])for(const x of [-4.2,4.2])this.mesh(new THREE.CylinderGeometry(.28,.4,.7,10),mat.dark,x,-1.14,z);
  this.rail({ax:24,ay:18,bx:24,by:map.height-20,r:10},mat.cream);this.rail({ax:596,ay:18,bx:596,by:map.height-20,r:10},mat.cream);this.rail({ax:24,ay:18,bx:596,by:18,r:10},mat.cream);
  this.instances(new THREE.CylinderGeometry(1,1,1,8),mat.gold,map.pins.map(p=>({position:[X(p.x),.14,Z(p.y)],scale:[p.r*S*.48,.28,p.r*S*.48]})));
  this.instances(new THREE.SphereGeometry(1,12,8),mat.cream,map.pins.map((p,i)=>({position:[X(p.x),.31,Z(p.y)],scale:[p.r*S,p.r*S,p.r*S],color:[0xfff4d9,theme.secondary,theme.accent][i%3]})));
  for(const p of map.bumpers)this.carousel(p,mat);
  for(const s of map.rails)this.rail(s,mat.cream);
  for(const r of map.rotors)this.rotors.push(this.teacupRotor(r,mat));
  for(const s of map.sliders)this.sliders.push(this.train(s,mat));
  this.gate=this.rail({ax:32,ay:map.gate,bx:588,by:map.gate,r:7},mat.pink);
  for(const h of map.exits){this.ring(X(h.x),Z(map.finish),.51,mat.gold,.08,.085);this.mesh(new THREE.CylinderGeometry(.49,.49,.75,24,1,true),mat.dark,X(h.x),-.4,Z(map.finish));this.mesh(new THREE.CircleGeometry(.49,24),new THREE.MeshBasicMaterial({color:0x24162d}),X(h.x),-.78,Z(map.finish)).rotation.x=-Math.PI/2;}
  this.text('BON VOYAGE!',253,3.9);this.text('A LITTLE WONDER',525,4.5,.4);this.text('EXPECT THE UNEXPECTED',1010,5.6,.35);this.text('YOUR LUCKY MOMENT',2008,5,.45);
  this.scenery(map,mat,theme);
  const sphere=new THREE.SphereGeometry(10*S,20,14);
  for(const b of race.balls){
   const m=this.mesh(sphere,new THREE.MeshPhysicalMaterial({color:b.color,metalness:.18,roughness:.18,clearcoat:1,clearcoatRoughness:.1}),X(b.x),.19,Z(b.y));
   const label=document.createElement('span');label.className='ball-label';label.textContent=[...b.label].slice(0,5).join('')+([...b.label].length>5?'…':'')+(race.config.people.find(p=>p.id===b.participantId).count>1?`·${b.number}`:'');label.title=b.label;this.labels.append(label);
   const dot=document.createElement('i');dot.style.background=b.color;this.progress.append(dot);this.balls.set(b.id,{m,label,dot,history:[],lastTrail:-1});
  }
  this.impactCursor=0;this.impacts=[];
  const impactGeometry=new THREE.TorusGeometry(.22,.022,4,20);
  for(let i=0;i<18;i++){const material=new THREE.MeshBasicMaterial({color:0xfff3c7,transparent:true,opacity:0,depthWrite:false});const mesh=this.mesh(impactGeometry,material,0,.055,0);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;mesh.visible=false;this.impacts.push({mesh,born:-10});}
  this.trails=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:.19,depthWrite:false}),race.balls.length*2);this.trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.trails.frustumCulled=false;
  race.balls.forEach((b,i)=>{this.trails.setColorAt(i*2,new THREE.Color(b.color));this.trails.setColorAt(i*2+1,new THREE.Color(b.color));});this.group.add(this.trails);
  this.trailTransform=new THREE.Object3D();
 }
 impact(event,elapsed,reduced){
  if(reduced||!this.impacts?.length||!Number.isFinite(event.x+event.y))return;
  const effect=this.impacts[this.impactCursor++%this.impacts.length];effect.born=elapsed;effect.mesh.position.set(X(event.x),.055,Z(event.y));effect.mesh.material.color.set(event.kind==='bumper'?0xffdd88:0xfff5e8);effect.mesh.visible=true;
  if(event.kind==='bumper'){const ride=this.carousels.find(c=>c.key===`${event.obstacleX}:${event.obstacleY}`);if(ride)ride.hitAt=elapsed;}
 }
 draw(race,reduced=false,selected=null){
  if(this.lastRound!==race.roundId)this.build(race);const map=race.map,aspect=this.aspect||1,direction=CAMERA_DIRECTIONS[this.angle];
  const distance=Math.max(20,7.2/(Math.tan(THREE.MathUtils.degToRad(20))*aspect));
  const active=race.balls.filter(b=>!b.finished).sort((a,b)=>a.y-b.y);const progress=active[Math.floor(active.length*.65)]?.y??map.finish;
  const target=['ready','mixing','countdown'].includes(race.state)?400:Math.max(400,Math.min(map.finish-200,progress+100));
  if(race.state!=='paused')this.cameraCenter=reduced?target:this.cameraCenter+(target-this.cameraCenter)*.08;
  const center=this.overview?map.height/2:this.cameraCenter;let cameraDistance=this.overview?Math.max(distance,map.height*S*1.55):distance;
  this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
  for(let fit=0;fit<8;fit++){
   this.camera.position.copy(direction).multiplyScalar(cameraDistance).add(new THREE.Vector3(0,0,Z(center)));this.camera.lookAt(0,0,Z(center));this.camera.updateMatrixWorld();
   if(!this.overview)break;
   const corners=[[-7.8,-1],[7.8,-1],[-7.8,map.height*S],[7.8,map.height*S]].map(([x,z])=>new THREE.Vector3(x,-.8,z).project(this.camera));
   if(corners.every(v=>Math.abs(v.x)<.94&&Math.abs(v.y)<.94))break;cameraDistance*=1.1;
  }
  this.light.position.set(-6,16,Z(center)-5);this.light.target.position.set(0,0,Z(center));
  race.rotorSegments().forEach((s,i)=>this.rotors[i].rotation.y=-Math.atan2(s.by-s.ay,s.bx-s.ax));
  race.sliderSegments().forEach((s,i)=>this.sliders[i].position.x=X((s.ax+s.bx)/2));
  this.gate.visible=['ready','mixing','countdown'].includes(race.state)||(race.state==='paused'&&race.resumeState!=='racing');
  const decorTime=reduced?0:race.elapsed;
  this.wheels.forEach(({wheel,rate})=>wheel.rotation.z=decorTime*rate);
  this.balloons.forEach(b=>{b.group.position.y=b.y+Math.sin(decorTime*1.3+b.phase)*.1;b.group.rotation.z=Math.sin(decorTime*.7+b.phase)*.045;});
  this.carousels.forEach(c=>{c.roof.rotation.y=decorTime*c.rate+c.phase;const hit=decorTime-c.hitAt;c.ride.scale.y=!reduced&&hit>=0&&hit<.32?1-Math.sin(hit/.32*Math.PI)*.18:1;});
  for(const effect of this.impacts){const age=race.elapsed-effect.born;effect.mesh.visible=!reduced&&age>=0&&age<.32;effect.mesh.scale.setScalar(1+Math.max(0,age)*4);effect.mesh.material.opacity=Math.max(0,1-age/.32)*.72;}
  const motion=!reduced&&['racing','paused'].includes(race.state)?race.motion():{roll:0,pitch:0,offsetX:0,offsetY:0};
  this.group.rotation.set(motion.pitch,0,motion.roll);const pivot=new THREE.Vector3(0,0,map.height*S/2);this.group.position.copy(pivot).sub(pivot.clone().applyEuler(this.group.rotation));this.group.position.x+=motion.offsetX*S;this.group.position.z+=motion.offsetY*S;this.group.updateMatrixWorld(true);
  const now=performance.now();
  this.trails.visible=!reduced&&race.state==='racing';let trailIndex=0;
  for(const b of race.balls){
   const entry=this.balls.get(b.id),{m,label,dot,history}=entry;if(b.finished&&!this.finishedAt.has(b.id))this.finishedAt.set(b.id,now);
   const sink=b.finished?Math.min(1,(now-this.finishedAt.get(b.id))/380):0;m.visible=sink<1;m.position.set(X(b.x),.19-sink*.8,Z(b.y));m.scale.setScalar(1-sink*.6);
   m.rotation.x+=b.vy*.00025;m.rotation.z-=b.vx*.00025;dot.style.top=`${b.y/map.height*100}%`;
   if(race.state==='racing'&&race.elapsed-entry.lastTrail>=.035){history.unshift({x:X(b.x),z:Z(b.y)});if(history.length>5)history.pop();entry.lastTrail=race.elapsed;}
   for(let i=0;i<2;i++){const old=history[i*2+2];this.trailTransform.position.set(old?.x??X(b.x),.12,old?.z??Z(b.y));this.trailTransform.scale.setScalar(!b.finished&&old?(i===0?.12:.075):0);this.trailTransform.updateMatrix();this.trails.setMatrixAt(trailIndex++,this.trailTransform.matrix);}
   const v=new THREE.Vector3(X(b.x),.6,Z(b.y)).applyMatrix4(this.group.matrixWorld).project(this.camera);label.hidden=b.finished||this.overview||Math.abs(v.x)>1||Math.abs(v.y)>.98;label.style.left=`${(v.x*.5+.5)*100}%`;label.style.top=`${(-v.y*.5+.5)*100}%`;
  }
  this.trails.instanceMatrix.needsUpdate=true;
  this.hud.textContent=this.overview?'PARK MAP / FOUR LUCKY EXITS':`3D / SECTOR ${Math.max(1,Math.min(3,Math.floor((center-200)/750)+1)).toString().padStart(2,'0')} / 03`;
  this.webgl.render(this.scene,this.camera);
 }
 graphics(){const i=this.webgl.info;return {geometries:i.memory.geometries,textures:i.memory.textures,programs:i.programs.length,drawCalls:i.render.calls,triangles:i.render.triangles,pixelRatio:this.webgl.getPixelRatio()};}
}
