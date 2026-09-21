import * as THREE from '../vendor/three.module.js';
const S=1/60, X=x=>(x-310)*S, Z=y=>y*S;
const THEMES={neon:{floor:0x164ecc,accent:0xd6ff5f},orbit:{floor:0x9c3b26,accent:0xffd797},zigzag:{floor:0x116a66,accent:0xadf8dd},split:{floor:0x5831a0,accent:0xe9c6ff}};
export class Renderer3D {
 constructor(canvas){
  this.canvas=canvas;this.mode='webgl';this.overview=false;this.angle=2;this.lastRound=null;this.cameraCenter=400;this.finishedAt=new Map();
  this.webgl=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  this.webgl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=THREE.PCFSoftShadowMap;this.webgl.outputColorSpace=THREE.SRGBColorSpace;this.webgl.toneMapping=THREE.ACESFilmicToneMapping;this.webgl.toneMappingExposure=.92;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.1,180);
  this.scene.add(new THREE.HemisphereLight(0xe4efff,0x48618d,1.1));
  this.light=new THREE.DirectionalLight(0xffffff,2.6);this.light.position.set(-6,16,1);this.light.castShadow=true;this.light.shadow.mapSize.set(1024,1024);this.light.shadow.camera.left=-8;this.light.shadow.camera.right=8;this.light.shadow.camera.top=13;this.light.shadow.camera.bottom=-13;this.light.shadow.camera.near=.1;this.light.shadow.camera.far=50;this.light.shadow.normalBias=.03;this.light.shadow.bias=-.0002;this.scene.add(this.light,this.light.target);
  const rim=new THREE.DirectionalLight(0xb3cdff,.8);rim.position.set(8,6,15);this.scene.add(rim);
  const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,64);g.addColorStop(0,i===2?'#ffffff':'#c9d9f6');g.addColorStop(.5,'#6f8fbd');g.addColorStop(1,'#182642');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);ctx.fillStyle='#ffffff';ctx.fillRect(6,6,44,12);return c;});this.environment=new THREE.CubeTexture(faces);this.environment.needsUpdate=true;this.scene.environment=this.environment;
  this.labels=document.createElement('div');this.labels.className='ball-labels';canvas.parentElement.append(this.labels);this.hud=document.createElement('div');this.hud.className='camera-hud';canvas.parentElement.append(this.hud);
  this.progress=document.createElement('div');this.progress.className='course-progress';canvas.parentElement.append(this.progress);
  this.angleButton=document.createElement('button');this.angleButton.className='camera-angle';this.angleButton.type='button';this.angleButton.textContent='◈ 상단 시점';this.angleButton.setAttribute('aria-label','3D 카메라 시점 변경');this.angleButton.addEventListener('click',()=>{this.angle=(this.angle+1)%3;this.angleButton.textContent=['◈ 입체 시점','◈ 측면 시점','◈ 상단 시점'][this.angle];});canvas.parentElement.append(this.angleButton);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new Event('pinball-renderer-lost'));});
 }
 resize(){const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.webgl.setSize(this.width,this.height,false);this.aspect=this.width/this.height;}
 material(color,metalness=.1,roughness=.35){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
 mesh(geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.group.add(m);return m;}
 rail(s,mat){const dx=(s.bx-s.ax)*S,dz=(s.by-s.ay)*S,length=Math.hypot(dx,dz);const m=this.mesh(new THREE.CapsuleGeometry(s.r*S,Math.max(.001,length),4,8),mat,X((s.ax+s.bx)/2),.17,Z((s.ay+s.by)/2));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx,0,dz).normalize());return m;}
 ring(x,z,r,color){const m=this.mesh(new THREE.TorusGeometry(r,.055,8,40),this.material(color,.4,.2),x,.07,z);m.rotation.x=Math.PI/2;return m;}
 floorText(text,y,size=2.8){const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.font='800 94px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.32)';ctx.fillText(text,512,113);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=this.mesh(new THREE.PlaneGeometry(size,size*160/1024),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),0,.013,Z(y));m.rotation.x=-Math.PI/2;m.castShadow=false;}
 build(race){
  if(this.group){this.scene.remove(this.group);this.group.traverse(o=>{o.geometry?.dispose();const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of mats){m.map?.dispose();m.dispose();}});}
  this.group=new THREE.Group();this.scene.add(this.group);this.labels.replaceChildren();this.progress.replaceChildren();this.balls=new Map();this.rotors=[];this.sliders=[];this.finishedAt.clear();this.map=race.map;this.lastRound=race.roundId;this.cameraCenter=400;
  const map=race.map,theme=THEMES[map.id],length=map.height*S;
  const shape=new THREE.Shape();shape.moveTo(-5.08,-length+.25);shape.lineTo(-5.08,-.25);shape.quadraticCurveTo(-5.08,0,-4.83,0);shape.lineTo(4.83,0);shape.quadraticCurveTo(5.08,0,5.08,-.25);shape.lineTo(5.08,-length+.25);shape.quadraticCurveTo(5.08,-length,4.83,-length);shape.lineTo(-4.83,-length);shape.quadraticCurveTo(-5.08,-length,-5.08,-length+.25);
  for(const h of map.exits){const hole=new THREE.Path();hole.absarc(X(h.x),-Z(map.finish),.5,0,Math.PI*2,true);shape.holes.push(hole);}
  const deck=this.material(theme.floor,.08,.5);deck.envMapIntensity=.08;
  const edge=this.material(0x14243e,.45,.28);edge.envMapIntensity=.3;
  const board=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.035}),[deck,edge],0,-.81,0);board.rotation.x=-Math.PI/2;
  const ground=this.mesh(new THREE.PlaneGeometry(70,100),this.material(0xe7edf5,0,.85),0,-1.55,length/2);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  for(const z of [1.4,length/2,length-1.4])for(const x of [-4.2,4.2])this.mesh(new THREE.CylinderGeometry(.28,.4,.7,12),edge,x,-1.14,z);
  const silver=this.material(0xe9eef9,.65,.23),white=this.material(0xf8faff,.2,.3),accent=this.material(theme.accent,.2,.25),dark=this.material(0x192b49,.4,.35);
  this.rail({ax:24,ay:18,bx:24,by:map.height-20,r:10},silver);this.rail({ax:596,ay:18,bx:596,by:map.height-20,r:10},silver);this.rail({ax:24,ay:18,bx:596,by:18,r:10},silver);
  for(const p of map.pins){this.mesh(new THREE.CylinderGeometry(p.r*S,p.r*S,.28,12),silver,X(p.x),.14,Z(p.y));this.mesh(new THREE.SphereGeometry(p.r*S,12,8),white,X(p.x),.28,Z(p.y));}
  for(const p of map.bumpers){this.mesh(new THREE.CylinderGeometry(p.r*S,p.r*S,.22,32),dark,X(p.x),.11,Z(p.y));const top=this.mesh(new THREE.SphereGeometry(p.r*S*.9,24,12),accent,X(p.x),.21,Z(p.y));top.scale.y=.35;this.ring(X(p.x),Z(p.y),p.r*S,theme.accent);}
  for(const s of map.rails)this.rail(s,silver);
  for(const r of map.rotors){const m=this.mesh(new THREE.CapsuleGeometry(9*S,r.length*2*S,4,12),accent,X(r.x),.28,Z(r.y));this.rotors.push(m);this.mesh(new THREE.CylinderGeometry(.19,.19,.43,16),white,X(r.x),.2,Z(r.y));}
  for(const s of map.sliders){const m=this.mesh(new THREE.CapsuleGeometry(10*S,s.length*2*S,4,12),this.material(0xff9754,.25,.25),X(s.x),.23,Z(s.y));m.rotation.z=Math.PI/2;this.sliders.push(m);}
  this.gate=this.rail({ax:32,ay:map.gate,bx:588,by:map.gate,r:7},accent);
  for(const h of map.exits){this.ring(X(h.x),Z(map.finish),.51,theme.accent);this.mesh(new THREE.CylinderGeometry(.49,.49,.7,32,1,true),this.material(0x060a12,.2,.4),X(h.x),-.4,Z(map.finish));this.mesh(new THREE.CircleGeometry(.49,32),new THREE.MeshBasicMaterial({color:0x02050b}),X(h.x),-.76,Z(map.finish)).rotation.x=-Math.PI/2;}
  this.floorText('DROP CLUB',252,3.4);this.floorText('01 / FIND YOUR WAY',535,4.3);this.floorText('02 / MIX IT UP',1020,4.3);this.floorText('03 / FINAL DROP',2010,4.3);
  const sphere=new THREE.SphereGeometry(10*S,20,14);
  for(const b of race.balls){const mat=new THREE.MeshPhysicalMaterial({color:b.color,metalness:.25,roughness:.17,clearcoat:1,clearcoatRoughness:.12});const m=this.mesh(sphere,mat,X(b.x),.19,Z(b.y));const label=document.createElement('span');label.className='ball-label';label.textContent=[...b.label].slice(0,5).join('')+([...b.label].length>5?'…':'')+(race.config.people.find(p=>p.id===b.participantId).count>1?`·${b.number}`:'');label.title=b.label;this.labels.append(label);const dot=document.createElement('i');dot.style.background=b.color;this.progress.append(dot);this.balls.set(b.id,{m,label,dot});}
 }
 draw(race,reduced=false,selected=null){
  if(this.lastRound!==race.roundId)this.build(race);const map=race.map,aspect=this.aspect||1;
  const directions=[new THREE.Vector3(.18,.72,.67),new THREE.Vector3(.35,.60,.72),new THREE.Vector3(0,.94,.34)];const direction=directions[this.angle].normalize();
  const distance=Math.max(20,7.2/(Math.tan(THREE.MathUtils.degToRad(20))*aspect));
  const active=race.balls.filter(b=>!b.finished).sort((a,b)=>a.y-b.y);const progress=active[Math.floor(active.length*.65)]?.y??map.finish;const target=['ready','mixing','countdown'].includes(race.state)?400:Math.max(400,Math.min(map.finish-200,progress+100));
  if(race.state!=='paused')this.cameraCenter=reduced?target:this.cameraCenter+(target-this.cameraCenter)*.08;
  const center=this.overview?map.height/2:this.cameraCenter;let cameraDistance=this.overview?Math.max(distance,map.height*S*1.45):distance;
  this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
  for(let fit=0;fit<8;fit++){
   this.camera.position.copy(direction.clone().multiplyScalar(cameraDistance)).add(new THREE.Vector3(0,0,Z(center)));this.camera.lookAt(0,0,Z(center));this.camera.updateMatrixWorld();
   if(!this.overview)break;
   const corners=[[-5.15,0],[5.15,0],[-5.15,map.height*S],[5.15,map.height*S]].map(([x,z])=>new THREE.Vector3(x,-.8,z).project(this.camera));
   if(corners.every(v=>Math.abs(v.x)<.92&&Math.abs(v.y)<.92))break;
   cameraDistance*=1.1;
  }
  this.light.position.set(-5,16,Z(center)-5);this.light.target.position.set(0,0,Z(center));
  const segments=race.rotorSegments();segments.forEach((s,i)=>this.rotors[i].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(s.bx-s.ax,0,s.by-s.ay).normalize()));race.sliderSegments().forEach((s,i)=>this.sliders[i].position.x=X((s.ax+s.bx)/2));
  this.gate.visible=['ready','mixing','countdown'].includes(race.state)||(race.state==='paused'&&race.resumeState!=='racing');
  const now=performance.now();for(const b of race.balls){const {m,label,dot}=this.balls.get(b.id);if(b.finished&&!this.finishedAt.has(b.id))this.finishedAt.set(b.id,now);const sink=b.finished?Math.min(1,(now-this.finishedAt.get(b.id))/380):0;m.visible=sink<1;m.position.set(X(b.x),.19-sink*.8,Z(b.y));m.scale.setScalar(1-sink*.6);m.rotation.x+=b.vy*.00025;m.rotation.z-=b.vx*.00025;dot.style.top=`${b.y/map.height*100}%`;const v=new THREE.Vector3(X(b.x),.6,Z(b.y)).project(this.camera);label.hidden=b.finished||this.overview||Math.abs(v.x)>1||Math.abs(v.y)>.98;label.style.left=`${(v.x*.5+.5)*100}%`;label.style.top=`${(-v.y*.5+.5)*100}%`;}
  this.hud.textContent=this.overview?'3D / COURSE OVERVIEW':`3D / SECTOR ${Math.max(1,Math.min(3,Math.floor((center-200)/750)+1)).toString().padStart(2,'0')} / 03`;
  this.webgl.render(this.scene,this.camera);
 }
}
