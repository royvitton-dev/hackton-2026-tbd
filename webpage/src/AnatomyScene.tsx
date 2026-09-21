import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnatomy } from './anatomy';
import { createCellView, createHeartDetail, createKidneyDetail } from './microAnatomy';
import { layerAtDepth, type AnatomyFocus } from './clinical';
import type { MetricKey, Status } from './health';

export type BodyHandle = { reset: () => void; zoom: (direction: number) => void; rotate: () => void };
type Props = {
  selected: MetricKey; statuses: Record<MetricKey, Status>; depth: number; focus: AnatomyFocus;
  compare: boolean; autoRotate: boolean; playing: boolean; showFlow: boolean; heartRate?: number;
  onDepthChange: (depth: number) => void; onSelect: (key: MetricKey) => void;
};
function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
  object.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Points) { geometries.add(child.geometry); (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m)); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
function makeWorld() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#f5eee2', '#324b47', 1.25));
  const key = new THREE.DirectionalLight('#fff0dc', 2.25); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#a6cfc8', 2.0); rim.position.set(3, 2, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight('#acbcc0', .75); fill.position.set(3, 0, 3); scene.add(fill);
  const anatomy = createAnatomy(); scene.add(anatomy.group);
  const kidney = createKidneyDetail(); scene.add(kidney.group);
  const heart = createHeartDetail(); scene.add(heart.group);
  let cells = createCellView('liver'); scene.add(cells.group);
  let cellFocus: AnatomyFocus = 'liver';
  const organFocus = new THREE.Group(); scene.add(organFocus);
  const organClones = new Map<MetricKey, THREE.Group>();
  for (const key of ['liver', 'glucose', 'cholesterol'] as MetricKey[]) {
    const clone = anatomy.organs[key]!.clone(true);
    clone.traverse(child => { if(child instanceof THREE.Mesh) child.material = (child.material as THREE.Material).clone(); });
    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3());
    const wrapper = new THREE.Group(); clone.position.sub(center); wrapper.add(clone); wrapper.scale.setScalar(2.1 / Math.max(size.x,size.y));
    organFocus.add(wrapper); organClones.set(key, wrapper);
  }
  const ground = new THREE.Group(); scene.add(ground);
  for (const radius of [.78, .85, 1.08]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius+.009, 80),new THREE.MeshBasicMaterial({color:'#a2c9ae',transparent:true,opacity:.20,side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2; ring.position.y=-2.36; ground.add(ring);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.84,64),new THREE.MeshBasicMaterial({color:'#000000',transparent:true,opacity:.18,side:THREE.DoubleSide})); shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.37;ground.add(shadow);
  return { scene, anatomy, kidney, heart, organFocus, organClones, ground,
    get cells() { return cells; },
    setCellFocus(focus: AnatomyFocus) { const next = focus === 'body' ? 'liver' : focus; if(next === cellFocus) return; scene.remove(cells.group); disposeObject(cells.group); cells=createCellView(next); scene.add(cells.group); cellFocus=next; },
  };
}
const organColor: Record<MetricKey, string> = {bloodPressure:'#b56759',cholesterol:'#b88a75',glucose:'#d2b87c',uricAcid:'#ac7561',liver:'#b68258'};

