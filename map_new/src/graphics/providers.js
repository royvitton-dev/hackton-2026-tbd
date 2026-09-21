import * as THREE from 'three';
import {buildingModel} from './scene.js';
function sdk(src,ready,callback){
  return new Promise((resolve,reject)=>{
    if(ready())return resolve();const script=document.createElement('script');let timer;
    const done=error=>{clearTimeout(timer);if(callback)delete window[callback];error?reject(error):resolve();};
    if(callback)window[callback]=()=>done();else script.onload=()=>done();
    timer=setTimeout(()=>{script.remove();done(Error('지도 응답 시간이 초과되었습니다.'));},15000);
    script.onerror=()=>{script.remove();done(Error('지도 연결에 실패했습니다.'));};script.src=src;document.head.append(script);
  });
}
export async function googleMap(element,sites,onSelect,{key,mapId='DEMO_MAP_ID'}={}){
  if(!key)return {status:'missing-key'};
  await sdk(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__parkingGoogleReady&v=weekly&libraries=marker`,()=>!!window.google?.maps,'__parkingGoogleReady');
  const google=window.google,located=sites.filter(s=>s.location).filter((s,i,a)=>a.findIndex(x=>x.siteId===s.siteId)===i);
  const map=new google.maps.Map(element,{mapId,center:{lat:37.56,lng:127.04},zoom:11,tilt:45,heading:10,gestureHandling:'cooperative'}),overlay=new google.maps.WebGLOverlayView(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  scene.add(new THREE.HemisphereLight(0xffffff,0x648575,3));let renderer;
  const models=located.map(site=>{const root=new THREE.Group();root.matrixAutoUpdate=false;const model=buildingModel(site);model.rotation.x=Math.PI/2;root.add(model);scene.add(root);return {root,site};});
  overlay.onContextRestored=({gl})=>{renderer=new THREE.WebGLRenderer({canvas:gl.canvas,context:gl,...gl.getContextAttributes()});renderer.autoClear=false;};
  overlay.onDraw=({transformer})=>{if(!renderer)return;const origin=new THREE.Matrix4().fromArray(transformer.fromLatLngAltitude({lat:37.56,lng:127.04,altitude:0}));camera.projectionMatrix.copy(origin);const inverse=origin.clone().invert();for(const {root,site} of models)root.matrix.multiplyMatrices(inverse,new THREE.Matrix4().fromArray(transformer.fromLatLngAltitude({...site.location,altitude:0})));renderer.render(scene,camera);renderer.resetState();};
  overlay.onContextLost=()=>{renderer?.dispose();renderer=null;};
  overlay.onRemove=()=>{scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer?.dispose();};overlay.setMap(map);
  const markers=located.map(site=>{const button=document.createElement('button');button.className='map-pin';button.textContent=site.name;button.onclick=()=>onSelect(site.id);return new google.maps.marker.AdvancedMarkerElement({map,position:{lat:site.location.lat,lng:site.location.lng},content:button,title:site.name});});
  return {status:'connected',map,models,dispose(){markers.forEach(m=>m.map=null);overlay.setMap(null);google.maps.event.clearInstanceListeners(map);}};
}
export async function kakaoPhoto(element,site,key){
  if(!key)return {status:'missing-key'};
  if(!site.location)return {status:'missing-location'};
  await sdk(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`,()=>!!window.kakao?.maps);
  await new Promise(resolve=>window.kakao.maps.load(resolve));
  const maps=window.kakao.maps,location=new maps.LatLng(site.location.lat,site.location.lng),client=new maps.RoadviewClient();
  const panoId=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('로드뷰 조회 시간이 초과되었습니다.')),10000);client.getNearestPanoId(location,50,id=>{clearTimeout(timer);resolve(id);});});
  if(!panoId)return {status:'no-imagery'};
  const view=new maps.Roadview(element);view.setPanoId(panoId,location);
  return {status:'connected',panoId,view};
}
