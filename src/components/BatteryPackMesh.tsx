'use client';
import { RoundedBox } from '@react-three/drei';

// A schematic pack inside the wheelbase, not a vehicle-specific battery CAD.
// Every surface uses the scene depth buffer so it cannot paint over the car.
export function BatteryPackMesh({focused}:{focused:boolean}){
  return <group name="battery-pack" position={[.04,.31,0]}>
    <RoundedBox name="battery-pack-body" args={[2.35,.09,1.28]} radius={.035} smoothness={2}>
      <meshStandardMaterial color="#263b44" metalness={.65} roughness={.45}/>
    </RoundedBox>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[0,.09,side*.63]}><boxGeometry args={[2.34,.16,.035]}/><meshStandardMaterial color="#446d70" metalness={.7} roughness={.35} emissive="#217b65" emissiveIntensity={focused?.45:.08}/></mesh>
      <mesh position={[side*1.15,.09,0]}><boxGeometry args={[.035,.16,1.23]}/><meshStandardMaterial color="#446d70" metalness={.7} roughness={.35}/></mesh>
    </group>)}
    {Array.from({length:12},(_,index)=><group key={index} position={[(index%6-2.5)*.36,.11,index<6?-.30:.30]}>
      <RoundedBox name={`battery-module-${index}`} args={[.32,.15,.54]} radius={.015} smoothness={1}>
        <meshStandardMaterial color="#8ca5aa" metalness={.45} roughness={.48}/>
      </RoundedBox>
      <mesh position={[0,.079,0]}><boxGeometry args={[.24,.006,.012]}/><meshStandardMaterial color="#337663" emissive="#216b55" emissiveIntensity={focused?.6:.1}/></mesh>
    </group>)}
    <mesh position={[0,.2,0]}><boxGeometry args={[2.07,.022,.038]}/><meshStandardMaterial color="#b67b46" metalness={.65} roughness={.4}/></mesh>
  </group>;
}
