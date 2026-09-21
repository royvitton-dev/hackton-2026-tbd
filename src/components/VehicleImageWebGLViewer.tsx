'use client';
import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box3, Mesh, PCFShadowMap, Vector3 } from 'three';
import type { Vehicle, VehicleImage } from '@/types/vehicle';
import { GarageEnvironment } from './GarageEnvironment';
import { VehicleGlbModel } from './VehicleGlbModel';
import { BatteryHotspot } from './BatteryHotspot';
import { BatteryFocusController } from './BatteryFocusController';
import { BatteryPackMesh } from './BatteryPackMesh';

class ViewerBoundary extends Component<{children:ReactNode},{error:string|null}>{
  state:{error:string|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<div className="viewer-error" role="alert">3D 렌더링을 불러오지 못했습니다.<small>{this.state.error}</small><button onClick={()=>this.setState({error:null})}>다시 시도</button></div>:this.props.children;}
}
function SceneStatus({vehicleId,isGlb,focused,onReady}:{vehicleId:string;isGlb:boolean;focused:boolean;onReady:()=>void}){
  const {gl,scene,camera}=useThree();
  useEffect(()=>{
    const model=scene.getObjectByName('vehicle-gltf'),pack=scene.getObjectByName('battery-pack');
    let faded=0,depthTested=true;
    model?.traverse(object=>{if(object instanceof Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.opacity<material.userData.originalOpacity-.001)faded++;});
    pack?.traverse(object=>{if(object instanceof Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(!material.depthTest)depthTested=false;});
    gl.domElement.setAttribute('data-faded-vehicle-materials',String(faded));
    gl.domElement.setAttribute('data-charger-visible',String(!!scene.getObjectByName('ev-charger')));
    if(model&&pack){
      gl.domElement.setAttribute('data-pack-inside-vehicle',String(new Box3().setFromObject(model,true).containsBox(new Box3().setFromObject(pack,true))));
      gl.domElement.setAttribute('data-pack-depth-tested',String(depthTested));
    }
  },[focused,vehicleId,gl,scene]);
  useEffect(()=>{let triangles=0;const model=scene.getObjectByName('vehicle-gltf');model?.traverse(o=>{if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});if(model){const bounds=new Box3().setFromObject(model,true);gl.domElement.setAttribute('data-model-min-y',String(bounds.min.y));gl.domElement.setAttribute('data-model-height',String(bounds.max.y-bounds.min.y));}gl.domElement.setAttribute('data-vehicle-id',vehicleId);gl.domElement.setAttribute('data-renderer',isGlb?'webgl-3d-mesh':'webgl-cutout');gl.domElement.setAttribute('data-model-triangles',String(triangles));onReady();},[vehicleId,isGlb,gl,scene,onReady]);
  useFrame(()=>{
    gl.domElement.setAttribute('data-camera-quaternion',camera.quaternion.toArray().join(','));
    const hotspot=scene.getObjectByName('battery-hotspot');
    if(hotspot){const p=hotspot.getWorldPosition(new Vector3()).project(camera);gl.domElement.setAttribute('data-hotspot-x',String((p.x+1)/2));gl.domElement.setAttribute('data-hotspot-y',String((1-p.y)/2));}
    const pack=scene.getObjectByName('battery-pack-body');
    if(pack){const p=pack.getWorldPosition(new Vector3()).project(camera);gl.domElement.setAttribute('data-pack-x',String((p.x+1)/2));gl.domElement.setAttribute('data-pack-y',String((1-p.y)/2));}
  });
  return null;
}
// Vehicle interaction always uses the GLB; source photographs stay in provenance.
export function VehicleImageWebGLViewer({vehicle,image,focused,onFocus}:{vehicle:Vehicle;image:VehicleImage;focused:boolean;onFocus:()=>void}){
  const [ready,setReady]=useState(false);
  const authored=Boolean(image.glbPath?.includes('_authored.glb'));
  const onReady=useCallback(()=>setReady(true),[]);
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReducedMotion(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  if(!image.glbPath)return <div className="viewer-error" role="status" data-testid="model-unavailable"><strong>{vehicle.model} · 3D 모델 준비 중</strong><p>차량 외형 모델을 아직 준비하지 못했습니다. 배터리 정보는 확인할 수 있습니다.</p><button onClick={onFocus}>배터리 정보 보기</button></div>;
  return <div className={`webgl-stage ${focused?'is-focused':''}`} data-testid="vehicle-viewer">
    <ViewerBoundary key={vehicle.vehicleId}>
      <Canvas frameloop="demand" shadows={{type:PCFShadowMap}} dpr={[1,1.5]} camera={{position:[-4.2,2.6,5],fov:33,near:.1,far:70}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}
        onCreated={({gl})=>{gl.setClearColor('#050c17');gl.domElement.setAttribute('aria-label',`${vehicle.manufacturer} ${vehicle.model} WebGL 3D 차량`);gl.domElement.dataset.modelKind=authored?'authored-approximation':'source-model';}}
        fallback={<div className="viewer-error" role="alert">WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 확인하세요. 배터리 정보는 계속 볼 수 있습니다.</div>}>
        <GarageEnvironment/>
        <Suspense fallback={null}>
          <VehicleGlbModel path={image.glbPath} focused={focused}/>
          <BatteryPackMesh focused={focused}/>
          <BatteryHotspot focused={focused} reducedMotion={reducedMotion}/>
          <SceneStatus vehicleId={vehicle.vehicleId} isGlb focused={focused} onReady={onReady}/>
        </Suspense>
        <BatteryFocusController focused={focused} reducedMotion={reducedMotion}/>
      </Canvas>
    </ViewerBoundary>
    <div className="scene-top"><span className="scene-badge"><i/>{ready?(focused?'배터리 투시 보기':'3D 차량 · 드래그로 시점 조절'):'차량 불러오는 중'}</span></div>
    <div className="scene-caption"><span>{image.modelDisplayNote??'대표 연식 3D 모델'} · 배터리는 개략도</span><span>드래그로 시점 조절 · 스크롤로 확대</span></div>
    <button className={`hotspot-label ${focused?'active':''}`} onClick={onFocus} aria-label="배터리 위치 보기" aria-pressed={focused} aria-expanded={focused} aria-controls="battery-info-panel"><span aria-hidden="true">{focused?'↶':'◎'}</span> {focused?'차량 외형 보기':image.glbPath?'배터리 투시 보기':'배터리 정보 보기'}</button>
  </div>;
}
