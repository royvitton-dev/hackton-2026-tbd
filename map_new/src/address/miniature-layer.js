import * as THREE from 'three';
import {MercatorCoordinate} from '../../../map/node_modules/maplibre-gl/dist/maplibre-gl.mjs';
import {facadeFor} from './facades.js';
import {createMiniature,miniatureScale} from './miniature-model.js';

export function miniatureLayer({rows,selectedId,assetBase,onChange=()=>{}}){
  const scene=new THREE.Scene(),camera=new THREE.Camera(),records=new Map(),abort=new AbortController();
  const anchor=MercatorCoordinate.fromLngLat([rows[0]?.displayPosition.lng||127,rows[0]?.displayPosition.lat||37.56]);
  const unit=anchor.meterInMercatorCoordinateUnits();
  const local=new THREE.Matrix4().makeTranslation(anchor.x,anchor.y,0).scale(new THREE.Vector3(unit,-unit,unit)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  scene.add(new THREE.HemisphereLight('#edf4ff','#a9a590',2.4));
  const sun=new THREE.DirectionalLight('#fff2d9',2.7);sun.position.set(-65,95,50);scene.add(sun);
  const fill=new THREE.DirectionalLight('#e6efff',.8);fill.position.set(45,35,-60);scene.add(fill);
  let map,renderer,disposed=false,selected=selectedId,percent=70,active=0,rendered=0;
  const repaint=()=>{if(!disposed){map?.triggerRepaint();onChange();}};
  function position(record){
    const row=rows.find(r=>r.siteId===record.id);if(!record.model)return;
    record.model.root.visible=!!row;
    if(!row)return;
    const point=MercatorCoordinate.fromLngLat([row.displayPosition.lng,row.displayPosition.lat]);
    record.model.root.position.set((point.x-anchor.x)/unit,.35,(point.y-anchor.y)/unit);
    record.displayScale=miniatureScale(record.model.size,percent);
    record.model.root.scale.setScalar(record.displayScale*point.meterInMercatorCoordinateUnits()/unit);
  }
  async function load(row){
    const record={id:row.siteId,status:'loading',files:[],model:null};records.set(row.siteId,record);active++;
    try{
      let data;
      if(!facadeFor(row)){
        for(const floor of row.floors||[row]){
          const file=floor.modelFile;if(!file)continue;
          const url=new URL(file,new URL(assetBase,location.href));
          if(url.origin!==location.origin||!url.pathname.startsWith(new URL(assetBase,location.href).pathname))throw Error('모델 경로를 확인해 주세요.');
          const response=await fetch(url,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
          if(!response.ok)throw Error('모델 파일을 읽지 못했습니다.');
          data=await response.json();record.files.push(file);
          if(data.model?.meshes?.length||data.model?.objects?.length)break;
        }
      }
      if(disposed)return;
      record.model=createMiniature(row,data,{renderer,assetBase,onChange:repaint});
      record.status=record.model?'ready':'unavailable';
      if(record.model){scene.add(record.model.root);position(record);}
    }catch(error){if(!disposed){record.status='failed';record.error=error.message;}}
    finally{active--;if(!disposed){repaint();pump();}}
  }
  function pump(){
    if(!renderer||disposed)return;
    const queue=[...rows].sort((a,b)=>Number(b.siteId===selected)-Number(a.siteId===selected));
    for(const row of queue){if(active>=3)break;if(!records.has(row.siteId))void load(row);}
  }
  function screenPoint(record){
    if(!map||!record.model)return null;
    const vertices=record.model.root.children[0]?.geometry.attributes.position;
    if(!vertices||vertices.count<3)return null;
    const p=new THREE.Vector3();for(let i=0;i<3;i++)p.add(new THREE.Vector3().fromBufferAttribute(vertices,i));
    p.divideScalar(3).applyMatrix4(record.model.root.matrixWorld).project(camera);
    return {x:(p.x+1)*map.getCanvas().clientWidth/2,y:(1-p.y)*map.getCanvas().clientHeight/2};
  }
  const layer={id:'address-building-miniatures',type:'custom',renderingMode:'3d',
    onAdd(nextMap,gl){
      map=nextMap;renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
      // Yield until MapLibre has finished attaching this layer.
      queueMicrotask(pump);
    },
    render(gl,args){
      if(disposed)return;
      camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      for(const record of records.values()){
        const row=rows.find(r=>r.siteId===record.id);
        // Let Three cull the mesh bounds. An address point can be offscreen
        // while part of its building is still visible and clickable.
        if(record.model)record.model.root.visible=!!row;
      }
      renderer.resetState();renderer.render(scene,camera);rendered=renderer.info.render.triangles;renderer.resetState();
    },
    onRemove(){if(disposed)return;disposed=true;abort.abort();records.forEach(r=>r.model?.dispose());records.clear();scene.clear();renderer?.dispose();},
    update(nextRows,{selectedId=selected,scale=percent}={}){rows=nextRows;selected=selectedId;percent=scale;records.forEach(position);pump();map?.triggerRepaint();},
    pick(point){
      if(!renderer)return null;
      const x=point.x/map.getCanvas().clientWidth*2-1,y=1-point.y/map.getCanvas().clientHeight*2;
      const near=new THREE.Vector3(x,y,-1).unproject(camera),far=new THREE.Vector3(x,y,1).unproject(camera);
      const ray=new THREE.Raycaster(near,far.sub(near).normalize());
      const roots=[...records.values()].filter(r=>r.model?.root.visible).map(r=>r.model.root);
      return ray.intersectObjects(roots,true)[0]?.object.userData.siteId||null;
    },
    snapshot(){return {scale:percent,rendered,models:rows.map(row=>{const r=records.get(row.siteId),m=r?.model;return {siteId:row.siteId,status:r?.status||'queued',kind:m?.kind||null,files:r?.files||[],sourceMeshes:m?.sourceMeshes||0,renderMeshes:m?.renderMeshes||0,features:m?.features||{},textures:m?.textures()||[],sourceSize:m?.size?.toArray(),displayScale:r?.displayScale,screenPoint:r?screenPoint(r):null};})};}
  };
  return layer;
}
