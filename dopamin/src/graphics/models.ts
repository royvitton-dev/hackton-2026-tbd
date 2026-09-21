import * as THREE from 'three';
import { createNintendoHead } from './characters';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const materials = new Map<string, THREE.MeshStandardMaterial>();
export function material(color: THREE.ColorRepresentation, roughness = .7) {
  const key = `${color}-${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key)!;
}
export function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material(color));
  object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true;
  return object;
}
export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w,h,d), color,x,y,z); }
export function sphere(size: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) { return mesh(new THREE.SphereGeometry(size, 20, 16), color, x,y,z); }
export function cylinder(top: number, bottom: number, height: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) { return mesh(new THREE.CylinderGeometry(top, bottom, height, 24),color,x,y,z); }

export function createHead(variant: number, _color: string): THREE.Group {
  return createNintendoHead(variant);
}

export function createKart(variant: number, color: string) {
  const kart = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(1.65,.55,2.6,3,.18),color,0,.53,0); kart.add(body);
  const nose=mesh(new RoundedBoxGeometry(1.44,.38,1.0,3,.14),color,0,.49,1.4); nose.rotation.x=.12; kart.add(nose);
  kart.add(box(1.7,.16,.24,'#e7e2d5',0,.4,1.95));
  kart.add(box(.65,.05,1.35,'#fff7e9',0,.78,.65));
  kart.add(box(1.1,.54,.2,'#3d403a',0,.9,-.7));
  kart.add(box(2.12,.13,.48,color,0,1.1,-1.35));
  for (const side of [-1,1]) {
    kart.add(box(.08,.6,.08,'#54594d',side*.6,.86,-1.35));
    for (const z of [-.92,1.05]) {
      const wheel=new THREE.Group();wheel.position.set(side*1.01,.44,z);wheel.name='wheel';
      const tire=cylinder(.47,.47,.40,'#252d33');tire.rotation.z=Math.PI/2;wheel.add(tire);
      const hub=cylinder(.25,.25,.42,'#dbe5ee');hub.rotation.z=Math.PI/2;wheel.add(hub);
      for(let j=0;j<5;j++){const spoke=box(.44,.045,.38,'#788897');spoke.rotation.x=j*Math.PI/5;wheel.add(spoke);}
      const axle=cylinder(.10,.10,.44,color);axle.rotation.z=Math.PI/2;wheel.add(axle);kart.add(wheel);
    }
    kart.add(box(.28,.13,.06,'#fff4c7',side*.5,.64,1.92));
  }
  const steering=mesh(new THREE.TorusGeometry(.32,.035,8,20),'#373a34',0,1,.63); steering.rotation.x=-.5; kart.add(steering);
  for(const side of [-1,1]){const exhaust=cylinder(.15,.18,.7,'#9eafbc',side*.55,.55,-1.55);exhaust.rotation.x=Math.PI/2;kart.add(exhaust);kart.add(box(.32,.12,.06,'#ff4338',side*.54,.76,-1.36));}
  const head = createHead(variant,color);head.name='head';head.scale.setScalar(.88);head.position.set(0,1.62,-.1);kart.add(head);
  const glow=mesh(new THREE.ConeGeometry(.25,1.4,10),'#ffb34b',0,.5,-2); glow.rotation.x=-Math.PI/2; glow.visible=false; glow.name='boost'; kart.add(glow);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.9,20,12),new THREE.MeshStandardMaterial({color:'#79efff',emissive:'#36bfdc',emissiveIntensity:.7,transparent:true,opacity:.22,wireframe:true})); shield.position.y=.9; shield.visible=false; shield.name='shield'; kart.add(shield);
  return kart;
}

export function textTexture(text: string, background: string, color: string, width=512, height=128) {
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d')!; ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=color;ctx.font=`900 ${Math.floor(height*.52)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2,width*.91);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

const thumbnailCache = new Map<string,string>();
let thumbnailRenderer: THREE.WebGLRenderer | undefined;
export function avatarImage(variant: number, color: string): string {
  const key=`${variant}-${color}`; if(thumbnailCache.has(key)) return thumbnailCache.get(key)!;
  if(!thumbnailRenderer) { thumbnailRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});thumbnailRenderer.setSize(192,192);thumbnailRenderer.setPixelRatio(1); }
  const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(32,1,.1,20);camera.position.set(.4,.24,4.4);camera.lookAt(0,.08,0);
  scene.add(new THREE.HemisphereLight('#fff8e8','#aab4bc',3));const light=new THREE.DirectionalLight('#fff7e5',3);light.position.set(-3,5,4);scene.add(light);
  const head=createHead(variant,color);head.rotation.y=-.13;scene.add(head);
  thumbnailRenderer.render(scene,camera);const url=thumbnailRenderer.domElement.toDataURL();thumbnailCache.set(key,url);
  head.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});return url;
}
