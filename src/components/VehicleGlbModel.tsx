'use client';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
export function VehicleGlbModel({path,focused}:{path:string;focused:boolean}) {
  const {scene}=useGLTF(path,'/assets/vehicles/decoders/');
  const model=useMemo(()=>{
    const clone=scene.clone(true);clone.name='vehicle-gltf';
    clone.traverse(o=>{if(o instanceof Mesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;
      if((Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name.startsWith('glass.'))){o.geometry=toCreasedNormals(o.geometry,Math.PI/2);o.userData.ownsGeometry=true;}
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m instanceof MeshStandardMaterial){
          m.envMapIntensity=.85;
          if(m.name==='Paint'||m.name==='body'){m.color.set('#879baa');m.metalness=.45;m.roughness=.34;}
          if(m.name==='glass_body'){m.color.set('#102134');m.metalness=.22;m.roughness=.2;m.transparent=true;m.opacity=.88;m.depthWrite=false;}
          if(m.name==='glass_lights'||m.name==='glass_front_lights'){m.color.set('#b9cddd');m.roughness=.16;m.metalness=.1;m.transparent=true;m.opacity=.3;m.depthWrite=false;}
          if(m.name==='chrome'||m.name==='chrome_dark'||m.name==='wheels'){m.metalness=.8;m.roughness=.3;}
          if(m.name==='tires'){m.color.set('#161a20');m.roughness=.85;}
        }
        m.userData.originalOpacity=m.opacity;m.userData.originalTransparent=m.transparent;m.userData.originalDepthWrite=m.depthWrite;
      }
    }});
    // Community model length is on Z. Rotate into our X-forward vehicle coordinates.
    clone.updateMatrixWorld(true);const originalSize=new Box3().setFromObject(clone).getSize(new Vector3());
    if(originalSize.z>originalSize.x)clone.rotation.y+=Math.PI/2;
    if(path.includes('model_y'))clone.rotation.y+=Math.PI;
    clone.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(clone),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    const scale=4.7/Math.max(size.x,size.z);clone.scale.setScalar(scale);
    clone.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    return clone;
  },[scene,path]);
  useEffect(()=>{
    model.traverse(o=>{if(o instanceof Mesh) for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=focused||m.userData.originalTransparent;m.opacity=focused?.35*m.userData.originalOpacity:m.userData.originalOpacity;m.depthWrite=focused?false:m.userData.originalDepthWrite;m.needsUpdate=true;}});
  },[model,focused]);
  useEffect(()=>()=>model.traverse(o=>{if(o instanceof Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();if(o.userData.ownsGeometry)o.geometry.dispose();}}),[model]);
  return <primitive object={model} dispose={null}/>;
}
