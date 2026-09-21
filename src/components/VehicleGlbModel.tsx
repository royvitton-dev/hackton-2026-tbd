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
      const smoothManufacturerSurface=(Array.isArray(o.material)?o.material:[o.material]).some(m=>(path.includes('ioniq5')&&['CyberGrey','WINDOW2','CLEARGLASS'].includes(m.name))||(path.includes('kona_electric')&&/CeramicBlue|Windows|Doors/.test(m.name)));
      if(smoothManufacturerSurface||(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name.startsWith('glass.'))){o.geometry=toCreasedNormals(o.geometry,smoothManufacturerSurface?Math.PI/6:Math.PI/2);o.userData.ownsGeometry=true;}
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m instanceof MeshStandardMaterial){
          m.envMapIntensity=.85;
          if(m.name==='Paint'||m.name==='body'){m.color.set('#879baa');m.metalness=.45;m.roughness=.34;}
          if(m.name==='glass_body'){m.color.set('#102134');m.metalness=.22;m.roughness=.2;m.transparent=true;m.opacity=.88;m.depthWrite=false;}
          if(m.name==='glass_lights'||m.name==='glass_front_lights'){m.color.set('#b9cddd');m.roughness=.16;m.metalness=.1;m.transparent=true;m.opacity=.3;m.depthWrite=false;}
          if(m.name==='chrome'||m.name==='chrome_dark'||m.name==='wheels'){m.metalness=.8;m.roughness=.3;}
          if(m.name==='tires'){m.color.set('#161a20');m.roughness=.85;}
          if(path.includes('ioniq5')){
            if(m.name==='CyberGrey'){m.color.set('#a8b7c4');m.metalness=.45;m.roughness=.3;}
            if(m.name==='WINDOW2'){m.color.set('#203240');m.metalness=.12;m.roughness=.2;m.opacity=.6;m.depthWrite=false;}
            if(m.name==='CLEARGLASS'){m.color.set('#c4d2df');m.metalness=.08;m.roughness=.18;m.depthWrite=false;}
            if(/chrome/i.test(m.name)){m.metalness=.7;m.roughness=.32;}
            if(/wheels/i.test(o.name)&&m.name==='BLACKBODY'){m.color.set('#14171a');m.roughness=.86;}
          }
          if(path.includes('kona_electric')){
            if(/CeramicBlue|Doors/.test(m.name)){m.metalness=.35;m.roughness=.32;}
            if(/Windows/.test(m.name)){m.color.set('#182c3b');m.metalness=.1;m.roughness=.18;m.depthWrite=false;}
            if(/Chrome|Rims|Mirrors/.test(m.name)){m.metalness=.7;m.roughness=.3;}
            if(/Tires/.test(m.name)){m.roughness=.9;}
          }
          if(path.includes('casper_electric')&&m.name==='E_C_GLASS_BLACK'){
            m.color.set('#20303c');m.metalness=.12;m.roughness=.18;m.transparent=true;m.opacity=.72;m.depthWrite=false;
          }
        }
        m.userData.originalOpacity=m.opacity;m.userData.originalTransparent=m.transparent;m.userData.originalDepthWrite=m.depthWrite;
        if(m instanceof MeshStandardMaterial)m.userData.originalColor=m.color.clone();
      }
    }});
    // Community model length is on Z. Rotate into our X-forward vehicle coordinates.
    clone.updateMatrixWorld(true);const originalSize=new Box3().setFromObject(clone,true).getSize(new Vector3());
    if(originalSize.z>originalSize.x)clone.rotation.y+=Math.PI/2;
    if(path.includes('model_y')||path.includes('kona_electric')||path.includes('casper_electric'))clone.rotation.y+=Math.PI;
    clone.updateMatrixWorld(true);
    // Precise bounds exclude oversized cached bounds in manufacturer component meshes.
    const bounds=new Box3().setFromObject(clone,true),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    const scale=4.7/Math.max(size.x,size.z);clone.scale.setScalar(scale);
    clone.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    return clone;
  },[scene,path]);
  useEffect(()=>{
    model.traverse(o=>{if(o instanceof Mesh) for(const m of Array.isArray(o.material)?o.material:[o.material]){
      // Keep tyres and rims grounded; ghost the body so the physical pack is
      // visible through it. The pack still obeys depth and stays inside the body.
      const wheel=/wheel|tire|tyre|rim|disk|disc/i.test(o.name+' '+m.name);
      m.transparent=focused&&!wheel?true:m.userData.originalTransparent;
      m.opacity=focused&&!wheel?Math.min(m.userData.originalOpacity,.24):m.userData.originalOpacity;
      m.depthWrite=focused&&!wheel?false:m.userData.originalDepthWrite;
      if(m instanceof MeshStandardMaterial)m.color.copy(m.userData.originalColor).multiplyScalar(focused?.86:1);
    }});
  },[model,focused]);
  useEffect(()=>()=>model.traverse(o=>{if(o instanceof Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();if(o.userData.ownsGeometry)o.geometry.dispose();}}),[model]);
  return <primitive object={model} dispose={null}/>;
}
