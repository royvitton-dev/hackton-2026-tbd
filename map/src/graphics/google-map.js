import * as THREE from 'three';
import {buildingModel,buildingType} from './buildings.js';

export async function createGoogleMap(element,sites,onSelect,{apiKey,mapId='DEMO_MAP_ID'}={}){
 if(!apiKey){const {createAddressMap}=await import('./address-map.js');return createAddressMap(element,sites,onSelect);}
 sites=sites.map(s=>({...s,lat:s.mapLocation?.lat??s.lat,lng:s.mapLocation?.lng??s.lng})).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng));
 await new Promise((resolve,reject)=>{if(window.google?.maps)return resolve();const script=document.createElement('script');const callback='__atlasGoogleReady';const timer=setTimeout(()=>reject(new Error('Google 지도가 응답하지 않습니다. 키와 네트워크를 확인하세요.')),15000);window[callback]=()=>{clearTimeout(timer);delete window[callback];resolve();};window.gm_authFailure=()=>{clearTimeout(timer);reject(new Error('Google 지도 인증에 실패했습니다.'));};script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callback}&v=weekly&libraries=marker`;script.onerror=()=>{clearTimeout(timer);reject(new Error('Google 지도 연결에 실패했습니다.'));};document.head.append(script);});
 const map=new google.maps.Map(element,{center:{lat:37.565,lng:127.0},zoom:11.4,mapId,tilt:45,heading:12,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy'});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),overlay=new google.maps.WebGLOverlayView();let renderer;
 scene.add(new THREE.HemisphereLight(0xffffff,0x68776b,3));const sunlight=new THREE.DirectionalLight(0xfff5d9,2);sunlight.position.set(200,300,500);scene.add(sunlight);
 const models=sites.map(site=>{const root=new THREE.Group();root.matrixAutoUpdate=false;const building=buildingModel(buildingType(site));building.rotation.x=Math.PI/2;root.add(building);scene.add(root);return {site,root};});
 overlay.onContextRestored=({gl})=>{renderer=new THREE.WebGLRenderer({canvas:gl.canvas,context:gl,...gl.getContextAttributes()});renderer.autoClear=false;};
 overlay.onDraw=({transformer})=>{if(!renderer)return;const anchor={lat:37.565,lng:127.0,altitude:0};const origin=new THREE.Matrix4().fromArray(transformer.fromLatLngAltitude(anchor));camera.projectionMatrix.copy(origin);const inverse=origin.clone().invert();for(const {site,root}of models)root.matrix.multiplyMatrices(inverse,new THREE.Matrix4().fromArray(transformer.fromLatLngAltitude({lat:site.lat,lng:site.lng,altitude:0})));renderer.render(scene,camera);renderer.resetState();};
 overlay.onContextLost=()=>{renderer?.dispose();renderer=null;};overlay.onRemove=()=>{scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer?.dispose();};overlay.setMap(map);
 const markers=sites.map((site,i)=>{const button=document.createElement('button');button.className='google-pin';button.textContent=`${site.name} · ${site.address}`;button.setAttribute('aria-label',`${site.name} 3D 도면 열기`);const marker=new google.maps.marker.AdvancedMarkerElement({map,position:{lat:site.lat,lng:site.lng},title:site.name,content:button,gmpClickable:true});marker.addListener('click',()=>onSelect(site.id));return marker;});
 return {mode:'webgl',map,overlay,focus:site=>map.moveCamera({center:{lat:site.lat,lng:site.lng},zoom:18,tilt:65}),dispose:()=>{markers.forEach(m=>m.map=null);overlay.setMap(null);google.maps.event.clearInstanceListeners(map);}};
}
