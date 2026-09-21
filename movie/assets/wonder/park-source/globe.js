import * as THREE from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {PLANET_RADIUS,surfacePoint,surfaceDrop,themeCoordinates} from '../lib/globe.mjs';
import {group,box,cone,material,seeded,texture,staticBatch} from './materials.js';

const up=new THREE.Vector3(0,1,0);
export const CASTLE_COORDINATES=[62,35],PLAZA_COORDINATES=[26,37];
const lakes=[{coordinates:[-21,20],radius:7.5},{coordinates:[64,-27],radius:4.5}];
export function surfaceAnchor(parent,latitude,longitude){
 const anchor=group(parent);anchor.position.fromArray(surfacePoint(latitude,longitude));
 anchor.quaternion.setFromUnitVectors(up,anchor.position.clone().normalize());return anchor;
}

// Inlaid meadow regions share the planet's curvature instead of floating on discs.
export function surfacePatch(parent,radius,color,height=.025,seed=0){
 const segments=80,rings=14,positions=[],uvs=[],indices=[];
 for(let ring=0;ring<=rings;ring++)for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,r=radius*ring/rings*(1+.055*Math.sin(a*3+seed)+.04*Math.cos(a*5-seed));
  const x=Math.cos(a)*r,z=Math.sin(a)*r;positions.push(x,surfaceDrop(x,z)+height,z);uvs.push(x/(radius*2)+.5,z/(radius*2)+.5);
  if(ring<rings&&i<segments){const n=ring*(segments+1)+i;indices.push(n,n+segments+2,n+1,n,n+segments+1,n+segments+2);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const patch=new THREE.Mesh(geometry,typeof color==='string'?material(color):color);patch.receiveShadow=true;patch.name='Surface inlay';parent.add(patch);return patch;
}

export function conformToSurface(root,anchor){
 root.updateWorldMatrix(true,true);anchor.updateWorldMatrix(true,false);
 const inverse=new THREE.Matrix4().copy(anchor.matrixWorld).invert(),v=new THREE.Vector3(),tessellate=new TessellateModifier(1.15,3);
 root.traverse(object=>{
  if(!object.isMesh||object.userData.dynamic)return;
  for(let p=object.parent;p&&p!==anchor;p=p.parent)if(p.userData.dynamic)return;
  const matrix=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld),back=matrix.clone().invert(),previous=object.geometry;
  let geometry=previous.clone().applyMatrix4(matrix);geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new THREE.Vector3());
  if(Math.max(size.x,size.z)>2){const subdivided=tessellate.modify(geometry);geometry.dispose();geometry=subdivided;}
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i);v.y+=surfaceDrop(v.x,v.z);positions.setXYZ(i,v.x,v.y,v.z);}
  geometry.applyMatrix4(back);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.shared=false;object.geometry=geometry;
  if(!previous.userData.shared)previous.dispose();
 });
}

// Preserve local animations, then lower moving objects onto the curved floor.
export function surfaceMotion(root,anchor,animations){
 const moving=[];
 root.traverse(object=>{if(!object.userData.dynamic)return;for(let p=object.parent;p&&p!==anchor;p=p.parent)if(p.userData.dynamic)return;moving.push({object,position:object.position.clone()});});
 return time=>{
  for(const item of moving)item.object.position.copy(item.position);animations.forEach(animate=>animate(time));anchor.updateWorldMatrix(true,true);
  for(const item of moving){item.position.copy(item.object.position);const local=anchor.worldToLocal(item.object.getWorldPosition(new THREE.Vector3()));local.y+=surfaceDrop(local.x,local.z);item.object.position.copy(item.object.parent.worldToLocal(anchor.localToWorld(local)));}
 };
}

