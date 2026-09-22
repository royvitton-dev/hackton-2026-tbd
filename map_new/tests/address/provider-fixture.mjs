// Contract fixtures only; these do not represent a live provider connection.
export function providerFixture() {
  const listeners=new WeakMap();
  const add=(target,name,fn)=>{let map=listeners.get(target);if(!map)listeners.set(target,map={});(map[name]||=[]).push(fn);return {target,name,fn};};
  const remove=(target,name,fn)=>{const map=listeners.get(target);if(map?.[name])map[name]=map[name].filter(f=>f!==fn);};
  const emit=(target,name,value)=>(listeners.get(target)?.[name]||[]).forEach(fn=>fn(value));
  window.__providerFixture={queries:[],views:[],emit};
  class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng;}}
  class MapView {constructor(element,options){this.element=element;this.options=options;element.textContent='지도 SDK 계약 테스트';window.__providerFixture.views.push(this);}relayout(){}setCenter(point){this.center=point;}destroy(){}}
  class Marker {constructor(options){this.options=options;}setMap(){}}
  class Roadview {constructor(element){this.element=element;window.__providerFixture.views.push(this);}setPanoId(id,position){this.position=position;this.panoId=id;setTimeout(()=>emit(this,'init'),10);}getViewpoint(){return {pan:90};}relayout(){}}
  class RoadviewClient {getNearestPanoId(position,radius,callback){setTimeout(()=>callback(window.__providerFixture.noImagery?null:'test-pano'),window.__providerFixture.delay||10);}}
  class Panorama {constructor(element,options){this.options=options;window.__providerFixture.views.push(this);setTimeout(()=>emit(this,'pano_status',window.__providerFixture.noImagery?'ERROR':'OK'),10);}getPov(){return {pan:90};}setVisible(){}setSize(){}}
  const address=()=>window.__providerFixture.address||'서울특별시 중랑구 신내역로1길 145';
  window.kakao={maps:{load:fn=>fn(),LatLng,Map:MapView,Marker,Roadview,RoadviewClient,event:{addListener:add,removeListener:remove},services:{Status:{OK:'OK',ZERO_RESULT:'ZERO_RESULT'},Geocoder:class{addressSearch(query,callback){window.__providerFixture.queries.push({provider:'kakao',query});callback([{x:'127.11022',y:'37.618098',address_name:address(),road_address:{address_name:address()}}],'OK');}}}}};
  window.naver={maps:{LatLng,Map:MapView,Marker,Panorama,Size:class{constructor(w,h){this.width=w;this.height=h;}},Event:{addListener:add,removeListener:t=>remove(t.target,t.name,t.fn),trigger:emit},Service:{Status:{OK:'OK'},geocode({query},callback){window.__providerFixture.queries.push({provider:'naver',query});callback('OK',{v2:{addresses:[{x:'127.11022',y:'37.618098',roadAddress:address()}]}});}}}};
}
