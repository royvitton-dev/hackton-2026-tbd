import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {dampHeading} from '../core/camera.js';
import {driverView} from '../core/driving.js';
import {localPosition} from '../core/geometry.js';
import {surfaceMaterial,worldUV} from './materials.js';
import {parkedCar,accessibleMark,semanticObject} from './objects.js';
import {STRUCTURE_COLORS} from '../core/structures.js';
import {scoreColor} from '../core/charging.js';
const colors={ground:'#e7e8dd',wall:'#e1ded0',lane:'#788c83',green:'#276e5c',orange:'#dd834b'};
function box(parent,w,h,d,color,x=0,y=h/2,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.78}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function line(parent,points,color,width=.1){const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];curve.add(new THREE.LineCurve3(new THREE.Vector3(a.x,a.y??.08,a.z),new THREE.Vector3(b.x,b.y??.08,b.z)));}const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(2,points.length*3),width,6,false),new THREE.MeshBasicMaterial({color}));parent.add(m);return m;}
function label(parent,text,x,y,z,color='#285d50',background='#fffdf2'){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='600 32px sans-serif';canvas.width=Math.min(512,Math.max(128,Math.ceil(ctx.measureText(text).width)+36));canvas.height=96;ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(3,3,canvas.width-6,90,20);ctx.fill();ctx.font='600 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,canvas.width/2,50,canvas.width-24);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.set(17*canvas.width/512,3.2,1);sprite.renderOrder=20;parent.add(sprite);return sprite;
}
function dispose(root){root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){m?.map?.dispose();m?.dispose();}});root.clear();}
export function buildingModel(site){
  const g=new THREE.Group(),f=site.photo?.facade;
  if(site.buildingType==='park'){box(g,25,.6,20,'#8fae7d');box(g,22,.04,2,'#d6ceae',0,.34,0);for(const [x,z] of [[-8,-6],[-2,5],[7,-5],[8,6],[-9,6]]){box(g,.6,3,.6,'#7e7155',x,1.6,z);const crown=new THREE.Mesh(new THREE.SphereGeometry(2.6,12,9),new THREE.MeshStandardMaterial({color:'#719764',roughness:.9}));crown.position.set(x,4,z);g.add(crown);}return g;}
  if(site.buildingType==='parking'){box(g,25,.8,18,'#91a399');for(let i=0;i<8;i++){box(g,2,.03,5,'#dde5d5',-10+i*3,.43,-5);box(g,2,.03,5,'#dde5d5',-10+i*3,.43,5);}label(g,'P',0,5,0);return g;}
  if(site.footprint?.length>2){
    const points=site.footprint,shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z))),base=f?.baseHeight||3.2,height=f?.floorHeight||2.8,levels=f?.residentialFloors||4;
    function plate(y,depth,color){const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1}),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.8}));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);}
    plate(0,base,f.base);for(let i=0;i<levels;i++)plate(base+i*height,height-.06,i<2?f.lower:f.upper);plate(base+height*levels,.3,f.upper);
    const sides=points.map((a,i)=>({a,b:points[(i+1)%points.length],length:Math.hypot(a.x-points[(i+1)%points.length].x,a.z-points[(i+1)%points.length].z)})).sort((a,b)=>b.length-a.length),front=sides[0],dx=(front.b.x-front.a.x)/front.length,dz=(front.b.z-front.a.z)/front.length,count=Math.floor(front.length/3.5);
    for(let floor=0;floor<levels;floor++)for(let i=0;i<count;i++){
      const along=(i+.5)*front.length/count,x=front.a.x+dx*along,z=front.a.z+dz*along,y=base+floor*height+height/2;
      const window=box(g,1.6,1.5,.16,'#547e85',x+dz*.1,y,z-dx*.1);window.rotation.y=-Math.atan2(dz,dx);
      const rail=box(g,1.9,.1,.6,f.rail,x+dz*.4,y-.72,z-dx*.4);rail.rotation.y=window.rotation.y;
      if(floor===1&&i>count*.6&&i<count*.8){const accent=box(g,3.4,height-.12,.08,f.accent,x+dz*.04,y,z-dx*.04);accent.rotation.y=window.rotation.y;}
    }
    g.userData.photoSha=site.photo.sha256;g.userData.footprintSource=site.footprintSource;return g;
  }
  const type=site.buildingType,levels=f?.residentialFloors??(type==='house'?2:type==='apartment'?6:4),width=type==='public'?26:14,depth=type==='public'?19:9,base=f?.baseHeight||2.8,levelHeight=f?.floorHeight||3;
  box(g,width,base,depth,f?.base||'#6d8178');
  for(let level=0;level<levels;level++){
    const y=base+level*levelHeight+levelHeight/2;
    box(g,width,levelHeight-.08,depth,level>=levels/2?(f?.upper||'#d9dfd2'):(f?.lower||'#afbdb1'),0,y,0);
    for(let n=0;n<4;n++){
      box(g,1.35,1.4,.12,'#5d858c',-width/2+2+n*(width-4)/3,y,depth/2+.1);
      box(g,1.7,.12,.65,f?.rail||'#687e74',-width/2+2+n*(width-4)/3,y-.72,depth/2+.3);
    }
    if(f&&level===2)box(g,width*.35,levelHeight,.06,f.accent,width*.2,y,depth/2+.2);
  }
  box(g,width+.5,.3,depth+.5,'#e5e7db',0,base+levels*levelHeight,0);
  g.userData.photoSha=site.photo?.sha256||null;return g;
}
export class TwinScene {
  constructor(canvas,onFrame){
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e9ece5');
    this.camera=new THREE.PerspectiveCamera(44,1,.1,30000);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI*.48;
    this.scene.add(new THREE.HemisphereLight('#fffff4','#708575',2.6));const sun=new THREE.DirectionalLight('#fff3d8',3.2);sun.position.set(-60,150,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:400});sun.shadow.bias=-.0004;this.scene.add(sun);
    this.world=new THREE.Group();this.routeGroup=new THREE.Group();this.hazardGroup=new THREE.Group();this.chargingGroup=new THREE.Group();this.textGroup=new THREE.Group();this.detectedGroup=new THREE.Group();this.scene.add(this.world,this.routeGroup,this.hazardGroup,this.chargingGroup,this.textGroup,this.detectedGroup);this.finishes={floor:'concrete',wall:'paint',column:'concrete',stairs:'concrete'};this.showCars=true;
    this.actor=new THREE.Group();this.scene.add(this.actor);this.view='orbit';this.heading=0;this.pose={x:0,z:0,heading:0};this.mode='car';
    this.resize=()=>{const {width,height}=canvas.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.setViewOffset(width,height,width>760&&this.view==='orbit'&&this.world?.userData.mode==='plan'?Math.min(150,width*.17):0,0,width,height);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);};this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);
    let previous=performance.now();this.renderer.setAnimationLoop(now=>{const dt=Math.min(.1,(now-previous)/1000);previous=now;if(document.hidden)return;onFrame(dt);this.follow(dt);if(this.view==='orbit')this.controls.update();this.renderer.render(this.scene,this.camera);canvas.dataset.ready='true';});
  }
  clear(){this.sourceOverlay=null;this.floorView='all';dispose(this.world);dispose(this.routeGroup);dispose(this.hazardGroup);dispose(this.chargingGroup);dispose(this.textGroup);dispose(this.detectedGroup);this.actor.visible=false;this.view='orbit';this.controls.enabled=true;this.canvas.dataset.ready='false';}
  frame(width,depth){this.resize();const max=Math.max(width,depth),vertical=max/Math.min(1,this.camera.aspect);this.controls.target.set(0,0,0);this.camera.position.set(max*.62,vertical,vertical*1.18);this.controls.minDistance=5;this.controls.maxDistance=max*4;this.controls.update();}
  showPlan(plan,model,sourceUrl){
    this.clear();this.parkingTarget=null;this.parkingPickers=[];this.materials=new Map();this.plan=plan;this.world.userData.mode='plan';this.world.userData.meshCount=model.meshes.length;
    for(const f of plan.floors||[{x:0,y:0,z:0,width:plan.width,depth:plan.depth}]){
      const floor=box(this.world,f.width,.35,f.depth,colors.ground,f.x,f.y-.19,f.z);floor.geometry=worldUV(floor.geometry);floor.userData.surface='floor';floor.userData.floorY=f.y;floor.material.dispose();floor.material=surfaceMaterial(this.finishes.floor,this.materials);
      if(f.label){const sign=label(this.world,f.label+' · '+f.y.toFixed(1)+'m',f.x,f.y+1,f.z-f.depth/2+2,'#42668f');sign.scale.set(6,1.2,1);sign.userData.floorY=f.y;}
    }
    for(const data of model.meshes){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(worldUV(geometry),data.material==='glazing'?new THREE.MeshStandardMaterial({color:'#7aa9b0',transparent:true,opacity:.28,roughness:.16,metalness:.1}):surfaceMaterial(this.finishes.wall,this.materials));mesh.userData.kind='wall';mesh.userData.floorY=Math.min(...data.positions.filter((_,i)=>i%3===1));if(data.material!=='glazing')mesh.userData.surface='wall';mesh.castShadow=true;mesh.receiveShadow=true;this.world.add(mesh);}
    for(const edge of plan.edges){
      if(plan.objects?.some(o=>o.kind==='ramp'&&(o.graphEdges?.includes(edge.id)||edge.kind==='ramp'&&!o.graphEdges)))continue;
      const a=plan.nodes.find(n=>n.id===edge.from),b=plan.nodes.find(n=>n.id===edge.to),length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)continue;
      const nx=-(b.z-a.z)/length*edge.width/2,nz=(b.x-a.x)/length*edge.width/2,positions=[];
      for(const [p,sign] of [[a,-1],[b,-1],[b,1],[a,1]])positions.push(p.x+nx*sign,(p.y||0)+.012,p.z+nz*sign);
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();
      const lane=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:edge.kind==='ramp'?STRUCTURE_COLORS.ramp:edge.kind==='road'?'#87978d':edge.modes.includes('car')?'#b5c0b4':'#acc7b5',side:THREE.DoubleSide}));lane.receiveShadow=true;lane.userData.kind='lane';lane.userData.floorY=Math.min(a.y||0,b.y||0);this.world.add(lane);
      for(let p=2;p<length-1;p+=4){const t=p/length,mark=box(this.world,1.5,.022,.09,'#f1f1d7',a.x+(b.x-a.x)*t,(a.y||0)+((b.y||0)-(a.y||0))*t+.03,a.z+(b.z-a.z)*t);mark.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(b.x-a.x,(b.y||0)-(a.y||0),b.z-a.z).normalize());mark.userData.floorY=lane.userData.floorY;}
    }
    for(const [i,s] of plan.spaces.entries()){if(!['parking','ev'].includes(s.kind))continue;const points=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>({x:s.x+x*s.width/2,z:s.z+z*s.depth/2,y:(s.y||0)+.13}));line(this.world,points,s.accessible?'#ffffff':s.kind==='ev'?'#37a391':'#faf9e9',s.accessible?.08:.045).userData.floorY=s.y||0;if(s.accessible){this.world.add(accessibleMark(s));const sign=label(this.world,'장애인 전용',s.x,(s.y||0)+3.3,s.z,'#ffffff','#1264ad');sign.scale.set(4.6,.86,1);sign.userData.kind='accessible-sign';sign.userData.floorY=s.y||0;}if(!s.accessible){const car=parkedCar(s,i);car.visible=this.showCars;car.userData.floorY=s.y||0;this.world.add(car);}}
    for(const o of plan.objects||[]){const object=semanticObject(o,this.finishes,this.materials);object.userData.floorY=o.y||0;this.world.add(object);if(['room','stairs','lift','ramp','door'].includes(o.kind)){const sign=label(this.world,o.label,o.x,(o.y||0)+(o.kind==='room'?1.2:o.kind==='door'?2.8:4),o.z,STRUCTURE_COLORS[o.kind]?'#ffffff':'#285d50',STRUCTURE_COLORS[o.kind]||'#fffdf2');sign.scale.set(Math.min(12,Math.max(4,o.width*1.1)),o.kind==='door'?.8:1.5,1);sign.userData.kind=o.kind+'-sign';sign.userData.floorY=o.y||0;}}
    this.world.userData.parkingCount=plan.spaces.filter(s=>['parking','ev'].includes(s.kind)).length;this.world.userData.accessibleCount=plan.spaces.filter(s=>s.accessible).length;this.world.userData.objectCount=plan.objects?.length||0;
    for(const s of plan.spaces.filter(s=>['parking','ev'].includes(s.kind))){const picker=new THREE.Mesh(new THREE.PlaneGeometry(s.width,s.depth),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));picker.rotation.x=-Math.PI/2;picker.position.set(s.x,(s.y||0)+.17,s.z);picker.userData.spaceId=s.id;this.world.add(picker);this.parkingPickers.push(picker);}
    for(const n of plan.nodes.filter(n=>['ev','parking','building','shelter','entrance','exit','vehicle-exit'].includes(n.kind))){const exit=['shelter','exit','vehicle-exit'].includes(n.kind),y=n.y||0;const sign=label(this.world,(exit?'↗ EXIT · ':'')+n.label,n.x,y+4,n.z,exit?'#ffffff':'#53685c',exit?STRUCTURE_COLORS.exit:'#fffdf2');if(exit){for(const x of [-1.8,1.8])box(this.world,.1,3.1,.1,STRUCTURE_COLORS.exit,n.x+x,y+1.55,n.z).userData.floorY=y;box(this.world,3.7,.28,.15,STRUCTURE_COLORS.exit,n.x,y+3.1,n.z).userData.floorY=y;}sign.userData.floorY=y;sign.userData.kind='route-label';if(plan.width<60)sign.scale.set(['parking','ev'].includes(n.kind)?4.5:7,1.2,1);if(n.kind==='ev'){box(this.world,.8,1.7,.65,'#328d7c',n.x+1,0.85,n.z+2);box(this.world,.52,.6,.03,'#243f45',n.x+1,1.1,n.z+2.34);}}
    if(sourceUrl){const material=new THREE.MeshBasicMaterial({transparent:true,opacity:plan.sourceCrop&&plan.width>300?.88:.46,depthWrite:false});const overlay=new THREE.Mesh(new THREE.PlaneGeometry(plan.width,plan.depth),material);overlay.rotation.x=-Math.PI/2;overlay.position.y=.045;this.world.add(overlay);this.sourceOverlay=overlay;new THREE.TextureLoader().load(sourceUrl,texture=>{if(overlay.parent!==this.world){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;if(plan.sourceCrop){const c=plan.sourceCrop;texture.repeat.set(c.width,c.height);texture.offset.set(c.x,1-c.y-c.height);}material.map=texture;material.needsUpdate=true;},undefined,()=>{overlay.visible=false;});}
    this.resize();this.frame(plan.width,plan.depth);
  }
  showExterior(site){this.clear();this.world.userData.mode='exterior';const width=site.footprint?Math.max(...site.footprint.map(p=>p.x))-Math.min(...site.footprint.map(p=>p.x))+20:50;box(this.world,width,.5,50,colors.ground,0,-.3,0);const model=buildingModel(site);this.world.add(model);this.world.userData.photoSha=model.userData.photoSha;this.world.userData.footprintSource=model.userData.footprintSource;this.frame(width,50);this.controls.target.y=7;}
  showLocations(sites,onSelect){
    this.clear();this.world.userData.mode='locations';this.markers=[];
    const placed=sites.filter(s=>s.location&&!s.synthetic).filter((s,i,a)=>a.findIndex(x=>x.siteId===s.siteId)===i);
    const anchor={lat:(Math.max(...placed.map(s=>s.location.lat))+Math.min(...placed.map(s=>s.location.lat)))/2,lng:(Math.max(...placed.map(s=>s.location.lng))+Math.min(...placed.map(s=>s.location.lng)))/2},positions=placed.map(site=>({site,p:localPosition(site.location,anchor)})),extent=Math.max(...positions.flatMap(v=>[Math.abs(v.p.x),Math.abs(v.p.z)]),1),scale=95/extent;
    box(this.world,220,1,220,'#dfe5d7',0,-1,0);const grid=new THREE.GridHelper(220,22,'#b1c1ad','#cbd5c2');this.world.add(grid);
    for(const {site,p} of positions){const model=buildingModel(site);model.scale.setScalar(.2);model.position.set(p.x*scale,0,p.z*scale);this.world.add(model);const pin=label(this.world,site.name.split(' · ')[0],p.x*scale,9,p.z*scale);pin.scale.set(12,2.25,1);pin.userData.siteId=site.id;this.markers.push(pin);}this.world.userData.placeCount=placed.length;
    this.canvas.onclick=event=>{const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObjects(this.markers)[0];if(hit)onSelect(hit.object.userData.siteId);};this.frame(180,180);
  }
  setPose(pose,mode){
    this.pose=pose;
    if(this.mode!==mode||!this.actor.children.length){dispose(this.actor);this.mode=mode;
      if(mode==='car'){
        box(this.actor,1.85,.68,4.35,'#f3eee0',0,.65);box(this.actor,1.55,.67,2.25,'#466c6c',0,1.28,-.1);box(this.actor,1.48,.1,1.75,'#dce6dc',0,1.65,-.1);
        for(const x of [-.97,.97])for(const z of [-1.32,1.3]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.2,16),new THREE.MeshStandardMaterial({color:'#283633'}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.38,z);this.actor.add(wheel);}
        box(this.actor,1.4,.12,.05,'#efad65',0,.7,2.19);
        for(const x of [-.79,.79])for(const z of [-2.2,2.2]){const lamp=box(this.actor,.24,.17,.08,'#633e18',x,.77,z);lamp.userData.indicator=x>0?'left':'right';}
      }else{const body=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.65,4,12),new THREE.MeshStandardMaterial({color:'#d8955c'}));body.position.y=.88;this.actor.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.19,16,12),new THREE.MeshStandardMaterial({color:'#eed8b8'}));head.position.y=1.6;this.actor.add(head);for(const x of [-.14,.14])box(this.actor,.18,.6,.2,'#496158',x,.3,0);}
    }
    this.actor.scale.set(mode==='car'?(this.vehicle?.width||1.9)/2.14:1,mode==='car'?(this.vehicle?.height||1.8)/1.7:1,mode==='car'?(this.vehicle?.length||4.6)/4.39:1);this.actor.visible=true;this.actor.position.set(pose.x,pose.y||0,pose.z);this.actor.rotation.set(-(pose.pitch||0),pose.heading||0,0,'YXZ');this.actor.userData.gear=pose.gear||1;
  }
  setView(view){this.scene.traverse(o=>{if(!o.isSprite)return;o.userData.overviewScale||=o.scale.clone();o.scale.copy(o.userData.overviewScale).multiplyScalar(view==='first'?.14:1);o.material.depthTest=view==='first';});this.view=view;this.heading=this.pose.heading||0;this.resize();this.controls.enabled=view==='orbit';this.actor.traverse(o=>{if(o.isMesh)o.visible=view!=='first';});if(view==='orbit'&&this.plan)this.frame(this.plan.width,this.plan.depth);}
  follow(dt){
    if(this.view==='orbit'||!this.actor.visible)return;
    if(this.view==='first'){
      const view=driverView(this.pose);this.heading=this.pose.heading||0;
      this.camera.position.set(view.position.x,view.position.y,view.position.z);this.camera.lookAt(view.target.x,view.target.y,view.target.z);
    }else{
      this.heading=dampHeading(this.heading,this.pose.heading||0,dt);const sin=Math.sin(this.heading),cos=Math.cos(this.heading),p=this.actor.position;
      this.camera.position.set(p.x-sin*9,p.y+6,p.z-cos*9);this.camera.lookAt(p.x+sin*10,p.y+1,p.z+cos*10);
    }
    this.actor.traverse(o=>{if(o.isMesh)o.visible=this.view!=='first';});
  }
  setIndicators(signal,lit){
    this.actor.userData.signal=signal;this.actor.userData.signalLit=lit;
    this.actor.traverse(o=>{if(!o.userData.indicator)return;const active=lit&&o.userData.indicator===signal;o.material.color.set(active?'#ffb428':'#633e18');o.material.emissive.set(active?'#ff9400':'#000000');o.material.emissiveIntensity=active?2:0;});
  }
  setFloor(value){
    this.floorView=value;
    this.world.children.forEach(o=>{const y=o.userData.floorY??o.position.y;const kind=o.userData.kind;o.visible=value==='all'||['ramp','stairs','ramp-sign','stairs-sign'].includes(kind)||Math.abs(y-Number(value))<2.5;if(kind==='parked-car')o.visible=o.visible&&this.showCars&&o.userData.spaceId!==this.parkingTarget;});
    if(this.sourceOverlay)this.sourceOverlay.visible=value==='all'||Number(value)===0;
  }
  setVehicle(vehicle){this.vehicle=vehicle;}
  pickParking(event){const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);return ray.intersectObjects(this.parkingPickers||[])[0]?.object.userData.spaceId;}
  setRoute(route){this.parkingTarget=route?.parking?.spaceId;this.setCars(this.showCars);dispose(this.routeGroup);if(route?.approach){const s=this.plan.spaces.find(s=>s.id===route.approach.spaceId);const points=[[-1,-1],[-1,1],[1,1],[1,-1],[-1,-1]].map(([x,z])=>({x:s.x+x*s.width/2,z:s.z+z*s.depth/2,y:(s.y||0)+.23}));line(this.routeGroup,points,'#da8a35',.09);label(this.routeGroup,route.destination.label,s.x,(s.y||0)+3,s.z,'#9a5e20').scale.set(6,1.1,1);}if(route?.points.length>1){const geometry=new THREE.BufferGeometry().setFromPoints(route.points.map(p=>new THREE.Vector3(p.x,(p.y||0)+.24,p.z)));this.routeGroup.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:route.mode==='person'?'#d98743':'#146b56'})));for(let i=1;i<route.points.length;i++)line(this.routeGroup,[{...route.points[i-1],y:(route.points[i-1].y||0)+.22},{...route.points[i],y:(route.points[i].y||0)+.22}],route.points[i-1].gear===-1?'#e1a02a':route.mode==='person'?'#e39d58':'#248770',.16);}}
  setHazards(hazards){dispose(this.hazardGroup);for(const h of hazards){const m=new THREE.Mesh(new THREE.CylinderGeometry(h.radius,h.radius,.5,48),new THREE.MeshBasicMaterial({color:'#d27652',transparent:true,opacity:.55}));m.position.set(h.x,(h.y||0)+.4,h.z);this.hazardGroup.add(m);label(this.hazardGroup,'위험 · 우회',h.x,5,h.z,'#b85031');}}
  setFinishes(update){Object.assign(this.finishes,update);const previous=new Set();this.materials=new Map();this.world.traverse(o=>{const kind=o.userData.surface;if(!kind)return;for(const m of Array.isArray(o.material)?o.material:[o.material])previous.add(m);o.material=surfaceMaterial(this.finishes[kind],this.materials);if(o.userData.doubleSide){o.material=o.material.clone();o.material.side=THREE.DoubleSide;}});for(const m of previous){m?.map?.dispose();m?.dispose();}}

  setCars(visible){this.showCars=visible;this.world.traverse(o=>{if(o.userData.kind==='parked-car')o.visible=visible&&o.userData.spaceId!==this.parkingTarget&&(this.floorView==='all'||Math.abs((o.userData.floorY||0)-Number(this.floorView))<.65);});}
  showText(visible){dispose(this.textGroup);if(!visible||!this.plan)return;for(const item of (this.plan.labels||[]).filter(t=>t.confidence>=.4).slice(0,200)){const s=label(this.textGroup,item.text,item.x,.8,item.z,'#596657');s.scale.set(Math.max(3,Math.min(16,item.width*1.3)),.8,1);s.userData.ocr=true;}}
  showDetectedParking(visible){
    dispose(this.detectedGroup);if(!visible||!this.plan)return;
    for(const s of this.plan.parkingDetection?.spaces||[]){
      const color=s.reviewedSpaceId?'#4286a3':'#bf813d',points=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>new THREE.Vector3(s.x+x*s.width/2,.2,s.z+z*s.depth/2));
      const geometry=new THREE.BufferGeometry().setFromPoints(points),mark=new THREE.LineLoop(geometry,new THREE.LineDashedMaterial({color,dashSize:.4,gapSize:.18,depthTest:false}));mark.computeLineDistances();mark.userData.candidateId=s.id;this.detectedGroup.add(mark);
    }
  }
  showCharging(result,selectedId){dispose(this.chargingGroup);this.world.traverse(o=>{if(o.userData.kind==='route-label')o.visible=false;});for(const c of result.ranked){if(!c.excluded){const heat=new THREE.Mesh(new THREE.PlaneGeometry(c.space.width,c.space.depth),new THREE.MeshBasicMaterial({color:scoreColor(c.score),transparent:true,opacity:.72,depthWrite:false}));heat.rotation.x=-Math.PI/2;heat.position.set(c.space.x,.16,c.space.z);this.chargingGroup.add(heat);}if(c.selected||c.id===selectedId){const charger=box(this.chargingGroup,.45,1.4,.32,scoreColor(c.score),c.point.x,.7,c.point.z);charger.userData.candidateId=c.id;label(this.chargingGroup,`${c.label.replace(/^주차\s*/, '')} · ${c.score??'—'}점`,c.point.x,3.2,c.point.z,scoreColor(c.score)).scale.set(Math.min(5,Math.max(3,c.space.depth*.85)),.85,1);}}this.chargingGroup.userData.selectedIds=result.selected.map(c=>c.id);}
  dispose(){this.renderer.setAnimationLoop(null);this.observer.disconnect();this.controls.dispose();for(const g of [this.world,this.routeGroup,this.hazardGroup,this.actor,this.chargingGroup,this.textGroup,this.detectedGroup])dispose(g);this.renderer.dispose();}
}