function pathOnPlanet(parent,from,to,width=.085){
 const a=new THREE.Vector3().fromArray(surfacePoint(...from)).normalize(),b=new THREE.Vector3().fromArray(surfacePoint(...to)).normalize(),points=[];
 for(let i=0;i<=64;i++)points.push(a.clone().lerp(b,i/64).normalize().multiplyScalar(PLANET_RADIUS+.025));
 const path=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,width,5,false),material('#f0ddb0',{roughness:.95}));path.name='Meadow footpath';path.receiveShadow=true;parent.add(path);return points;
}
function waterTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),rand=seeded(751);c.fillStyle='#82c6c1';c.fillRect(0,0,512,512);
 for(let i=0;i<2500;i++){c.strokeStyle=`rgba(230,255,225,${rand()*.35})`;c.lineWidth=.6+rand();const x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+4,y-2,x+6+rand()*10,y);c.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;return map;
}
function riverRibbon(parent,points,width,height,mat){
 const vertices=[],uv=[],indices=[];
 points.forEach((point,i)=>{const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(i-1,0)]),side=point.clone().normalize().cross(tangent).normalize().multiplyScalar(width);
  for(const sign of [-1,1]){vertices.push(...point.clone().addScaledVector(side,sign).normalize().multiplyScalar(PLANET_RADIUS+height).toArray());uv.push(sign===1?1:0,i/5);}if(i<points.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,mat);mesh.material.side=THREE.DoubleSide;mesh.name='Spherical brook ribbon';parent.add(mesh);
}

