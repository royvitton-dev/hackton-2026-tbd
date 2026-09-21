import {assetPath} from '../base.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let template;
export async function prepareVehicle(){
 try{
  const gltf=await new GLTFLoader().loadAsync(assetPath('/models/car-concept.glb'));template=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3());
  const scale=4.4/size.z;template.scale.setScalar(scale);template.position.y=-bounds.min.y*scale;
  template.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.geometry.userData.sharedVehicle=true;o.material.userData.persistent=true;
   // Retain the authored paint, metal, normal and baked AO. Tinted glazing avoids
   // an extra transmission render for every parked car while retaining reflections.
   if(o.material.transmission){o.material.transmission=0;o.material.transparent=true;o.material.opacity=.48;o.material.roughness=.12;o.material.depthWrite=false;}
  });
  return true;
 }catch{return false;}
}
export function detailedCar(parent,color){
 if(!template)return null;
 const root=new THREE.Group(),model=template.clone(true);root.add(model);parent.add(root);root.userData.wheels=[];root.userData.detailed=true;
 const paints=new Map();model.traverse(o=>{if(!o.isMesh)return;if(o.material.name.startsWith('Paint 1')){if(!paints.has(o.material)){const m=o.material.clone();m.color.set(color);m.roughness=.24;m.metalness=.72;m.clearcoat=1;m.userData.persistent=true;paints.set(o.material,m);}o.material=paints.get(o.material);}});
 for(const name of ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']){const wheel=model.getObjectByName(name);if(wheel)root.userData.wheels.push(wheel);}
 return root;
}
