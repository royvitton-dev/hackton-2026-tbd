import * as THREE from 'three';
import { createCastle, createLandscape, createAttraction, staticBatch } from './assets/wonder/model/park-model.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export async function makeScene(){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(1600,900);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,16/9,.1,260);
 const hemisphere=new THREE.HemisphereLight('#bccfe9','#374559',2);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#ffddae',3.4);sun.position.set(-25,35,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:100});sun.shadow.bias=-.0002;scene.add(sun);
 const rim=new THREE.DirectionalLight('#83b8ff',2.5);rim.position.set(12,20,-30);scene.add(rim);
 const warm=new THREE.PointLight('#ffbe68',200,50,1.2);warm.position.set(0,9,8);scene.add(warm);
 const landscape=createLandscape(scene);staticBatch(landscape.root);
 const castle=createCastle(scene);castle.updateMatrixWorld(true);
 // Split the real model by construction height, preserving every source transform.
 const tiers=Array.from({length:7},()=>{const g=new THREE.Group();scene.add(g);return g;});
 const meshes=[];castle.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){const p=new THREE.Vector3();mesh.getWorldPosition(p);tiers[Math.max(0,Math.min(6,Math.floor(p.y/2.3)))].attach(mesh);}
 scene.remove(castle);tiers.forEach(staticBatch);
 const outline=new THREE.Group();scene.add(outline);
 tiers.forEach(tier=>{tier.updateMatrixWorld(true);tier.traverse(o=>{if(o.isMesh){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,24),new THREE.LineBasicMaterial({color:'#a5d7ee',transparent:true,opacity:.65}));edges.applyMatrix4(o.matrixWorld);outline.add(edges);}});});
 const catalog=await fetch('assets/wonder/park-catalog.json').then(r=>r.json());
 const positions=[[-11,.34,1.3],[10.5,.34,2.2],[-10,.34,-9.4],[-10,.34,9.8],[10,.34,10.5]];
 const attractions=catalog.attractions.slice(0,5).map((item,i)=>{const a=createAttraction(scene,item,positions[i],i);a.pick.userData.dynamic=true;staticBatch(a.root);return a;});
 const glow=[];tiers.forEach(t=>t.traverse(o=>{if(o.isMesh&&o.material?.color?.getHexString()==='355967'){o.material=o.material.clone();glow.push(o.material);}}));
 const baseY=landscape.root.position.y;
 let last=null;
 function render(t){
  if(t===last)return renderer.domElement;last=t;
  const blueprint=t>=3.5&&t<6;
  const building=t>=6&&t<13;
  const finale=t>=24.5;
  const night=t<3.5||finale;
  scene.background=null;
  sun.intensity=night?1.15:3.4;hemisphere.intensity=night?1.4:2;rim.intensity=night?3.2:1.8;warm.intensity=night?220:70;
  glow.forEach(m=>{m.emissive.set(night?'#ffac44':'#000000');m.emissiveIntensity=night?1.8:0;});
  outline.visible=blueprint;
  const land=ease((t-6)/1.4);
  landscape.root.visible=t>=6;
  landscape.root.scale.setScalar(building?Math.max(.001,land):1);landscape.root.position.y=baseY+(building?(1-land)*-4:0);
  tiers.forEach((tier,i)=>{
   const p=ease((t-7.4-i*.33)/.85);
   tier.visible=!blueprint&&(building?p>0:true);
   tier.position.y=building?(1-p)*(9+i*.4):0;
   tier.scale.setScalar(building?Math.max(.001,p):1);
  });
  attractions.forEach((a,i)=>{const p=ease((t-10.5-i*.27)/.7);a.root.visible=t>=10.5;a.root.scale.setScalar(building?Math.max(.001,p):1);a.animation.forEach(fn=>fn(t));});
  landscape.animations.forEach(fn=>fn(t));
  if(t<3.5){camera.position.set(7-t,12,43+t*2);camera.lookAt(0,6.3,-7);}
  else if(blueprint){camera.position.set(22-(t-3.5)*4,29,40);camera.lookAt(0,5,-5);}
  else if(building){const p=(t-6)/7,a=.5-p*.62;camera.position.set(Math.sin(a)*65,37-p*7,Math.cos(a)*65);camera.lookAt(0,2,-2);}
  else if(t<18.5){camera.position.set(-27+(t-13)*.7,23,38);camera.lookAt(-1,3,-3);}
  else if(finale){const p=(t-24.5)/5.5;camera.position.set(8*(1-p),20-p*5,52+p*7);camera.lookAt(0,4.4,-5);}
  else{camera.position.set(25,30,52);camera.lookAt(0,3,-4);}
  camera.updateMatrixWorld();renderer.render(scene,camera);return renderer.domElement;
 }
 render(8);await renderer.compileAsync(scene,camera);
 return {render,renderer,scene};
}
