import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function concreteMaterial(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const context=canvas.getContext('2d');let seed=819;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 context.fillStyle='#e4e5e0';context.fillRect(0,0,512,512);
 for(let i=0;i<40000;i++){const grey=175+Math.floor(random()*65);context.fillStyle=`rgba(${grey},${grey},${grey},.18)`;context.fillRect(random()*512,random()*512,1,1);}
 for(let i=0;i<24;i++){context.fillStyle='rgba(120,133,120,.018)';context.beginPath();context.arc(random()*512,random()*512,20+random()*100,0,Math.PI*2);context.fill();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(14,9);map.anisotropy=8;
 const material=new THREE.MeshStandardMaterial({color:'#9ca99c',map,roughness:.48,metalness:.08,bumpMap:map,bumpScale:.025});material.userData.persistent=true;
 const loader=new THREE.TextureLoader();
 material.userData.ready=Promise.all([loader.loadAsync('/materials/concrete-diffuse.jpg'),loader.loadAsync('/materials/concrete-normal.jpg'),loader.loadAsync('/materials/concrete-roughness.jpg')]).then(([diffuse,normal,roughness])=>{
  for(const texture of [diffuse,normal,roughness]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(28,18);texture.anisotropy=8;}
  diffuse.colorSpace=THREE.SRGBColorSpace;material.map=diffuse;material.normalMap=normal;material.normalScale.set(.12,.12);material.roughnessMap=roughness;material.roughness=.68;material.bumpMap=null;material.needsUpdate=true;map.dispose();
 }).catch(()=>{});
 return material;
}

// Merge only immobile geometry; moving avatars and the switchable ceiling stay independent.
export function batchStatic(root){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),batches=new Map(),originals=[];
 root.traverse(object=>{
  if(!object.isMesh||Array.isArray(object.material))return;for(let p=object;p&&p!==root;p=p.parent)if(p.userData.dynamic)return;
  if(!batches.has(object.material))batches.set(object.material,[]);
  const geometry=object.geometry.clone();geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));const normalized=geometry.index?geometry.toNonIndexed():geometry;
  for(const attr of Object.keys(normalized.attributes))if(!['position','normal','uv'].includes(attr))normalized.deleteAttribute(attr);
  batches.get(object.material).push(normalized);if(normalized!==geometry)geometry.dispose();originals.push(object);
 });
 originals.forEach(o=>o.removeFromParent());
 for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
}
