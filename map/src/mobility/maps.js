import {assetPath} from '../base.js';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maps.css';
import {roadGraph,roadRoute,nearestRoad,sampleRoadRoute,metres} from '../core/road-maps.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const collection=features=>({type:'FeatureCollection',features});
const feature=(type,coordinates,properties={})=>({type:'Feature',properties,geometry:{type,coordinates}});

export async function mountRoadMaps(){
 // MapLibre 6 ships its worker separately. Let Vite bundle it and its imports.
 maplibregl.setWorkerUrl(workerUrl);
 const section=document.createElement('section');section.className='road-maps-section';section.id='working-maps';
 section.innerHTML=`<div class="section-heading"><div><span class="eyebrow">20 PLACES / REAL ROAD & CHARGING DATA</span><h2>직접 움직여 보는 실제 지도 20곳.</h2></div><span class="road-local">● 도로·충전소 데이터 로컬 확보</span></div><p class="road-intro">국내 도로 형상과 등록된 충전소 위치를 연결합니다. 출발점과 충전소를 바꾸고 경로를 재생해 보세요.</p><div class="road-workbench"><aside class="road-selector"><label>지도 검색<input id="road-search" type="search" placeholder="서울, 부산, 제주…" aria-label="20개 지도 검색"></label><div id="road-map-list" aria-label="실제 지도 목록"></div></aside><div class="road-scene"><div id="working-road-map" role="region" aria-label="실제 도로와 충전소 지도"></div><div class="road-map-controls"><button id="road-fit">전체 보기</button><button id="road-tilt" aria-pressed="true">3D 건물</button></div><div class="road-map-caption"><strong id="road-map-name"></strong><span id="road-map-stats"></span></div></div><aside class="road-inspector"><span class="eyebrow">ROUTE TO CHARGING</span><label>출발 지점<select id="road-start" aria-label="도로 출발 지점"></select></label><label>목적 충전소<select id="road-destination" aria-label="목적 충전소"></select></label><p class="road-click-tip">지도 위를 누르면 가까운 도로를 출발점으로 설정합니다.</p><div id="road-route-result" role="status"></div><div class="road-playback"><button id="road-play" class="primary" disabled>경로 재생</button><select id="road-speed" aria-label="도로 재생 속도"><option value="1">1×</option><option value="4" selected>4×</option><option value="16">16×</option></select></div><div id="road-charger-detail"></div><details class="road-evidence"><summary>지도 원본과 계산 범위</summary><div id="road-evidence"></div></details><a id="road-download" download>이 지도의 원본 JSON ↓</a></aside></div><p class="road-limit">OSM 공개 기록으로 계산한 경로이며 실차 GPS 주행 기록·실시간 길안내가 아닙니다. 충전소 위치와 실제 가동 여부는 별개입니다. 도로 연결점에서 충전기까지 확인되지 않은 진입로는 안내 경로에 넣지 않습니다.</p><div id="road-load-error" role="alert" hidden></div>`;
 document.querySelector('.route-section').before(section);
 const $=s=>section.querySelector(s),response=await fetch(assetPath('/mobility/maps/index.json'));if(!response.ok)throw Error('20개 지도 목록을 읽지 못했습니다.');const data=await response.json();
 let selected,graph,path,start,charger,markers=[],generation=0,travel=0,playing=false,last=0,animation,tilt=true;
 const cache=new Map();
 const map=new maplibregl.Map({container:$('#working-road-map'),center:data.maps[0].center,zoom:15.7,pitch:38,bearing:-12,attributionControl:false,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e9eee5'}}]}});
 map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');map.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a>'}));
 const car=document.createElement('span');car.className='road-car';car.setAttribute('aria-label','경로 재생 차량');car.innerHTML='<i></i>';const carMarker=new maplibregl.Marker({element:car,rotationAlignment:'map',pitchAlignment:'map'});
 await new Promise(resolve=>map.once('load',resolve));
 map.addSource('roads',{type:'geojson',data:collection([])});map.addSource('buildings',{type:'geojson',data:collection([])});map.addSource('route',{type:'geojson',data:collection([])});
 map.addLayer({id:'road-case',type:'line',source:'roads',paint:{'line-color':'#c5cec2','line-width':['interpolate',['linear'],['zoom'],13,2,17,12]}});
 map.addLayer({id:'roads',type:'line',source:'roads',paint:{'line-color':'#fefdf8','line-width':['interpolate',['linear'],['zoom'],13,1,17,9]}});
 map.addLayer({id:'buildings',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-color':'#b9c8b3','fill-extrusion-height':['get','height'],'fill-extrusion-opacity':.82}});
 map.addLayer({id:'route-case',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':8}});
 map.addLayer({id:'route',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#287761','line-width':5}});
 function list(){const q=$('#road-search').value.trim();const items=data.maps.filter(m=>m.name.includes(q));$('#road-map-list').innerHTML=items.map((m,i)=>`<button data-road-map="${m.id}" aria-pressed="${selected?.id===m.id}"><small>${String(data.maps.indexOf(m)+1).padStart(2,'0')}</small><span><strong>${esc(m.name)}</strong><em>도로 ${m.counts.roads} · 충전소 ${m.counts.chargers}</em></span><b>↗</b></button>`).join('')||'<p>일치하는 지도가 없습니다.</p>';$('#road-map-list').querySelectorAll('[data-road-map]').forEach(b=>b.onclick=()=>load(b.dataset.roadMap));}
 function fit(){const [s,w,n,e]=selected.bbox;map.fitBounds([[w,s],[e,n]],{padding:24,duration:0,pitch:tilt?38:0,bearing:tilt?-12:0});}
 function stop(){playing=false;$('#road-play').textContent='경로 재생';}
 function route(){
  stop();travel=0;charger=selected.chargers.find(c=>c.id===$('#road-destination').value);start=Number($('#road-start').value);path=charger?.approach?roadRoute(graph,start,charger.approach.nodeId):null;
  map.getSource('route').setData(collection(path&&path.coordinates.length>1?[feature('LineString',path.coordinates)]:[]));$('#road-play').disabled=!path||path.distance===0;
  $('#road-route-result').innerHTML=path?`<strong>${Math.round(path.distance).toLocaleString()}<small> m</small></strong><span>수집 도로망 기준 계산 거리</span><p>충전소와 도로 연결점 간 ${Math.round(charger.approach.distance)}m · 마지막 진입로 미확인</p>`:'<strong>연결 경로 없음</strong><p>이 범위의 차량 통행 기록으로 연결되지 않습니다. 다른 출발점·충전소를 선택해 주세요.</p>';
  $('#road-charger-detail').innerHTML=`<h3>${esc(charger.name)}</h3><span class="road-unknown">실시간 가동 상태 미연결</span><dl><dt>운영사</dt><dd>${esc(charger.operator||'원문 미기재')}</dd><dt>동시 충전 대수</dt><dd>${charger.capacity??'원문 미기재'}</dd><dt>이용 제한</dt><dd>${esc(charger.access||'원문 미기재')}</dd><dt>운영 시간</dt><dd>${esc(charger.openingHours||'원문 미기재')}</dd><dt>유료 여부</dt><dd>${esc(charger.fee||'원문 미기재')}</dd></dl><div class="road-sockets">${charger.sockets.map(s=>`<span>${esc(s.type)} · ${s.count??'?'}구${s.output?` · ${esc(s.output)}`:''}</span>`).join('')||'<p>커넥터·출력 정보 미기재</p>'}</div><a href="${charger.sourceUrl}" target="_blank" rel="noopener">이 충전소의 OSM 원본 ↗</a>`;
  if(path)placeCar(0);else carMarker.remove();section.dataset.routeReady=String(Boolean(path));
 }
 function placeCar(distance){const point=sampleRoadRoute(path,distance);if(point)carMarker.setLngLat(point.coordinates).setRotation(point.bearing).addTo(map);}
 async function load(id){
  const version=++generation;stop();section.dataset.loading='true';$('#road-load-error').hidden=true;$('#road-play').disabled=true;
  try{
   const entry=data.maps.find(m=>m.id===id);let raw=cache.get(id);if(!raw){const r=await fetch(assetPath(entry.raw));if(!r.ok)throw Error('지도 파일을 읽지 못했습니다.');raw=await r.json();cache.set(id,raw);}if(version!==generation)return;
   selected=entry;graph=roadGraph(raw);markers.forEach(m=>m.remove());markers=[];
   const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,[n.lon,n.lat]]));
   map.getSource('roads').setData(collection(graph.ways.map(w=>feature('LineString',w.nodes.map(id=>nodes.get(id)).filter(Boolean),{name:w.tags.name||''})).filter(f=>f.geometry.coordinates.length>1)));
   map.getSource('buildings').setData(collection(raw.elements.filter(e=>e.type==='way'&&e.tags?.building).map(w=>{const p=w.nodes.map(id=>nodes.get(id)).filter(Boolean);return feature('Polygon',[p],{height:Math.min(100,parseFloat(w.tags.height)||parseFloat(w.tags['building:levels'])*3||6)});}).filter(f=>f.geometry.coordinates[0].length>3)));
   for(const c of selected.chargers){const button=document.createElement('button');button.className='road-charger-marker';button.textContent='⚡';button.setAttribute('aria-label',c.name);button.title=c.name;button.onclick=e=>{e.stopPropagation();$('#road-destination').value=c.id;route();};markers.push(new maplibregl.Marker({element:button}).setLngLat(c.coordinates).addTo(map));}
   $('#road-map-name').textContent=selected.name;$('#road-map-stats').textContent=`실제 도로 ${selected.counts.roads}개 · 충전소 ${selected.counts.chargers}곳`;
   const first=selected.defaultRoute.start,point=graph.nodes.get(first).coordinates;
   const starts=[first,...[...graph.nodes.values()].filter(n=>metres(n.coordinates,point)>250&&metres(n.coordinates,point)<900).filter((_,i)=>i%35===0).slice(0,4).map(n=>n.id)];
   $('#road-start').innerHTML=starts.map((n,i)=>`<option value="${n}">${i?'도로 출발점 '+(i+1):'검증한 기본 출발점'}</option>`).join('');
   $('#road-destination').innerHTML=selected.chargers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.approach?'':' · 도로 연결 미확인'}</option>`).join('');$('#road-destination').value=selected.defaultRoute.chargerId;
   $('#road-evidence').innerHTML=`<p>지도 기준 시각: ${esc(selected.source.osmBase)}<br>수집 시각: ${esc(selected.source.fetchedAt)}</p><p>수집된 일방통행·차량 접근·교차로 회전 제한을 적용합니다. 복잡한 경유 도로·시간 조건 제한은 보수적으로 제외합니다. 현재 공사·통제·교통량과 시설 내부 진입은 미확인입니다.</p><p>건물 바닥 형상은 원본입니다. 높이가 없으면 층수 × 3m, 둘 다 없으면 6m로 표현합니다.</p><a href="${assetPath(selected.raw.replace('.json','.source.json'))}" target="_blank" rel="noopener">수집 쿼리·SHA-256 기록 ↗</a>`;
   $('#road-download').href=assetPath(selected.raw);fit();route();list();section.dataset.mapId=id;section.dataset.loading='false';
  }catch(error){if(version!==generation)return;$('#road-load-error').hidden=false;$('#road-load-error').textContent=error.message;section.dataset.loading='false';}
 }
 map.on('click',e=>{if(!graph||section.dataset.loading==='true')return;const point=nearestRoad(graph,[e.lngLat.lng,e.lngLat.lat],120);if(!point)return;let option=$('#road-start option[data-custom]');if(!option){option=document.createElement('option');option.dataset.custom='true';$('#road-start').append(option);}option.value=point.nodeId;option.textContent='지도에서 선택한 출발점';$('#road-start').value=point.nodeId;route();});
 $('#road-start').onchange=route;$('#road-destination').onchange=route;$('#road-search').oninput=list;$('#road-fit').onclick=fit;$('#road-tilt').onclick=()=>{tilt=!tilt;$('#road-tilt').setAttribute('aria-pressed',String(tilt));map.setLayoutProperty('buildings','visibility',tilt?'visible':'none');fit();};
 $('#road-play').onclick=()=>{if(!path)return;if(travel>=path.distance)travel=0;playing=!playing;$('#road-play').textContent=playing?'일시정지':'경로 재생';};
 function animate(now){const delta=Math.min(.1,(now-last)/1000);last=now;if(playing&&path){travel=Math.min(path.distance,travel+delta*8.33*Number($('#road-speed').value));placeCar(travel);if(travel>=path.distance){playing=false;$('#road-play').textContent='도착 · 다시 재생';}}animation=requestAnimationFrame(animate);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);carMarker.remove();markers.forEach(m=>m.remove());map.remove();});
 await load(data.maps[0].id);animation=requestAnimationFrame(animate);
 window.__roadMaps={map,load,get state(){return {count:data.maps.length,selected,graph,path,playing,travel,start,charger};}};
}