const AnatomyScene = forwardRef<BodyHandle, Props>(function AnatomyScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const engine = useRef<{camera:THREE.PerspectiveCamera;controls:OrbitControls;reset:()=>void}|null>(null);
  const [error,setError]=useState(false); const [ready,setReady]=useState(false);
  useImperativeHandle(ref,()=>({
    reset:()=>engine.current?.reset(),
    zoom:(direction)=>latest.current.onDepthChange(THREE.MathUtils.clamp(latest.current.depth+(direction>0?.38:-.38),0,3)),
    rotate:()=>{ const e=engine.current;if(e){const offset=e.camera.position.clone().sub(e.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/8);e.camera.position.copy(e.controls.target).add(offset);e.controls.update();} },
  }),[]);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.setClearColor(0,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
    renderer.autoClear=false;container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','왼쪽 나의 기록과 오른쪽 정상 참고 인체를 같은 시점에서 비교하는 3D 해부학 모델');
    const worlds=[makeWorld(),makeWorld()];
    const camera=new THREE.PerspectiveCamera(36,1,.05,100);camera.position.set(0,.45,10.4);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.25,0);controls.enableDamping=true;controls.dampingFactor=.09;
    controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=Math.PI*.29;controls.maxPolarAngle=Math.PI*.7;controls.autoRotateSpeed=.45;controls.update();
    let width=1,height=1,needsReframe=true,lastKey='',previousTime=0,elapsed=0,frame=0,lastFrame=0,alive=true;
    const destination=new THREE.Vector3();const destinationTarget=new THREE.Vector3();let transitioning=false;
    const fitCamera=()=>{
      const state=latest.current;const layer=layerAtDepth(state.depth);const panels=state.compare?2:1;
      camera.aspect=width/panels/height;camera.updateProjectionMatrix();
      const bodyView=layer==='skin'||layer==='skeleton'||(layer==='organs'&&state.focus==='body');
      const bounds=bodyView?{w:2.55,h:5.9,y:.20}:layer==='cells'?{w:3.75,h:3.55,y:-.02}:state.focus==='uricAcid'?{w:2.25,h:3.20,y:-.08}:{w:2.8,h:3.05,y:.20};
      const stepProgress=state.depth-Math.floor(state.depth);
      const distance=Math.max(bounds.h/(2*Math.tan(Math.PI/10)),bounds.w/(2*Math.tan(Math.PI/10)*camera.aspect))*(1-.16*stepProgress);
      destination.set(0,bounds.y+.10,distance);destinationTarget.set(0,bounds.y,0);transitioning=true;needsReframe=false;
    };
    const reset=()=>{fitCamera();controls.reset();camera.position.copy(destination);controls.target.copy(destinationTarget);controls.update();transitioning=false;};
    engine.current={camera,controls,reset};
    const resize=new ResizeObserver(()=>{const rect=container.getBoundingClientRect();if(!rect.width||!rect.height)return;width=rect.width;height=rect.height;renderer.setSize(width,height);needsReframe=true;});resize.observe(container);
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let pointerStart={x:0,y:0};
    const down=(e:PointerEvent)=>{pointerStart={x:e.clientX,y:e.clientY};transitioning=false;};
    const up=(e:PointerEvent)=>{
      if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)return;
      const state=latest.current;const layer=layerAtDepth(state.depth);
      if(layer==='skin'){state.onDepthChange(1);return;}
      if(layer!=='organs'||state.focus!=='body')return;
      const rect=container.getBoundingClientRect();const localX=e.clientX-rect.left;const panelWidth=width/(state.compare?2:1);const index=state.compare&&localX>=panelWidth?1:0;
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((localX-index*panelWidth)/panelWidth*2-1,-(e.clientY-rect.top)/height*2+1),camera);
      const hit=ray.intersectObjects(worlds[index].anatomy.clickable)[0];if(hit)state.onSelect(hit.object.userData.metric);
    };
    const wheel=(e:WheelEvent)=>{if(!e.shiftKey)return;e.preventDefault();latest.current.onDepthChange(THREE.MathUtils.clamp(latest.current.depth-e.deltaY*.002,0,3));};
    const lost=(e:Event)=>{e.preventDefault();setError(true);};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});renderer.domElement.addEventListener('webglcontextlost',lost);
    const render=(now:number)=>{
      if(!alive)return;frame=requestAnimationFrame(render);if(document.hidden){previousTime=now;return;}if(now-lastFrame<33)return;lastFrame=now;
      const delta=previousTime?Math.max((now-previousTime)/1000,0):0;previousTime=now;
      const state=latest.current;const layer=layerAtDepth(state.depth);
      if(state.playing)elapsed+=delta;
      const frameKey=`${state.depth.toFixed(2)}:${state.focus}:${state.compare}`;
      if(frameKey!==lastKey){needsReframe=true;lastKey=frameKey;}
      if(needsReframe)fitCamera();
      if(transitioning){const lerp=motion.matches?1:.14;camera.position.lerp(destination,lerp);controls.target.lerp(destinationTarget,lerp);if(camera.position.distanceTo(destination)<.025)transitioning=false;}
      controls.autoRotate=state.autoRotate&&state.playing;controls.update();
      renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
      const panelCount=state.compare?2:1;const panelWidth=width/panelCount;
      for(let index=0;index<panelCount;index++){
        const world=worlds[index];const isReference=index===1;const anatomy=world.anatomy;
        const detailed=layer==='organs'&&state.focus!=='body';
        const status=isReference?'normal':state.statuses[state.focus==='body'?state.selected:state.focus];
        const abnormal=status!=='normal'&&status!=='empty';
        const bpm=isReference?72:state.heartRate??72;
        const phase=(elapsed*bpm/60)%1;
        const beat=Math.exp(-Math.pow((phase-.15)/.085,2))*.055+Math.exp(-Math.pow((phase-.34)/.105,2))*.024;
        anatomy.group.visible=layer!=='cells'&&!detailed;anatomy.surface.visible=layer==='skin';
        anatomy.skin.visible=layer==='organs';anatomy.skin.material.uniforms.opacity.value=.45;
        anatomy.wire.visible=layer==='organs';anatomy.skeleton.visible=layer==='skeleton';
        anatomy.softTissue.visible=layer==='organs';anatomy.flow.group.visible=layer==='organs'&&state.showFlow;anatomy.flow.update(elapsed,bpm);
        for(const [key,organ]of Object.entries(anatomy.organs)){
          const metric=key as MetricKey;organ!.visible=layer==='organs';
          const metricStatus=isReference?'normal':state.statuses[metric];const flagged=metricStatus!=='normal'&&metricStatus!=='empty';
          const color=flagged?(metricStatus==='urgent'?'#e2735e':'#d2a15e'):organColor[metric];
          organ!.traverse(child=>{if(child instanceof THREE.Mesh){const material=child.material as THREE.MeshStandardMaterial;material.color.set(color);material.emissive.set(flagged?'#a8762f':'#261c15');material.emissiveIntensity=flagged?.19:.06;material.opacity=1;}});
          if(metric==='bloodPressure'){const scale=1+beat;organ!.scale.setScalar(scale);organ!.position.set(.10*(1-scale),1.32*(1-scale),.22*(1-scale));}
        }
        world.kidney.group.visible=detailed&&state.focus==='uricAcid';world.heart.group.visible=detailed&&state.focus==='bloodPressure';
        world.organFocus.visible=detailed&&(state.focus==='liver'||state.focus==='glucose'||state.focus==='cholesterol');
        world.organClones.forEach((clone,key)=>{clone.visible=key===state.focus;clone.traverse(child=>{if(child instanceof THREE.Mesh){const m=child.material as THREE.MeshStandardMaterial;m.color.set(abnormal?'#d4a163':organColor[key]);m.emissive.set(abnormal?'#8c591f':'#221914');m.emissiveIntensity=.15;m.opacity=1;}});});
        world.kidney.highlight.color.set(abnormal?'#bb8658':'#a45f51');world.kidney.cortex.color.set(abnormal?'#bd985e':'#b77768');world.kidney.medulla.color.set(abnormal?'#d4b786':'#d8a398');world.heart.highlight.color.set(abnormal?'#bc7656':'#a7554c');
        world.heart.pulseGroup.scale.setScalar(1+beat);world.heart.flow.group.visible=state.showFlow;world.heart.flow.update(elapsed,bpm);
        world.kidney.flow.group.visible=state.showFlow;world.kidney.flow.update(elapsed,bpm);
        if(layer==='cells')world.setCellFocus(state.focus==='body'?state.selected:state.focus);
        world.cells.group.visible=layer==='cells';world.cells.membraneMaterial.color.set(abnormal?'#c6a577':'#9bbcab');
        world.cells.flow.group.visible=state.showFlow;world.cells.flow.update(elapsed,bpm);world.cells.update(elapsed);
        world.ground.visible=!detailed&&layer!=='cells';
        renderer.setViewport(index*panelWidth,0,panelWidth,height);renderer.setScissor(index*panelWidth,0,panelWidth,height);renderer.render(world.scene,camera);
      }
      renderer.setScissorTest(false);renderer.domElement.dataset.animationTime=elapsed.toFixed(3);
    };
    frame=requestAnimationFrame(render);setReady(true);
    return()=>{alive=false;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('webglcontextlost',lost);worlds.forEach(w=>disposeObject(w.scene));renderer.dispose();renderer.forceContextLoss();container.removeChild(renderer.domElement);engine.current=null;};
  },[]);
  return <div ref={host} className="body-canvas" data-ready={ready&&!error} data-layer={layerAtDepth(props.depth)} data-focus={props.focus} data-comparison={props.compare}>
    {error?<div className="webgl-fallback"><span>3D 화면을 표시할 수 없어요</span><p>브라우저의 하드웨어 가속을 확인해 주세요. 아래의 수치 비교와 전문 정보는 계속 이용할 수 있어요.</p></div>:!ready&&<div className="body-loading"><span className="loader"/>인체의 다음 깊이를 준비하고 있어요</div>}
  </div>;
});
export default AnatomyScene;
