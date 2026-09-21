'use client';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
export function VehicleGlbModel({path,focused}:{path:string;focused:boolean}) {
  const {scene}=useGLTF(path,'/assets/vehicles/decoders/');
  const model=useMemo(()=>{
    const clone=scene.clone(true);clone.name='vehicle-gltf';
    clone.traverse(o=>{if(o instanceof Mesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.originalOpacity=m.opacity;m.userData.originalTransparent=m.transparent;m.userData.originalDepthWrite=m.depthWrite;if(m instanceof MeshStandardMaterial){m.envMapIntensity=.85;if(m.name==='Paint'||m.name==='body'){m.color.set('#879baa');m.metalness=.45;m.roughness=.34;}}}
    }});
    // Community model length is on Z. Rotate into our X-forward vehicle coordinates.
    clone.updateMatrixWorld(true);const originalSize=new Box3().setFromObject(clone).getSize(new Vector3());
    if(originalSize.z>originalSize.x)clone.rotation.y+=Math.PI/2;clone.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(clone),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    const scale=4.7/Math.max(size.x,size.z);clone.scale.setScalar(scale);
    clone.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    return clone;
  },[scene]);
  useEffect(()=>{
    model.traverse(o=>{if(o instanceof Mesh) for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=focused||m.userData.originalTransparent;m.opacity=focused?.35*m.userData.originalOpacity:m.userData.originalOpacity;m.depthWrite=focused?false:m.userData.originalDepthWrite;m.needsUpdate=true;}});
  },[model,focused]);
  useEffect(()=>()=>model.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}),[model]);
  return <primitive object={model} dispose={null}/>;
}
