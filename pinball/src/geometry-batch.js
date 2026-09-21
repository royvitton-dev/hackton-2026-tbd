import * as THREE from '../vendor/three.module.js';

// Bake static meshes into their parent's local space, grouped by material.
// Animated subtrees, instancing, transparent surfaces and multi-material decks
// retain their own geometry and transforms.
export function batchStaticMeshes(parent,animated=new Set()){
 parent.updateWorldMatrix(true,true);
 const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),oldGeometry=new Set();
 const visit=o=>{
  if(animated.has(o))return;
  if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&!o.material.transparent){
   const key=`${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
  }
  for(const child of o.children)visit(child);
 };
 for(const child of parent.children)visit(child);
 for(const meshes of groups.values()){
  if(meshes.length<2)continue;
  const pieces=meshes.map(m=>{
   const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
   return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld));
  });
  const geometry=new THREE.BufferGeometry();
  for(const name of ['position','normal','uv']){
   if(!pieces.every(g=>g.getAttribute(name)))continue;
   const size=pieces[0].getAttribute(name).itemSize;
   const values=new Float32Array(pieces.reduce((n,g)=>n+g.getAttribute(name).array.length,0));
   let offset=0;for(const g of pieces){const a=g.getAttribute(name).array;values.set(a,offset);offset+=a.length;}
   geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
  }
  geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const batch=new THREE.Mesh(geometry,meshes[0].material);batch.castShadow=meshes[0].castShadow;batch.receiveShadow=meshes[0].receiveShadow;parent.add(batch);
  for(const m of meshes){oldGeometry.add(m.geometry);m.removeFromParent();}
  pieces.forEach(g=>g.dispose());
 }
 const used=new Set();parent.traverse(o=>{if(o.geometry)used.add(o.geometry);});
 oldGeometry.forEach(g=>{if(!used.has(g))g.dispose();});
}
