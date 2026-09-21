'use client';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { applyProps, useThree } from '@react-three/fiber';
import { Group, OrthographicCamera, SRGBColorSpace } from 'three';
import type { VehicleImage } from '@/types/vehicle';
import { BatteryHotspot } from './BatteryHotspot';

// A real, background-removed photograph. Its camera and orientation stay fixed;
// it is deliberately identified as a PNG presentation, not as a 3D model.
export function VehicleCutoutMesh({image,focused,reducedMotion}:{image:VehicleImage;focused:boolean;reducedMotion:boolean}){
  const sourceTexture=useTexture(image.cutoutImagePath);
  const texture=useMemo(()=>{const copy=sourceTexture.clone();copy.colorSpace=SRGBColorSpace;copy.needsUpdate=true;return copy;},[sourceTexture]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  const {camera,size,gl,invalidate}=useThree();
  const group=useRef<Group>(null);
  const bitmap=texture.image as HTMLImageElement;
  const aspect=bitmap.width/bitmap.height;
  const height=Math.min(2.65,4.8/aspect),width=height*aspect;
  // rembg adds 24px padding. Anchor the actual tyre pixels to the platform,
  // accounting for the fixed camera pitch, rather than anchoring the PNG box.
  const contactHeight=height*(.5-24/bitmap.height)*Math.cos(Math.atan2(2.25,7))-.025;
  const hotspot=image.batteryHotspot;
  const spot:[number,number,number]=[(hotspot.x-.5)*width,(.5-hotspot.y)*height,.045];
  useLayoutEffect(()=>{
    camera.position.set(0,3.5,7);
    camera.lookAt(0,1.25,0);
    if(camera instanceof OrthographicCamera){applyProps(camera,{zoom:Math.min(size.width/6.1,size.height/3.5)});camera.updateProjectionMatrix();}
    group.current?.quaternion.copy(camera.quaternion);
    gl.domElement.setAttribute('data-cutout-path',image.cutoutImagePath);
    gl.domElement.setAttribute('data-camera-controls','locked');
    invalidate();
  },[camera,gl,image.cutoutImagePath,invalidate,size.width,size.height,texture]);
  useLayoutEffect(()=>invalidate(),[focused,invalidate]);
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.025,.35]}>
      <planeGeometry args={[width*1.05,1.55]}/>
      <shaderMaterial transparent depthWrite={false}
        vertexShader={'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'}
        fragmentShader={'varying vec2 vUv; void main(){float d=length((vUv-.5)*2.);float a=pow(max(0.,1.-d),1.7)*.48;gl_FragColor=vec4(.0,.01,.025,a);}'}/>
    </mesh>
    <group ref={group} position={[0,contactHeight,0]} name="vehicle-cutout">
      <mesh><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} transparent alphaTest={.025} color={focused?'#dbe5ef':'#ffffff'} toneMapped={false}/></mesh>
      <BatteryHotspot position={spot} focused={focused} reducedMotion={reducedMotion}/>
    </group>
  </>;
}
