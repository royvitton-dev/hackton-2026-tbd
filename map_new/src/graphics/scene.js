import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {dampHeading} from '../core/camera.js';
import {localPosition} from '../core/geometry.js';
const colors={ground:'#e7e8dd',wall:'#e1ded0',lane:'#788c83',green:'#276e5c',orange:'#dd834b'};
function box(parent,w,h,d,color,x=0,y=h/2,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.78}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function line(parent,points,color,width=.1){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,p.y??.08,p.z)),false,'centripetal');const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(2,points.length*3),width,6,false),new THREE.MeshBasicMaterial({color}));parent.add(m);return m;}
function label(parent,text,x,y,z,color='#285d50'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#fffdf2';ctx.beginPath();ctx.roundRect(3,3,506,90,20);ctx.fill();ctx.font='600 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,50,490);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(17,3.2,1);parent.add(sprite);return sprite;
}
function dispose(root){root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){m?.map?.dispose();m?.dispose();}});root.clear();}
export function buildingModel(site){
  const g=new THREE.Group(),f=site.photo?.facade;
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
    this.world=new THREE.Group();this.routeGroup=new THREE.Group();this.hazardGroup=new THREE.Group();this.scene.add(this.world,this.routeGroup,this.hazardGroup);
    this.actor=new THREE.Group();this.scene.add(this.actor);this.view='orbit';this.heading=0;this.pose={x:0,z:0,heading:0};this.mode='car';
    this.resize=()=>{const {width,height}=canvas.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.setViewOffset(width,height,width>760&&this.world?.userData.mode==='plan'?Math.min(150,width*.17):0,0,width,height);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);};this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);
    let previous=performance.now();this.renderer.setAnimationLoop(now=>{const dt=Math.min(.1,(now-previous)/1000);previous=now;if(document.hidden)return;onFrame(dt);this.follow(dt);this.controls.update();this.renderer.render(this.scene,this.camera);canvas.dataset.ready='true';});
  }
  clear(){dispose(this.world);dispose(this.routeGroup);dispose(this.hazardGroup);this.actor.visible=false;this.view='orbit';this.controls.enabled=true;this.canvas.dataset.ready='false';}
  frame(width,depth){this.resize();const max=Math.max(width,depth),vertical=max/Math.min(1,this.camera.aspect);this.controls.target.set(0,0,0);this.camera.position.set(max*.62,vertical,vertical*1.18);this.controls.minDistance=5;this.controls.maxDistance=max*4;this.controls.update();}
  showPlan(plan,model,sourceUrl){
    this.clear();this.plan=plan;this.world.userData.mode='plan';this.world.userData.meshCount=model.meshes.length;
    box(this.world,plan.width,.65,plan.depth,colors.ground,0,-.4,0);
    for(const data of model.meshes){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors.wall,roughness:.85}));mesh.castShadow=true;mesh.receiveShadow=true;this.world.add(mesh);}
    for(const edge of plan.edges){const a=plan.nodes.find(n=>n.id===edge.from),b=plan.nodes.find(n=>n.id===edge.to),length=Math.hypot(b.x-a.x,b.z-a.z);const lane=box(this.world,length,.02,edge.width,edge.kind==='road'?'#87978d':edge.modes.includes('car')?'#b5c0b4':'#acc7b5',(a.x+b.x)/2,.012,(a.z+b.z)/2);lane.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);for(let p=2;p<length-1;p+=4){const mark=box(this.world,1.5,.022,.09,'#f1f1d7',a.x+(b.x-a.x)*p/length,.03,a.z+(b.z-a.z)*p/length);mark.rotation.y=lane.rotation.y;}}
    for(const s of plan.spaces){if(!['parking','ev'].includes(s.kind))continue;const points=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>({x:s.x+x*s.width/2,z:s.z+z*s.depth/2,y:.08}));line(this.world,points,s.kind==='ev'?'#37a391':'#faf9e9',.045);}
    for(const n of plan.nodes.filter(n=>['ev','parking','building','shelter','entrance','exit'].includes(n.kind))){label(this.world,n.label,n.x,4,n.z,n.kind==='shelter'?'#2b715d':'#53685c');if(n.kind==='ev'){box(this.world,.8,1.7,.65,'#328d7c',n.x+1,0.85,n.z+2);box(this.world,.52,.6,.03,'#243f45',n.x+1,1.1,n.z+2.34);}}
    if(sourceUrl){const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.46,depthWrite:false});const overlay=new THREE.Mesh(new THREE.PlaneGeometry(plan.width,plan.depth),material);overlay.rotation.x=-Math.PI/2;overlay.position.y=.045;this.world.add(overlay);this.sourceOverlay=overlay;new THREE.TextureLoader().load(sourceUrl,texture=>{if(overlay.parent!==this.world){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;if(plan.sourceCrop){const c=plan.sourceCrop;texture.repeat.set(c.width,c.height);texture.offset.set(c.x,1-c.y-c.height);}material.map=texture;material.needsUpdate=true;},undefined,()=>{overlay.visible=false;});}
    this.resize();this.frame(plan.width,plan.depth);
  }
  showExterior(site){this.clear();this.world.userData.mode='exterior';const width=site.footprint?Math.max(...site.footprint.map(p=>p.x))-Math.min(...site.footprint.map(p=>p.x))+20:50;box(this.world,width,.5,50,colors.ground,0,-.3,0);const model=buildingModel(site);this.world.add(model);this.world.userData.photoSha=model.userData.photoSha;this.world.userData.footprintSource=model.userData.footprintSource;this.frame(width,50);this.controls.target.y=7;}
  showLocations(sites,onSelect){
    this.clear();this.world.userData.mode='locations';const anchor={lat:37.56,lng:127.04};this.markers=[];
    const placed=sites.filter(s=>s.location&&!s.synthetic).filter((s,i,a)=>a.findIndex(x=>x.siteId===s.siteId)===i);
    box(this.world,220,1,220,'#dfe5d7',0,-1,0);const grid=new THREE.GridHelper(220,22,'#b1c1ad','#cbd5c2');this.world.add(grid);
    for(const site of placed){const p=localPosition(site.location,anchor),model=buildingModel(site);model.scale.setScalar(.5);model.position.set(p.x/100,0,p.z/100);this.world.add(model);const pin=label(this.world,site.name.split(' · ')[0],p.x/100,19,p.z/100);pin.userData.siteId=site.id;this.markers.push(pin);}
    this.canvas.onclick=event=>{const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObjects(this.markers)[0];if(hit)onSelect(hit.object.userData.siteId);};this.frame(180,180);
  }
  setPose(pose,mode){
    this.pose=pose;
    if(this.mode!==mode||!this.actor.children.length){dispose(this.actor);this.mode=mode;
      if(mode==='car'){
        box(this.actor,1.85,.68,4.35,'#f3eee0',0,.65);box(this.actor,1.55,.67,2.25,'#466c6c',0,1.28,-.1);box(this.actor,1.48,.1,1.75,'#dce6dc',0,1.65,-.1);
        for(const x of [-.97,.97])for(const z of [-1.32,1.3]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.2,16),new THREE.MeshStandardMaterial({color:'#283633'}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.38,z);this.actor.add(wheel);}
        box(this.actor,1.4,.12,.05,'#efad65',0,.7,2.19);
      }else{const body=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.65,4,12),new THREE.MeshStandardMaterial({color:'#d8955c'}));body.position.y=.88;this.actor.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.19,16,12),new THREE.MeshStandardMaterial({color:'#eed8b8'}));head.position.y=1.6;this.actor.add(head);for(const x of [-.14,.14])box(this.actor,.18,.6,.2,'#496158',x,.3,0);}
    }
    this.actor.visible=true;this.actor.position.set(pose.x,pose.y||0,pose.z);this.actor.rotation.y=pose.heading||0;
  }
  setView(view){this.view=view;this.controls.enabled=view==='orbit';this.actor.traverse(o=>{if(o.isMesh)o.visible=view!=='first';});if(view==='orbit'&&this.plan)this.frame(this.plan.width,this.plan.depth);}
  follow(dt){if(this.view==='orbit'||!this.actor.visible)return;this.heading=dampHeading(this.heading,this.pose.heading||0,dt);const sin=Math.sin(this.heading),cos=Math.cos(this.heading),p=this.actor.position;const first=this.view==='first';this.actor.visible=!first;const y=this.mode==='car'?1.4:1.65;this.camera.position.set(p.x-sin*(first?0:9),p.y+(first?y:6),p.z-cos*(first?0:9));this.camera.lookAt(p.x+sin*10,p.y+(first?y:1),p.z+cos*10);this.actor.visible=true;this.actor.traverse(o=>{if(o.isMesh)o.visible=!first;});}
  setRoute(route){dispose(this.routeGroup);if(route?.points.length>1){const geometry=new THREE.BufferGeometry().setFromPoints(route.points.map(p=>new THREE.Vector3(p.x,(p.y||0)+.24,p.z)));this.routeGroup.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:route.mode==='person'?'#d98743':'#146b56'})));for(let i=1;i<route.points.length;i++)line(this.routeGroup,[{...route.points[i-1],y:(route.points[i-1].y||0)+.22},{...route.points[i],y:(route.points[i].y||0)+.22}],route.mode==='person'?'#e39d58':'#248770',.16);}}
  setHazards(hazards){dispose(this.hazardGroup);for(const h of hazards){const m=new THREE.Mesh(new THREE.CylinderGeometry(h.radius,h.radius,.5,48),new THREE.MeshBasicMaterial({color:'#d27652',transparent:true,opacity:.55}));m.position.set(h.x,(h.y||0)+.4,h.z);this.hazardGroup.add(m);label(this.hazardGroup,'위험 · 우회',h.x,5,h.z,'#b85031');}}
  dispose(){this.renderer.setAnimationLoop(null);this.observer.disconnect();this.controls.dispose();for(const g of [this.world,this.routeGroup,this.hazardGroup,this.actor])dispose(g);this.renderer.dispose();}
}