export function createGlobe(parent){
 const root=group(parent);root.name='B612 storybook planet';root.userData.dynamic=true;const animations=[];
 const grass=texture('grass'),terrainMaterial=new THREE.MeshStandardMaterial({color:'#d3df9c',map:grass,bumpMap:grass,bumpScale:.075,roughness:.95,emissive:'#607c50',emissiveIntensity:.08});
 const terrain=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS,128,96),terrainMaterial);terrain.name='Continuous spherical meadow';terrain.receiveShadow=true;terrain.userData.dynamic=true;root.add(terrain);
 const water=new THREE.MeshPhysicalMaterial({map:waterTexture(),color:'#cae9d1',roughness:.3,metalness:.12,clearcoat:.5,emissive:'#5a958f',emissiveIntensity:.12});
 for(const [index,lake] of lakes.entries()){const anchor=surfaceAnchor(root,...lake.coordinates);surfacePatch(anchor,lake.radius*1.11,'#d8d3a1',.014,index);surfacePatch(anchor,lake.radius,water,.034,index);}
 const riverPoints=[];for(let i=0;i<=80;i++)riverPoints.push(new THREE.Vector3().fromArray(surfacePoint(48-i*.75,12+Math.sin(i*.055)*10)));
 riverRibbon(root,riverPoints,.53,.014,material('#d8d3a1'));riverRibbon(root,riverPoints,.38,.034,water);
 const routes=[];for(let i=0;i<5;i++)routes.push(...pathOnPlanet(root,PLAZA_COORDINATES,themeCoordinates(i)));routes.push(...pathOnPlanet(root,PLAZA_COORDINATES,CASTLE_COORDINATES,.12));
 const rand=seeded(612),reserved=[...Array.from({length:5},(_,i)=>({point:new THREE.Vector3().fromArray(surfacePoint(...themeCoordinates(i))),radius:6.2})),{point:new THREE.Vector3().fromArray(surfacePoint(...CASTLE_COORDINATES)),radius:7.3},{point:new THREE.Vector3().fromArray(surfacePoint(...PLAZA_COORDINATES)),radius:8}],trees=[];
 for(let i=0;i<1500;i++){
  const point=new THREE.Vector3().fromArray(surfacePoint(Math.asin(rand()*2-1)*180/Math.PI,rand()*360-180));
  if(reserved.some(r=>r.point.distanceTo(point)<r.radius)||lakes.some(l=>point.distanceTo(new THREE.Vector3().fromArray(surfacePoint(...l.coordinates)))<l.radius*1.15)||riverPoints.some(p=>p.distanceTo(point)<1)||routes.some(p=>p.distanceTo(point)<.55))continue;
  trees.push({point,scale:.4+rand()*.6,color:i%13===0?'#d9a1bf':['#759d55','#a0b95e','#618c50','#8eb16e'][i%4]});
 }
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.08,.72,6),material('#877755'),trees.length),crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.65,1),material('#ffffff',{roughness:.94}),trees.length*3),dummy=new THREE.Object3D(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),color=new THREE.Color();
 trees.forEach((tree,i)=>{dummy.position.copy(tree.point);dummy.quaternion.setFromUnitVectors(up,tree.point.clone().normalize());dummy.scale.setScalar(tree.scale);dummy.updateMatrix();local.makeTranslation(0,.36,0);matrix.multiplyMatrices(dummy.matrix,local);trunks.setMatrixAt(i,matrix);
  for(let j=0;j<3;j++){local.compose(new THREE.Vector3(Math.sin(j*2.4)*.2,.8+j*.25,Math.cos(j*2.4)*.18),new THREE.Quaternion(),new THREE.Vector3(.8,1,.8));matrix.multiplyMatrices(dummy.matrix,local);crowns.setMatrixAt(i*3+j,matrix);crowns.setColorAt(i*3+j,color.set(tree.color).multiplyScalar(.9+j*.055));}});
 for(const mesh of [trunks,crowns]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.dynamic=true;root.add(mesh);}crowns.name='Planet woodland';
 for(let i=0;i<18;i++){
  const anchor=surfaceAnchor(root,i%2?45:-37,-70+i*19);anchor.scale.setScalar(.48+rand()*.2);box(anchor,1.65,1.5,1.4,['#ead2b1','#d6c5d9','#c6d6ba'][i%3],0,.75,0);
  const roof=cone(anchor,1.42,.9,['#9e829a','#789c9b','#c59b89'][i%3],0,1.93,0);roof.geometry.dispose();roof.geometry=new THREE.ConeGeometry(1.42,.9,4);roof.rotation.y=Math.PI/4;
  for(const x of [-.48,.48])box(anchor,.3,.48,.04,'#547b80',x,.94,.73);box(anchor,.3,.72,.04,'#b0967b',0,.36,.74);
  if(i%6===0){const tower=group(anchor,2.1,0,0);cone(tower,.55,2.9,'#e0d8b4',0,1.45,0);const blades=group(tower,0,2.2,.5);blades.userData.dynamic=true;for(let j=0;j<4;j++){const blade=box(blades,.18,2.5,.08,'#ac967d');blade.rotation.z=j*Math.PI/2;}animations.push(t=>blades.rotation.z=t*.2);staticBatch(blades);}
 }
 const vertices=[];for(let i=0;i<400;i++){const a=rand()*Math.PI*2,y=rand()*2-1,r=Math.sqrt(1-y*y);vertices.push(Math.cos(a)*r*145,y*145,Math.sin(a)*r*145);}
 const stars=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.PointsMaterial({color:'#ead7ff',size:.22,transparent:true,opacity:.7,sizeAttenuation:true,depthWrite:false}));stars.visible=false;stars.name='Storybook stars';root.add(stars);staticBatch(root);
 return {root,terrain,stars,animations,ready:Promise.resolve(),setNight:night=>{stars.visible=night;terrainMaterial.emissiveIntensity=night?.35:.08;water.emissiveIntensity=night?.3:.12;}};
}

export function createThemeIsland(parent,index,color){
 const coordinates=themeCoordinates(index),anchor=surfaceAnchor(parent,...coordinates);anchor.name=`Storybook theme ${index+1}`;anchor.userData.coordinates=coordinates;
 const ground=new THREE.Color('#dddbb4').lerp(new THREE.Color(color),.12),patch=surfacePatch(anchor,5.5,material(ground.getStyle(),{roughness:.96}),.035,index);patch.userData.dynamic=true;
 return anchor;
}
