'use client';
import { Environment, Lightformer, Line, RoundedBox } from '@react-three/drei';
export function GarageEnvironment(){
  return <group>
    <ambientLight intensity={.45}/><hemisphereLight args={['#c8e8ff','#0c152b',1.15]}/>
    <directionalLight position={[-3,7,5]} intensity={2.3} color="#d7e9ff" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-.0002}/>
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={4} position={[-4,5,3]} rotation={[Math.PI/4,0,0]} scale={[8,5,1]}/>
      <Lightformer intensity={3.2} position={[1,4,-4]} rotation={[Math.PI/3,0,0]} scale={[10,2,1]}/>
      <Lightformer intensity={2} position={[-5,2,-1]} rotation={[0,Math.PI/2,0]} scale={[4,3,1]}/>
      <Lightformer intensity={2} color="#9dc6ff" position={[5,3,0]} rotation={[0,-Math.PI/2,0]} scale={[5,5,1]}/>
    </Environment>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.20,0]}><planeGeometry args={[80,80]}/><meshBasicMaterial color="#050c17"/></mesh>
    <mesh position={[0,-.12,0]} receiveShadow><cylinderGeometry args={[3.05,3.12,.16,128]}/><meshStandardMaterial color="#02050b" metalness={.2} roughness={.6}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]}><torusGeometry args={[3.02,.016,12,180]}/><meshBasicMaterial color="#9bdeff" toneMapped={false}/></mesh>
    {[.05,.11,.2].map((width,i)=><mesh key={width} rotation={[-Math.PI/2,0,0]} position={[0,-.031-i*.002,0]}><ringGeometry args={[3.02-width,3.02+width,128]}/><meshBasicMaterial color="#46adff" transparent opacity={.12/(i+1)} depthWrite={false} toneMapped={false}/></mesh>)}
    <group position={[3.55,0,-3.2]}>
      <RoundedBox args={[.55,1.55,.33]} position={[0,.77,0]} radius={.07}><meshStandardMaterial color="#14273a" metalness={.65} roughness={.3}/></RoundedBox>
      <mesh position={[0,1.1,.18]}><boxGeometry args={[.36,.30,.02]}/><meshStandardMaterial color="#09131f"/></mesh>
      <mesh position={[0,1.1,.2]}><boxGeometry args={[.19,.025,.02]}/><meshBasicMaterial color="#00dda0"/></mesh>
      <Line points={[[.28,1.3,0],[.5,1,0],[.56,.4,.03],[.4,.2,.12],[.3,.4,.22],[.32,.9,.2]]} color="#25415b" lineWidth={3}/>
    </group>
    <pointLight position={[0,.5,2.8]} color="#38a9ff" intensity={4} distance={5}/>
    <fog attach="fog" args={['#050c17',10,28]}/>
  </group>;
}
