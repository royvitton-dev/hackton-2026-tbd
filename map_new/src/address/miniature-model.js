import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildReviewedExterior} from './buildings.js';
import {buildingProfile} from './model.js';
import {facadeFor} from './facades.js';
import {semanticObject} from '../graphics/objects.js';

// Keep proportions and only shrink source geometry. The cap prevents a large
// parking floor from covering its neighbouring address markers.
export function miniatureScale(size,percent=70){
  const longest=Math.max(size.x,size.y,size.z,.01);
  return Math.min(1,36/longest)*Math.max(.3,Math.min(1,Number(percent)/100||.7));
}

function mergeStaticMeshes(root){
  root.updateMatrixWorld(true);
  const batches=new Map(),oldGeometries=new Set();
  root.traverse(object=>{
    if(!object.isMesh||Array.isArray(object.material))return;
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    if(!batches.has(object.material))batches.set(object.material,[]);
    batches.get(object.material).push(geometry);oldGeometries.add(object.geometry);
  });
  // Decorative line annotations are not part of the building mesh.
  root.traverse(object=>{if(object.isLine){oldGeometries.add(object.geometry);object.material.dispose();}});
  root.clear();oldGeometries.forEach(g=>g.dispose());
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(geometry)root.add(new THREE.Mesh(geometry,material));
  }
}

export function createMiniature(place,data,{renderer,assetBase,onChange=()=>{}}={}){
  const root=new THREE.Group();let reviewed=null,sourceMeshes=0,kind='drawing',features={};
  if(facadeFor(place)){
    reviewed=buildReviewedExterior(root,buildingProfile(place,data?.plan),place,{},assetBase,renderer);
    reviewed.palette.onChange=onChange;kind='exterior';features=reviewed.counts;
    root.traverse(o=>{if(o.isMesh)sourceMeshes++;});
  }else{
    const walls=new THREE.MeshStandardMaterial({color:'#d8d4bd',roughness:.83});
    const glass=new THREE.MeshStandardMaterial({color:'#86abb8',roughness:.25,transparent:true,opacity:.65});
    for(const entry of data?.model?.meshes||[]){
      if(!entry.positions?.length||entry.positions.length%3||!entry.positions.every(Number.isFinite))continue;
      if(!entry.indices?.length||!entry.indices.every(i=>Number.isInteger(i)&&i>=0&&i<entry.positions.length/3))continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(entry.positions,3));geometry.setIndex(entry.indices);geometry.computeVertexNormals();
      root.add(new THREE.Mesh(geometry,entry.material==='glazing'?glass:walls));sourceMeshes++;
    }
    const cache=new Map();
    for(const entry of data?.model?.objects||[]){
      if(!['column','stairs','lift','door','room','ramp'].includes(entry.kind))continue;
      const object=semanticObject(entry,{},cache);root.add(object);features[entry.kind]=(features[entry.kind]||0)+1;
    }
    if(!root.children.length){walls.dispose();glass.dispose();return null;}
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const slab=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.1,size.x),.12,Math.max(.1,size.z)),new THREE.MeshStandardMaterial({color:'#eeecdf',roughness:.95}));
    slab.position.set(center.x,bounds.min.y-.06,center.z);root.add(slab);
    // Unused materials are not reachable from the final group.
    const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material);});
    if(!used.has(walls))walls.dispose();if(!used.has(glass))glass.dispose();
  }
  mergeStaticMeshes(root);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  for(const mesh of root.children){mesh.geometry.translate(-center.x,-bounds.min.y,-center.z);mesh.geometry.computeBoundingSphere();mesh.userData.siteId=place.siteId;}
  const model={root,kind,size,sourceMeshes,renderMeshes:root.children.length,features,
    textures:()=>reviewed?.palette.snapshot()||[],
    dispose(){
      reviewed?.palette.dispose();const materials=new Set(),textures=new Set();
      root.traverse(o=>{o.geometry?.dispose();if(o.material){materials.add(o.material);for(const value of Object.values(o.material))if(value?.isTexture)textures.add(value);}});
      textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());root.clear();
    }
  };
  return model;
}
