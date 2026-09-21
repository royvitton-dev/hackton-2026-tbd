'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
export const CAMERA_LIMITS={minPolar:55,maxPolar:78,minAzimuth:-65,maxAzimuth:-15,minDistance:5.7,maxDistance:10.5};
export function BatteryFocusController({focused,reducedMotion}:{focused:boolean;reducedMotion:boolean}) {
  const controls=useRef<Controls>(null),animating=useRef(true);
  const {size,invalidate}=useThree();
  useEffect(()=>{animating.current=true;invalidate();},[focused,size.width,size.height,invalidate]);
  useFrame(({camera,gl,invalidate},dt)=>{
    const c=controls.current;if(!c)return;
    if(animating.current){
      const target=focused?new Vector3(0,.58,.45):new Vector3(0,.85,0);
      const mobile=size.width/size.height<1.3;
      const position=mobile?new Vector3(-5.3,3.1,6.5):focused?new Vector3(-3.9,2.5,4.5):new Vector3(-4.2,2.6,5);
      const ease=reducedMotion?1:1-Math.exp(-dt*4);
      camera.position.lerp(position,ease);c.target.lerp(target,ease);c.update();
      if(camera.position.distanceTo(position)<.015)animating.current=false;
      else invalidate();
    }
    // Observable camera state also makes real browser interaction tests deterministic.
    gl.domElement.dataset.polar=String(c.getPolarAngle()*180/Math.PI);
    gl.domElement.dataset.azimuth=String(c.getAzimuthalAngle()*180/Math.PI);
    gl.domElement.dataset.distance=String(c.getDistance());
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom enableRotate enableDamping dampingFactor={.08}
    minPolarAngle={MathUtils.degToRad(CAMERA_LIMITS.minPolar)} maxPolarAngle={MathUtils.degToRad(CAMERA_LIMITS.maxPolar)}
    minAzimuthAngle={MathUtils.degToRad(CAMERA_LIMITS.minAzimuth)} maxAzimuthAngle={MathUtils.degToRad(CAMERA_LIMITS.maxAzimuth)}
    minDistance={CAMERA_LIMITS.minDistance} maxDistance={CAMERA_LIMITS.maxDistance} onStart={()=>{animating.current=false;}}/>;
}
