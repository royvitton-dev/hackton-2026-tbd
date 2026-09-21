import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const cache=new Map();
export const palette={cream:'#eee0c8',stone:'#c4b59b',pink:'#d78983',blue:'#397b8c',gold:'#c9a459',grass:'#72905c',dark:'#25483d',path:'#e4d8be'};
export function material(color,options={}) {const key=color+JSON.stringify(options);if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color,roughness:.72,...options}));return cache.get(key);}
const boxGeometry=new THREE.BoxGeometry(1,1,1), sphereGeometry=new THREE.SphereGeometry(1,16,12), cylinderGeometry=new THREE.CylinderGeometry(1,1,1,24);
export function mesh(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,typeof mat==='string'?material(mat):mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(parent,w,h,d,color,x=0,y=0,z=0){const m=mesh(parent,boxGeometry,color,x,y,z);m.scale.set(w,h,d);return m;}
export function rounded(parent,w,h,d,r,color,x=0,y=0,z=0){return mesh(parent,new RoundedBoxGeometry(w,h,d,2,r),color,x,y,z);}
export function sphere(parent,xr,yr,zr,color,x=0,y=0,z=0){const m=mesh(parent,sphereGeometry,color,x,y,z);m.scale.set(xr,yr,zr);return m;}
export function cylinder(parent,r,h,color,x=0,y=0,z=0,top=r){return mesh(parent,top===r?cylinderGeometry:new THREE.CylinderGeometry(top,r,h,32),color,x,y,z).scale.set(...(top===r?[r,h,r]:[1,1,1]));}
// A cylinder helper returning its mesh, useful for rotated columns and wheels.
export function cyl(parent,r,h,color,x=0,y=0,z=0,top=r){const m=mesh(parent,top===r?cylinderGeometry:new THREE.CylinderGeometry(top,r,h,32),color,x,y,z);if(top===r)m.scale.set(r,h,r);return m;}
export function cone(parent,r,h,color,x=0,y=0,z=0){return mesh(parent,new THREE.ConeGeometry(r,h,32),color,x,y,z);}
export function torus(parent,r,t,color,x=0,y=0,z=0){return mesh(parent,new THREE.TorusGeometry(r,t,8,48),color,x,y,z);}
export function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
export function seeded(seed=42){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function texture(type){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');const rand=seeded(61);
 if(type==='stone'){
  c.fillStyle='#d2c2a5';c.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=32)for(let x=-64;x<512;x+=64){const xx=x+(y/32%2)*32;c.fillStyle=`hsl(39 24% ${72+rand()*12}%)`;c.fillRect(xx+1,y+1,62,30);}
 }else if(type==='roof'){
  c.fillStyle='#347184';c.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=20)for(let x=-20;x<512;x+=28){c.fillStyle=`hsl(${188+rand()*8} 36% ${25+rand()*18}%)`;c.fillRect(x+(y/20%2)*14,y,27,18);}
 }else if(type==='grass'){
  c.fillStyle='#789262';c.fillRect(0,0,512,512);
  for(let i=0;i<60000;i++){c.fillStyle=`hsla(${74+rand()*30},${20+rand()*25}%,${25+rand()*30}%,.35)`;c.fillRect(rand()*512,rand()*512,1+rand()*2,1+rand()*4);}
 }else{
  c.fillStyle='#e1d5bc';c.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=64){c.strokeStyle='#cabea5';c.strokeRect(x+1,y+1,62,62);}
  for(let i=0;i<15000;i++){c.fillStyle=`rgba(100,80,50,${rand()*.09})`;c.fillRect(rand()*512,rand()*512,2,2);}
 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(type==='grass'?12:3,type==='grass'?12:3);t.anisotropy=8;return t;
}
export function textSign(parent,text,w,h,color='#f7e8bc',background='#244c46',x=0,y=0,z=0){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);const c=canvas.getContext('2d');
 c.fillStyle=background;c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle=color;c.lineWidth=5;c.strokeRect(10,10,canvas.width-20,canvas.height-20);
 c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${Math.min(90,canvas.height*.5)}px Georgia, serif`;c.fillText(text,512,canvas.height/2,940);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
 return mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.65}),x,y,z);
}
export function arch(parent,w,h,depth,color,x,y,z){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h-w/2);s.absarc(0,h-w/2,w/2,Math.PI,0,true);s.lineTo(w/2,0);s.closePath();return mesh(parent,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:12}),color,x,y,z);}
export function staticBatch(root){
 root.updateMatrixWorld(true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();const batches=new Map(), originals=[];
 root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;let p=o;while(p&&p!==root){if(p.userData.dynamic)return;p=p.parent;}
  const key=o.material.uuid; if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});
  const g=o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));batches.get(key).geometries.push(g);originals.push(o);
 });
 for(const o of originals)o.removeFromParent();
 for(const {material:mat,geometries} of batches.values()){
  // Different geometry primitives can have different attributes; only position/normal/uv are needed here.
  const normalized=geometries.map(g=>{const n=g.index?g.toNonIndexed():g;for(const key of Object.keys(n.attributes))if(!['position','normal','uv'].includes(key))n.deleteAttribute(key);if(!n.attributes.uv)n.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n.attributes.position.count*2),2));return n;});
  const merged=mergeGeometries(normalized);if(merged)mesh(root,merged,mat);
  for(const g of new Set([...geometries,...normalized]))g.dispose();
 }
}
