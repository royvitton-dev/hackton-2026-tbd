import {markerRecords,normalizedGoogleResult} from './geo-data.js';

let loader,loadedKey;
export function loadGoogleMaps(key) {
  if(!key) return Promise.reject(Error('Google Maps 브라우저 키를 입력해 주세요.'));
  if(loadedKey&&loadedKey!==key)return Promise.reject(Error('연결 키가 바뀌었습니다. 새로고침 후 다시 연결해 주세요.'));
  if(loader)return loader;
  loadedKey=key;
  loader=new Promise((resolve,reject)=>{
    if(window.google?.maps?.importLibrary){resolve(window.google.maps);return;}
    const script=document.createElement('script'),callback='__atlasGoogleMapsReady';
    let settled=false;
    const previousAuthFailure=window.gm_authFailure;
    const authFailure=()=>{done(Error('Google 지도 인증에 실패했습니다. 키와 허용 웹사이트 설정을 확인해 주세요.'));previousAuthFailure?.();};
    window.gm_authFailure=authFailure;
    const timer=setTimeout(()=>done(Error('Google 지도를 불러오는 시간이 초과되었습니다. 연결과 허용 도메인을 확인해 주세요.')),20000);
    const done=error=>{if(settled)return;settled=true;clearTimeout(timer);delete window[callback];if(window.gm_authFailure===authFailure)window.gm_authFailure=previousAuthFailure;if(error){script.remove();loader=null;loadedKey=null;reject(error);}else resolve(window.google.maps);};
    window[callback]=()=>done();script.onerror=()=>done(Error('Google 지도 스크립트를 읽지 못했습니다. 네트워크 연결을 확인해 주세요.'));
    script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,v:'weekly',loading:'async',callback,language:'ko',region:'KR'});
    script.async=true;document.head.append(script);
  });
  return loader;
}
export async function mountGoogle3D(container,{key,places,onSelect,onStatus,includeAreas=true,height=60,signal}) {
  const maps=await loadGoogleMaps(key);
  const [library,markerLibrary]=await withTimeout(Promise.all([maps.importLibrary('maps3d'),maps.importLibrary('marker')]),20000,'Google 3D 지도 기능을 불러오는 시간이 초과되었습니다.');
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const {Map3DElement,Marker3DInteractiveElement}=library,{PinElement}=markerLibrary;
  if(!Map3DElement||!Marker3DInteractiveElement)throw Error('이 브라우저에서 Google 3D 지도 기능을 불러오지 못했습니다.');
  let disposed=false,failed=false,markers=[],rows=[],lastSelected;
  const map=new Map3DElement({center:{lat:36.4,lng:127.4,altitude:0},range:650000,tilt:25,heading:0,mode:'HYBRID'});
  map.style.width='100%';map.style.height='100%';map.setAttribute('aria-label','수집 장소의 Google 3D 지도');
  const previousAuthFailure=window.gm_authFailure;
  const authFailure=()=>{failed=true;if(!disposed)onStatus('Google 지도 인증에 실패했습니다. 키·허용 웹사이트·Maps JavaScript API 설정을 확인해 주세요.','error');previousAuthFailure?.();};
  window.gm_authFailure=authFailure;
  const error=()=>{failed=true;if(!disposed)onStatus('Google 3D 지도 초기화에 실패했습니다. 키 설정과 브라우저의 하드웨어 가속을 확인해 주세요.','error');};
  const steady=event=>{if(!disposed&&!failed&&event.isSteady)onStatus(`Google 3D 지도 · ${rows.length}개 마커 표시`,'ready');};
  map.addEventListener('gmp-error',error);map.addEventListener('gmp-steadychange',steady);
  container.replaceChildren(map);
  function update(nextPlaces,options={}) {
    if(disposed)return;places=nextPlaces;includeAreas=options.includeAreas??includeAreas;height=options.height??height;
    markers.forEach(marker=>marker.remove());markers=[];rows=markerRecords(places,{includeAreas,height});
    for(const place of rows){
      const marker=new Marker3DInteractiveElement({position:place.position,altitudeMode:'RELATIVE_TO_GROUND',extruded:true,sizePreserved:true,drawsWhenOccluded:true,label:place.markerLabel,title:place.name+' · '+place.address+' · '+place.quality.label,collisionBehavior:'REQUIRED'});
      marker.dataset.siteId=place.siteId;
      marker.append(new PinElement({background:place.quality.color,borderColor:'#ffffff',glyphColor:'#ffffff',scale:1.1}));
      marker.addEventListener('gmp-click',()=>{focus(place.siteId);onSelect(place.siteId);});map.append(marker);markers.push(marker);
    }
    if(lastSelected&&!rows.some(p=>p.siteId===lastSelected))lastSelected=null;
  }
  function focus(siteId) {
    const place=rows.find(p=>p.siteId===siteId);if(!place||disposed)return false;lastSelected=siteId;
    const camera={center:{lat:place.position.lat,lng:place.position.lng,altitude:0},range:locationArea(place)?18000:1100,tilt:62,heading:0};
    map.flyCameraTo({endCamera:camera,durationMillis:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1200});return true;
  }
  update(places);
  const controller={update,focus,overview(){map.flyCameraTo({endCamera:{center:{lat:36.4,lng:127.4,altitude:0},range:650000,tilt:25,heading:0},durationMillis:700});},
    async geocode(place){const {Geocoder}=await maps.importLibrary('geocoding');const response=await withTimeout(new Geocoder().geocode({address:place.address,region:'KR',componentRestrictions:{country:'KR'}}),15000,'주소 검색 시간이 초과되었습니다.');return normalizedGoogleResult(response.results?.[0],place.address);},
    snapshot(){return {provider:'google',markers:rows.map(p=>({siteId:p.siteId,position:p.position,quality:p.quality.id})),selected:lastSelected};},
    dispose(){disposed=true;markers.forEach(marker=>marker.remove());map.removeEventListener('gmp-error',error);map.removeEventListener('gmp-steadychange',steady);map.stopCameraAnimation?.();map.remove();if(window.gm_authFailure===authFailure)window.gm_authFailure=previousAuthFailure;}
  };
  signal?.addEventListener('abort',()=>controller.dispose(),{once:true});return controller;
}
const locationArea=place=>place.quality.id==='area';
function withTimeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
