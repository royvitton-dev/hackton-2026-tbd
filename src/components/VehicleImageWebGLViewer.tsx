'use client';
import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Box3, Mesh, PCFShadowMap, Vector3 } from 'three';
import type { Vehicle, VehicleImage } from '@/types/vehicle';
import { GarageEnvironment } from './GarageEnvironment';
import { VehicleGlbModel } from './VehicleGlbModel';
import { BatteryHotspot } from './BatteryHotspot';
import { BatteryFocusController } from './BatteryFocusController';

class ViewerBoundary extends Component<{children:ReactNode},{error:string|null}>{
  state:{error:string|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<div className="viewer-error" role="alert">3D 렌더링을 불러오지 못했습니다.<small>{this.state.error}</small><button onClick={()=>this.setState({error:null})}>다시 시도</button></div>:this.props.children;}
}
function SceneStatus({vehicleId,onReady}:{vehicleId:string;onReady:()=>void}){
  const {gl,scene,camera}=useThree();
  useEffect(()=>{let triangles=0;const model=scene.getObjectByName('vehicle-gltf');model?.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});if(model){const bounds=new Box3().setFromObject(model,true);gl.domElement.setAttribute('data-model-min-y',String(bounds.min.y));gl.domElement.setAttribute('data-model-height',String(bounds.max.y-bounds.min.y));}gl.domElement.setAttribute('data-vehicle-id',vehicleId);gl.domElement.setAttribute('data-renderer','webgl-3d-mesh');gl.domElement.setAttribute('data-model-triangles',String(triangles));onReady();},[vehicleId,gl,scene,onReady]);
  useFrame(()=>{
    const hotspot=scene.getObjectByName('battery-hotspot');
    if(hotspot){const p=hotspot.getWorldPosition(new Vector3()).project(camera);gl.domElement.setAttribute('data-hotspot-x',String((p.x+1)/2));gl.domElement.setAttribute('data-hotspot-y',String((1-p.y)/2));}
  });
  return null;
}
// Name retained for the requested component API. Vehicle photos are reference assets only.
export function VehicleImageWebGLViewer({vehicle,image,focused,onFocus}:{vehicle:Vehicle;image:VehicleImage;focused:boolean;onFocus:()=>void}){
  const [ready,setReady]=useState(false);
  const onReady=useCallback(()=>setReady(true),[]);
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReducedMotion(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  if(!image.glbPath)return <div className="viewer-error" role="status" data-testid="model-unavailable"><strong>{vehicle.model} · 3D 모델 미등록</strong><p>이 차량은 현재 3D 외형을 표시할 수 없습니다.</p><small>선택한 사용자의 차량·주행·충전 정보는 아래에서 확인할 수 있습니다.</small><button onClick={onFocus}>배터리 정보 보기</button></div>;
  return <div className={`webgl-stage ${focused?'is-focused':''}`} data-testid="vehicle-viewer">
    <ViewerBoundary key={vehicle.vehicleId}>
      <Canvas frameloop="demand" shadows={{type:PCFShadowMap}} dpr={[1,1.5]} camera={{position:[-4.2,2.6,5],fov:33,near:.1,far:70}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}
        onCreated={({gl})=>{gl.setClearColor('#050c17');gl.domElement.setAttribute('aria-label',`${vehicle.manufacturer} ${vehicle.model} 3D WebGL 차량`);}}
        fallback={<div className="viewer-error" role="alert">WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 확인하세요. 배터리 정보는 계속 볼 수 있습니다.</div>}>
        <GarageEnvironment/>
        <Suspense fallback={null}>
          <VehicleGlbModel path={image.glbPath} focused={focused}/>
          {image.glbPath&&<group>
            <RoundedBox args={[2.45,.17,1.8]} radius={.05} position={[0,.35,.1]}><meshStandardMaterial color="#00d995" emissive="#00d995" emissiveIntensity={focused?1:.5} transparent opacity={focused?.85:.4} metalness={.45} roughness={.3}/></RoundedBox>
            {Array.from({length:10},(_,i)=><mesh key={i} position={[(i-4.5)*.22,.47,0]}><boxGeometry args={[.018,.01,1.3]}/><meshBasicMaterial color="#32765a"/></mesh>)}</group>}
          <BatteryHotspot focused={focused} onSelect={onFocus} reducedMotion={reducedMotion}/>
          <SceneStatus vehicleId={vehicle.vehicleId} onReady={onReady}/>
        </Suspense>
        <BatteryFocusController focused={focused} reducedMotion={reducedMotion}/>
      </Canvas>
    </ViewerBoundary>
    <div className="scene-top"><span className="scene-badge"><i/>{ready?'LIVE 3D GARAGE':'LOADING 3D'}</span><span className="scene-number">BAY 01 / ELECTRIC</span></div>
    <div className="scene-caption"><span>대표 연식 GLB · 배터리 위치는 개략도</span><span>드래그로 시점 조절 · 스크롤로 확대</span></div>
    <button className={`hotspot-label ${focused?'active':''}`} onClick={onFocus} aria-label="배터리 hotspot 정보 열기"><span>◎</span> BATTERY PACK <span>↗</span></button>
  </div>;
}
