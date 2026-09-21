'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
export function BatteryHotspot({focused,reducedMotion,position=[0,.36,1.04]}:{focused:boolean;reducedMotion:boolean;position?:[number,number,number]}){
  const ring=useRef<Mesh>(null);
  useFrame(({clock,invalidate})=>{if(ring.current)ring.current.scale.setScalar(reducedMotion?1:1+Math.sin(clock.elapsedTime*2.5)*.12);if(focused&&!reducedMotion)invalidate();});
  return <group position={position} name="battery-hotspot">
    <mesh ref={ring} renderOrder={10}><torusGeometry args={[focused?.17:.13,.014,8,40]}/><meshBasicMaterial color="#7bffcf" transparent depthTest={false} depthWrite={false}/></mesh>
    <mesh renderOrder={10}><sphereGeometry args={[.055,16,16]}/><meshBasicMaterial color="#bdffe7" transparent depthTest={false} depthWrite={false}/></mesh>
    {focused&&<pointLight color="#41ffd0" intensity={.6} distance={1.6}/>}
  </group>;
}
