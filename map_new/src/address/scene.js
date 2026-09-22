import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildingProfile} from './model.js';
import {buildReviewedExterior} from './buildings.js';

function clear(root) {
  const materials = new Set(), textures = new Set();
  root.traverse(o => { o.geometry?.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) { materials.add(m); for(const v of Object.values(m))if(v?.isTexture)textures.add(v); } });
  textures.forEach(t=>t.dispose()); materials.forEach(m=>m.dispose()); root.clear();
}
function box(root,w,h,d,material,x=0,y=h/2,z=0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,.01),Math.max(h,.01),Math.max(d,.01)),material);
  mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
}
const material = color => new THREE.MeshStandardMaterial({color,roughness:.82});

export class AddressScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.04;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e8ecec');
    this.camera = new THREE.PerspectiveCamera(38,1,.1,20000);
    this.controls = new OrbitControls(this.camera,canvas); this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI*.53; this.controls.autoRotateSpeed = .65;
    this.scene.add(new THREE.HemisphereLight('#e9f2ff','#8b877c',2.1));
    this.sun = new THREE.DirectionalLight('#fff5df',2.5); this.sun.position.set(55,90,45); this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048); this.sun.shadow.bias=-.0004; this.scene.add(this.sun);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.observer = new ResizeObserver(()=>this.resize()); this.observer.observe(canvas.parentElement); this.resize();
    let previous=performance.now();
    this.renderer.setAnimationLoop(()=>{const now=performance.now();this.controls.update(Math.min(.05,(now-previous)/1000));previous=now;this.renderer.render(this.scene,this.camera);});
  }
  resize() {
    const {width,height} = this.canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width,height,false); this.camera.aspect=width/height; this.camera.updateProjectionMatrix();if(this.extent)this.home();
  }
  show(site,data,settings={},assetBase='/map_new/') {
    this.revision=(this.revision||0)+1;this.reviewed?.palette.dispose();this.reviewed=null;clear(this.root); this.site=site; this.data=data; this.settings=settings;
    this.profile=buildingProfile(site,data?.plan,settings); this.view=settings.view || 'exterior';
    const model = new THREE.Group(); this.root.add(model); const p=this.profile;
    if (this.view==='drawing' && data?.model) this.drawing(model,data,site,assetBase);
    else {
      this.reviewed=buildReviewedExterior(model,p,site,settings,assetBase,this.renderer);
      if(this.reviewed){this.wallMaterials=this.reviewed.palette.wallMaterials;this.reviewed.palette.onChange=()=>this.onMaterialsChanged?.(this.reviewed.palette.snapshot());}
      else this.exterior(model,p);
    }
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    model.position.x=-center.x; model.position.z=-center.z;
    this.modelSize=size;this.height=Math.max(size.y,3); this.extent=Math.max(size.x,size.z,12);
    const ground=box(this.root,this.extent*2.1,.22,this.extent*1.8,material('#d5d8d3'),0,-.2,0); ground.castShadow=false;
    if(this.reviewed) {
      const {width,depth,rotation}=this.reviewed.framing,street=new THREE.Group();street.rotation.y=rotation;this.root.add(street);
      box(street,width+12,.09,2.1,material('#b5b7b1'),0,-.02,depth/2+1.05);
      box(street,width+14,.035,6,material('#858b8b'),0,-.09,depth/2+5.3);
      box(street,width+12,.16,.18,material('#d0d1c8'),0,-.015,depth/2+2.15);
      for(let x=-width/2-4;x<width/2+4;x+=1.1)box(street,.012,.005,2,material('#959d98'),x,.028,depth/2+1.04);
    } else {
      const grid=new THREE.GridHelper(this.extent*1.6,16,'#afbdac','#ccd6c7'); grid.position.y=-.07; this.root.add(grid);
    }
    this.sun.shadow.camera.left=-this.extent; this.sun.shadow.camera.right=this.extent;
    this.sun.shadow.camera.top=this.extent; this.sun.shadow.camera.bottom=-this.extent;
    this.sun.shadow.camera.far=this.extent*8+300; this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(-this.extent*.75,this.extent*.75+this.height,this.extent*.65);
    this.camera.far=Math.max(2000,this.extent*20); this.controls.maxDistance=this.extent*12; this.controls.minDistance=Math.max(4,this.extent*.15);
    this.home(); this.canvas.dataset.ready='true'; this.canvas.dataset.site=site.id;
    this.canvas.dataset.modelKind=this.view==='drawing'?'drawing':p.footprintKind;
    return p;
  }
  exterior(root,p) {
    const shape=new THREE.Shape(p.footprint.map(v=>new THREE.Vector2(v.x,-v.z)));
    const wall=material(p.color),base=material(p.baseColor),slab=material('#f0f0e5'),glass=material(p.glass);
    this.wallMaterials=[wall];
    const plate=(y,height,mat)=>{const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1}),mat); mesh.rotation.x=-Math.PI/2; mesh.position.y=y; mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh);};
    plate(0,p.baseHeight,base);
    for(let level=1;level<p.floors;level++) {plate(p.baseHeight+(level-1)*p.floorHeight,p.floorHeight-.10,wall);plate(p.baseHeight+level*p.floorHeight-.1,.1,slab);}
    plate(p.height,.22,slab);
    // Windows are a disclosed facade study, not detections from the reference photo.
    for(let side=0;side<p.footprint.length;side++) {
      const a=p.footprint[side],b=p.footprint[(side+1)%p.footprint.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),count=Math.min(18,Math.floor(len/3.3));
      if (len<3) continue;
      for(let level=1;level<p.floors;level++) for(let i=0;i<count;i++) {
        const t=(i+.5)/count,x=a.x+dx*t,z=a.z+dz*t,y=p.baseHeight+(level-.5)*p.floorHeight;
        const pane=box(root,Math.min(1.4,len/count*.5),p.floorHeight*.48,.12,glass,x,y,z); pane.rotation.y=-Math.atan2(dz,dx);
      }
    }
  }
  drawing(root,data,site,assetBase) {
    const revision=this.revision;
    const wall=material('#d8d6c6'); this.wallMaterials=[wall];
    for(const entry of data.model.meshes || []) {
      if (!entry.positions?.length || !entry.positions.every(Number.isFinite)) continue;
      const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(entry.positions,3)); geometry.setIndex(entry.indices); geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,wall); mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh);
    }
    const plan=data.plan,w=Number(plan.width),d=Number(plan.depth);
    if (!(w>0&&d>0&&w<10000&&d<10000)) return;
    box(root,w,.1,d,material('#eeeedd'),0,-.07,0);
    if(site.sourceAsset?.file) {
      const mat=new THREE.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false});
      const drawing=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat); drawing.rotation.x=-Math.PI/2; drawing.position.y=.015; root.add(drawing);
      new THREE.TextureLoader().load(new URL(site.sourceAsset.file,new URL(assetBase,location.href)).href,texture=>{
        if (revision!==this.revision||!drawing.parent) {texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        if(plan.sourceCrop) {const c=plan.sourceCrop;texture.repeat.set(c.width,c.height);texture.offset.set(c.x,1-c.y-c.height);}
        mat.map=texture;mat.needsUpdate=true;
      },undefined,()=>{drawing.visible=false;});
    }
  }
  setColor(color) {if(this.reviewed)this.reviewed.palette.setColor(color);else for(const m of this.wallMaterials || [])m.color.set(color);this.profile.color=color;this.profile.photoTexture=false;}
  home() {
    if(this.reviewed) {
      const {azimuth:yaw,width,depth,rotation}=this.reviewed.framing,pitch=-.025,angle=yaw-rotation;
      this.camera.fov=46;
      const projectedWidth=Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*depth;
      const projectedDepth=Math.abs(Math.sin(angle))*width+Math.abs(Math.cos(angle))*depth;
      const projectedHeight=this.height*Math.cos(pitch)+projectedDepth*Math.abs(Math.sin(pitch));
      const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
      const radius=Math.max(projectedWidth/(2*tan*this.camera.aspect*.85),projectedHeight/(2*tan*.62))+projectedDepth*.45;
      const target=this.height*.47;
      this.camera.position.set(Math.sin(yaw)*Math.cos(pitch)*radius,target+Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius);
      this.controls.target.set(0,target,0);
      const rect=this.canvas.getBoundingClientRect();this.camera.setViewOffset(rect.width,rect.height,0,-rect.height*.07,rect.width,rect.height);
    } else {
      this.camera.fov=38;this.camera.clearViewOffset();const radius=Math.max(this.extent*1.6,this.height*2.3,25)/Math.min(1,this.camera.aspect);
      this.camera.position.set(radius*.65,radius*.65,radius); this.controls.target.set(0,this.height*.36,0);
    }
    this.camera.updateProjectionMatrix(); this.controls.update();
  }
  top() {this.camera.position.set(0,this.extent*1.6/Math.min(1,this.camera.aspect),1);this.controls.target.set(0,0,0);this.controls.update();}
  setBearing(degrees) {
    if(!Number.isFinite(degrees))return;
    const radius=Math.max(this.extent*1.6,this.height*2.3,25)/Math.min(1,this.camera.aspect),angle=degrees*Math.PI/180;
    this.camera.position.set(-Math.sin(angle)*radius,this.height+radius*.25,Math.cos(angle)*radius);
    this.controls.target.set(0,this.height*.4,0);this.controls.update();
  }
  snapshot() {return {site:this.site?.id,kind:this.canvas.dataset.modelKind,profile:this.profile,camera:this.camera.position.toArray(),triangles:this.renderer.info.render.triangles,photoSurfaces:this.reviewed?.palette.snapshot()||[],details:this.reviewed?.counts||{}};}
  dispose() {this.revision++;this.renderer.setAnimationLoop(null);this.observer.disconnect();this.controls.dispose();this.reviewed?.palette.dispose();clear(this.root);this.renderer.dispose();}
}
