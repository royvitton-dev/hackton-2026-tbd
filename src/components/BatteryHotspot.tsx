'use client';
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { Mesh } from 'three';
export function BatteryHotspot({focused,onSelect,reducedMotion}:{focused:boolean;onSelect:()=>void;reducedMotion:boolean}){
  const ring=useRef<Mesh>(null);const [hovered,setHovered]=useState(false);useCursor(hovered,'pointer','grab');
  useFrame(({clock,invalidate})=>{if(ring.current)ring.current.scale.setScalar(reducedMotion?1:1+Math.sin(clock.elapsedTime*2.5)*.12);if(focused&&!reducedMotion)invalidate();});
  return <group position={[0,.58,1.14]} name="battery-hotspot" onClick={e=>{e.stopPropagation();onSelect();}} onPointerOver={e=>{e.stopPropagation();setHovered(true);}} onPointerOut={()=>setHovered(false)}>
    <mesh><sphereGeometry args={[.22,16,16]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
    <mesh ref={ring}><torusGeometry args={[focused?.17:.13,.014,8,40]}/><meshBasicMaterial color="#7bffcf" depthTest={false}/></mesh>
    <mesh><sphereGeometry args={[.055,16,16]}/><meshBasicMaterial color="#bdffe7" depthTest={false}/></mesh>
    {focused&&<pointLight color="#41ffd0" intensity={3} distance={2.5}/>}
  </group>;
}
