import './atlas.css';
import './nearby.css';
import {geoPlaces,kindLabels,locationQuality,markerRecords,earthKML,googleMapsURL} from './geo-data.js';
import {searchPlaces,safeSource} from './location.js';
import {mountGoogle3D} from './google-maps.js';

const base=import.meta.env.BASE_URL,$=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetURL=file=>new URL(file,new URL(base,location.href)).href;
document.title='ATLAS · 주소 근처 3D 건물';document.body.dataset.workspace='atlas';
$('#app').innerHTML=`
<header class="atlas-header"><a href="${base}" class="atlas-brand">ATLAS<small>DRAWINGS<br>& PLACES</small></a><nav aria-label="작업 공간"><a href="${base}">주차장 탐색</a><a href="${base}?view=address">주소로 3D</a><a href="${base}?view=google" aria-current="page">구글 지도 · 도면</a></nav><a href="/park/">Wonder Park ↗</a></header>
<main class="atlas-layout">
 <aside class="atlas-sidebar"><p class="atlas-kicker">EVERY PLAN HAS A PLACE.</p><h1>도면이 모이고,<br><em>장소가 연결됩니다.</em></h1><p class="atlas-intro">주소 위에 모은 건축의 기록.<br>한 장소의 여러 층과 면을 함께 살펴보세요.</p><label class="atlas-search">주소 · 장소 검색<input id="atlas-search" placeholder="온음, 마포구, 신내역로…" type="search"></label><div class="atlas-count"><span id="atlas-place-count">장소 불러오는 중</span><span id="atlas-drawing-total"></span></div><div class="atlas-places" id="atlas-places"></div></aside>
 <section class="atlas-main" aria-label="지도와 추가 도면">
  <div class="atlas-toolbar"><div class="atlas-tabs"><button data-atlas-tab="map" class="active">구글 3D 지도</button><button data-atlas-tab="drawings">추가 도면</button></div><span id="atlas-visible-count"></span></div>
  <div class="atlas-map-pane" id="atlas-map-pane"><div class="atlas-google-canvas" id="atlas-google-canvas"></div><div class="atlas-map-empty" id="atlas-map-empty"><div class="atlas-orbit" aria-hidden="true"><span></span></div><p class="atlas-kicker">A COLLECTION, ON THE EARTH</p><h2>주소를 따라, 입체적으로.</h2><p>Google 3D 지도를 연결하면 수집한 장소가<br>높이 있는 마커로 표시됩니다.<br>키 없이 볼 때는 Google Earth에서 열어보세요.</p><div class="atlas-earth-actions"><button class="atlas-primary" id="atlas-kml-main">3D 마커 파일 받기 ↓</button><a class="atlas-secondary" href="https://earth.google.com/web/" target="_blank" rel="noopener noreferrer">Google Earth 열기 ↗</a></div><small>Earth의 ‘파일 → 로컬 KML 파일 열기’에서<br>받은 파일을 선택하세요. 로그인 없이 열 수 있습니다.</small></div><div class="atlas-map-tools" id="atlas-map-tools" hidden><button id="atlas-overview">전국 보기</button><button id="atlas-focus">선택한 장소</button></div></div>
  <div class="atlas-gallery-pane" id="atlas-gallery-pane" hidden><div class="atlas-gallery-heading"><div><p class="atlas-kicker">BEYOND THE FIRST THREE PLANS</p><h2 id="atlas-gallery-title">추가로 찾은 도면</h2><p id="atlas-gallery-note"></p></div><select id="atlas-kind" aria-label="도면 종류"><option value="all">모든 도면</option><option value="floor">평면도</option><option value="elevation">입면도</option><option value="section">단면도</option><option value="site">배치도</option><option value="diagram">다이어그램</option></select></div><div class="atlas-gallery-grid" id="atlas-gallery"></div></div>
  <div class="atlas-map-foot"><label><input id="atlas-areas" type="checkbox" checked> 대략적인 지역 위치 포함</label><label>마커 높이 <input id="atlas-altitude" type="range" min="10" max="200" step="10" value="60"><span id="atlas-altitude-value">60m</span></label><div class="atlas-legend"><span style="--dot:#487a60">주소·시설</span><span style="--dot:#52798e">발행처</span><span style="--dot:#b87d36">지역</span></div></div>
  <p class="atlas-status" id="atlas-status" role="status" aria-live="polite">수집 자료를 불러오고 있습니다.</p>
 </section>
 <aside class="atlas-detail"><div><p class="atlas-kicker">SELECTED PLACE</p><h2 id="atlas-name"></h2><p class="atlas-address" id="atlas-address"></p><span class="atlas-precision" id="atlas-precision"></span><p class="atlas-coordinate" id="atlas-coordinate"></p><div class="atlas-detail-links"><a id="atlas-model-link">이 건물의 3D 보기 ↗</a><a id="atlas-maps-link" target="_blank" rel="noopener noreferrer">구글 지도에서 주소 확인 ↗</a><a id="atlas-source-link" target="_blank" rel="noopener noreferrer">도면 발행처 원문 ↗</a></div><div class="atlas-mini-stats"><div><strong id="atlas-original-count">0</strong><small>기존 연결 도면</small></div><div><strong id="atlas-added-count">0</strong><small>이번에 찾은 도면</small></div></div><button class="atlas-secondary" id="atlas-all-drawings">모든 추가 도면 보기</button><h3>위치의 정확도</h3><p id="atlas-location-note"></p><p>모형은 기존 3D 정보를 축소한 표시입니다. 실제 건물 크기와 배치 방향을 뜻하지 않습니다.</p></div>
  <div><details open><summary>Google 3D 지도 연결</summary><p>Maps JavaScript API를 사용할 수 있는 브라우저 키를 입력하세요. 키는 이 탭에만 저장됩니다.</p><form id="atlas-connect"><label for="atlas-google-key">Google Maps 브라우저 키</label><input id="atlas-google-key" type="password" autocomplete="off" spellcheck="false"><button class="atlas-primary" type="submit" id="atlas-connect-button">지도 연결</button></form><a class="atlas-key-doc" href="https://developers.google.com/maps/documentation/javascript/demo-key" target="_blank" rel="noopener noreferrer">Google Demo Key 안내 ↗</a><button class="atlas-secondary" id="atlas-geocode" disabled>주소로 마커 위치 다시 찾기</button><p>입체 지형·건물의 제공 범위는 지역별로 다릅니다.</p></details><h3>Google Earth로 가져가기</h3><p>선택한 필터와 마커 높이로 KML 파일을 만듭니다. 원문 주소와 위치 정확도를 함께 담습니다. KML에는 위치 핀만 포함되며 건물 모형은 포함되지 않습니다.</p><button class="atlas-secondary" id="atlas-kml">현재 마커 KML 저장 ↓</button><a class="atlas-key-doc" href="https://developers.google.com/maps/documentation/earth/import-data#open-local-kml-files-in-google-earth" target="_blank" rel="noopener noreferrer">로컬 KML 열기 도움말 ↗</a></div>
 </aside>
</main><dialog class="atlas-drawing-dialog" id="atlas-drawing-dialog"><div class="atlas-dialog-heading"><h2 id="atlas-dialog-title"></h2><button id="atlas-dialog-close" aria-label="도면 닫기">닫기 ✕</button></div><div class="atlas-dialog-image"><img id="atlas-dialog-image" alt=""></div><div class="atlas-dialog-footer"><p id="atlas-dialog-info"></p><div><a id="atlas-dialog-original" target="_blank" rel="noopener noreferrer">원본 이미지 ↗</a><a id="atlas-dialog-source" target="_blank" rel="noopener noreferrer">발행처 원문 ↗</a></div></div></dialog>`;

$('#atlas-google-canvas').insertAdjacentHTML('beforebegin','<div class="atlas-google-canvas" id="atlas-nearby-canvas" aria-label="주소 주변 3D 마커 지도"></div><span id="atlas-map-provider" class="atlas-map-provider">OpenStreetMap · 주소 근처</span>');
$('#atlas-google-canvas').hidden=true;$('#atlas-map-empty').hidden=true;
$('[data-atlas-tab="map"]').textContent='주소 근처 3D 건물';$('.atlas-header nav [aria-current]').textContent='주소 지도 · 도면';
$('.atlas-detail details').open=false;
$('#atlas-geocode').insertAdjacentHTML('afterend','<button id="atlas-use-nearby" class="atlas-secondary" type="button" hidden>기본 주소 지도 보기</button>');
$('#atlas-coordinate').insertAdjacentHTML('afterend','<p id="atlas-model-note" class="atlas-model-note" role="status">건물 모형을 불러오고 있습니다.</p>');
const heightControl=$('#atlas-altitude').closest('label');heightControl.className='atlas-pin-altitude';heightControl.firstChild.textContent='핀 · KML 높이 ';$('#atlas-kml').before(heightControl);
$('.atlas-map-foot').insertAdjacentHTML('afterbegin','<label id="atlas-model-scale-control">모형 크기 <input id="atlas-model-scale" type="range" min="30" max="100" step="10" value="70"><span id="atlas-model-scale-value">70%</span></label>');
function modelInfo(info){
  if(controller)return;
  const note=info?.status==='ready'?(info.kind==='exterior'?'사진 기반 외관 모델 · 창·난간·재질을 그대로 축소':'도면 기반 3D 구조 · 건물의 전체 외관과는 다릅니다')+(info.textures.some(t=>t.state==='failed')?' · 일부 사진 질감 로드 실패':''):info?.status==='unavailable'?'연결된 3D 모델이 없어 위치만 표시합니다.':info?.status==='failed'?'모델을 불러오지 못해 위치만 표시합니다.':info?.status==='filtered'?'현재 지도 필터에서 제외된 장소입니다.':'건물 모형을 불러오고 있습니다.';
  if($('#atlas-model-note').textContent!==note)$('#atlas-model-note').textContent=note;
}
let places=[],drawings=[],selected,controller,nearby,nearbyPending,initialized=false,connecting=false,connectionError='',connection=0,geocoding=0,abort,tab='map',allDrawings=false;
const storage={get(){try{return sessionStorage.getItem('atlas-google-key')||'';}catch{return '';}},set(value){try{sessionStorage.setItem('atlas-google-key',value);}catch{}}};
$('#atlas-google-key').value=storage.get()||import.meta.env.VITE_GOOGLE_MAPS_API_KEY||'';
$('#atlas-kind').insertAdjacentHTML('beforeend','<option value="axonometric">입체 평면도</option>');
const status=(text,state='idle')=>{$('#atlas-status').textContent=text;$('#atlas-status').dataset.state=state;};
const options=()=>({includeAreas:$('#atlas-areas').checked,height:Number($('#atlas-altitude').value),scale:Number($('#atlas-model-scale').value)});
const filtered=()=>searchPlaces(places,$('#atlas-search').value);
function renderPlaces(){
  const rows=filtered();$('#atlas-place-count').textContent=`${rows.length}개 장소`;
  $('#atlas-places').innerHTML=rows.map(p=>`<button class="atlas-place ${p.siteId===selected?.siteId?'active':''}" data-place="${esc(p.siteId)}"><strong>${esc(p.name)}</strong><small>${esc(p.address)}</small><span>추가 도면 ${p.drawings.length}장 · ${esc(p.quality.label)}</span></button>`).join('')||'<p class="atlas-intro">일치하는 장소가 없습니다.</p>';
  $('#atlas-places').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.place));
  const count=markerRecords(rows,options()).length;$('#atlas-visible-count').textContent=`지도 마커 ${count}개`;controller?.update(rows,options());nearby?.update(rows,options());
}
function select(siteId,{focus=true}={}){
  const next=places.find(p=>p.siteId===siteId);if(!next)return;selected=next;allDrawings=false;
  $('#atlas-name').textContent=next.name;$('#atlas-address').textContent=next.address;$('#atlas-precision').textContent=next.quality.label;
  $('#atlas-coordinate').textContent=next.location?`${Number(next.location.lat).toFixed(6)}° N · ${Number(next.location.lng).toFixed(6)}° E`:'';
  $('#atlas-location-note').textContent={area:'지역이나 공원의 대표 좌표입니다. 건물 지점으로 단정할 수 없으며, 구글 지도에서 주소를 확인할 수 있습니다.',publisher:'건축물 발행처가 주소와 함께 제공한 좌표입니다. 독립적으로 확인한 측량 좌표는 아닙니다.',address:'주소 검색 또는 공개 시설 위치에 연결된 좌표입니다. 출입구의 정확한 위치를 뜻하지는 않습니다.',missing:'좌표가 확인되지 않아 지도 마커에서 제외됩니다.'}[next.quality.id];
  $('#atlas-model-link').href=base+'?view=address&site='+encodeURIComponent(next.id);$('#atlas-maps-link').href=googleMapsURL(next);
  const source=safeSource(next.source);$('#atlas-source-link').hidden=!source;if(source)$('#atlas-source-link').href=source;
  $('#atlas-original-count').textContent=next.floors.length;$('#atlas-added-count').textContent=next.drawings.length;
  renderPlaces();renderGallery();nearby?.select(siteId);if(focus)(controller||nearby)?.focus(siteId);updateURL();
}
function updateURL(){const url=new URL(location.href);if(url.searchParams.get('view')!=='markers')url.searchParams.set('view','google');if(selected)url.searchParams.set('site',selected.siteId);if(tab==='drawings')url.searchParams.set('tab','drawings');else url.searchParams.delete('tab');history.replaceState(null,'',url);}
function switchTab(value){tab=value;$('#atlas-model-note').hidden=value!=='map'||!!controller;$('#atlas-model-scale-control').hidden=value!=='map'||!!controller;$('#atlas-map-pane').hidden=value!=='map';$('#atlas-gallery-pane').hidden=value!=='drawings';document.querySelectorAll('[data-atlas-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.atlasTab===value);b.setAttribute('aria-pressed',String(b.dataset.atlasTab===value));});renderGallery();updateURL();if(value==='map'&&initialized&&!controller)showNearby();}
async function showNearby(){
  if(!nearby&&!nearbyPending){
    nearbyPending=import('./nearby-map.js').then(({mountNearbyMap})=>{
      nearby=mountNearbyMap($('#atlas-nearby-canvas'),{places:filtered(),selectedId:selected?.siteId,...options(),onSelect:id=>select(id),onModelInfo:modelInfo,onStatus:(text,state)=>{if(!controller&&!connecting)status(connectionError||text,connectionError?'error':state);}});return nearby;
    }).catch(error=>{status('주소 지도를 표시하지 못했습니다. '+error.message,'error');$('#atlas-map-empty').hidden=false;return null;}).finally(()=>{nearbyPending=null;});
  }
  if(nearbyPending)await nearbyPending;
  if(!controller&&nearby){$('#atlas-nearby-canvas').hidden=false;$('#atlas-google-canvas').hidden=true;$('#atlas-map-empty').hidden=true;$('#atlas-map-tools').hidden=false;$('#atlas-map-provider').textContent='OpenStreetMap · 3D 건물';$('#atlas-model-scale-control').hidden=tab!=='map';$('#atlas-model-note').hidden=tab!=='map';nearby.update(filtered(),options());nearby.select(selected?.siteId);nearby.resize();}
}
function renderGallery(){
  const ids=new Set(filtered().map(p=>p.siteId)),kind=$('#atlas-kind').value;
  const list=(allDrawings?drawings.filter(d=>ids.has(d.siteId)):selected?.drawings||[]).filter(d=>kind==='all'||d.kind===kind);
  $('#atlas-gallery-title').textContent=allDrawings?'추가로 찾은 모든 도면':selected?.name||'추가로 찾은 도면';
  $('#atlas-gallery-note').textContent=`${list.length}장 · 발행처 공개 원본 · 클릭하여 크게 보기`;
  $('#atlas-gallery').innerHTML=list.map(d=>`<button class="atlas-drawing" data-drawing="${esc(d.id)}"><img src="${esc(assetURL(d.thumbnail||d.file))}" alt="${esc(d.label)}" loading="lazy"><div><span class="atlas-drawing-kind">${esc(kindLabels[d.kind]||'도면')}</span><strong>${esc(d.label)}</strong><small>${allDrawings?esc(d.name)+' · ':''}${d.width} × ${d.height}</small></div></button>`).join('')||'<div class="atlas-gallery-empty">이 조건에 맞는 추가 도면이 없습니다.<br>기존 도면은 ‘이 건물의 3D 보기’에서 열 수 있습니다.</div>';
  $('#atlas-gallery').querySelectorAll('button').forEach(b=>b.onclick=()=>openDrawing(b.dataset.drawing));
}
function openDrawing(id){const d=drawings.find(d=>d.id===id);if(!d)return;$('#atlas-dialog-title').textContent=d.name+' · '+d.label;$('#atlas-dialog-image').src=assetURL(d.file);$('#atlas-dialog-image').alt=d.label;$('#atlas-dialog-info').textContent=`${d.publisher} · ${d.width} × ${d.height} · ${kindLabels[d.kind]||'도면'} · 치수 미검증 원본 참고 자료`;$('#atlas-dialog-original').href=assetURL(d.file);$('#atlas-dialog-source').href=safeSource(d.source)||'#';$('#atlas-drawing-dialog').showModal();}
async function connect(){
  const key=$('#atlas-google-key').value.trim();if(!key){status('Google 지도 연결에는 브라우저 키가 필요합니다. 기본 주소 지도는 바로 이용할 수 있습니다.','error');return;}
  const token=++connection;++geocoding;connectionError='';connecting=true;abort?.abort();controller?.dispose();controller=null;abort=new AbortController();storage.set(key);
  $('#atlas-connect-button').disabled=true;$('#atlas-geocode').disabled=true;status('Google 3D 지도를 연결하고 있습니다…','loading');
  try{const result=await mountGoogle3D($('#atlas-google-canvas'),{key,places:filtered(),...options(),signal:abort.signal,onSelect:id=>select(id,{focus:false}),onStatus:(text,state)=>{if(token===connection)status(text,state);}});
    if(token!==connection){result.dispose();return;}controller=result;$('#atlas-nearby-canvas').hidden=true;$('#atlas-google-canvas').hidden=false;$('#atlas-map-empty').hidden=true;$('#atlas-map-tools').hidden=false;$('#atlas-geocode').disabled=false;$('#atlas-use-nearby').hidden=false;$('#atlas-map-provider').textContent='Google · 3D 지도';$('#atlas-model-scale-control').hidden=true;$('#atlas-model-note').hidden=true;switchTab('map');status('Google 3D 지도 초기화됨 · 지도 영상을 불러오고 있습니다.','loading');
  }catch(error){if(token===connection&&error.name!=='AbortError'){await showNearby();connectionError=error.message+' 기본 주소 지도에서 계속 볼 수 있습니다.';$('#atlas-use-nearby').hidden=false;status(connectionError,'error');}}
  finally{if(token===connection){connecting=false;$('#atlas-connect-button').disabled=false;}}
}
function downloadKML(){const rows=filtered();const url=URL.createObjectURL(new Blob([earthKML(rows,options())],{type:'application/vnd.google-earth.kml+xml'}));const link=document.createElement('a');link.href=url;link.download='atlas-address-3d-markers.kml';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(`${markerRecords(rows,options()).length}개 3D 마커를 KML로 저장했습니다. Google Earth → 파일 → 로컬 KML 파일 열기에서 선택하세요.`);}
$('#atlas-model-scale').oninput=()=>{$('#atlas-model-scale-value').textContent=$('#atlas-model-scale').value+'%';renderPlaces();};
$('#atlas-search').oninput=()=>{renderPlaces();if(allDrawings)renderGallery();};$('#atlas-areas').onchange=renderPlaces;$('#atlas-altitude').oninput=()=>{$('#atlas-altitude-value').textContent=$('#atlas-altitude').value+'m';renderPlaces();};
document.querySelectorAll('[data-atlas-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.atlasTab));$('#atlas-kind').onchange=renderGallery;
$('#atlas-all-drawings').onclick=()=>{allDrawings=true;switchTab('drawings');};$('#atlas-connect').onsubmit=event=>{event.preventDefault();connect();};
$('#atlas-kml').onclick=downloadKML;$('#atlas-kml-main').onclick=downloadKML;$('#atlas-overview').onclick=()=> (controller||nearby)?.overview();$('#atlas-focus').onclick=()=>{if(!(controller||nearby)?.focus(selected?.siteId))status('선택한 장소는 현재 필터의 지도 마커에 포함되지 않습니다.');};
$('#atlas-use-nearby').onclick=async()=>{++connection;++geocoding;connectionError='';connecting=false;abort?.abort();controller?.dispose();controller=null;$('#atlas-geocode').disabled=true;$('#atlas-use-nearby').hidden=true;await showNearby();nearby?.focus(selected?.siteId);status('주소 주변의 3D 건물 모형을 표시했습니다.');};
$('#atlas-dialog-close').onclick=()=>$('#atlas-drawing-dialog').close();
$('#atlas-geocode').onclick=async()=>{
  if(!controller)return;const token=++geocoding,active=controller,targets=filtered();let changed=0,failed=0;$('#atlas-geocode').disabled=true;
  for(let i=0;i<targets.length;i++){
    if(token!==geocoding)break;status(`주소로 위치 확인 중 ${i+1}/${targets.length} · ${targets[i].name}`,'loading');
    try{const loc=await active.geocode(targets[i]);if(token!==geocoding)break;if(loc&&(locationQuality(loc).id!=='area'||['area','missing'].includes(targets[i].quality.id))){targets[i].location=loc;targets[i].quality=locationQuality(loc);changed++;}else failed++;}catch{failed++;}
    if(token===geocoding)renderPlaces();await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(token===geocoding){$('#atlas-geocode').disabled=false;if(selected)select(selected.siteId,{focus:false});status(`주소 검색 완료 · ${changed}곳 갱신${failed?` · ${failed}곳은 기존 위치 유지`:''}. 대략적인 결과는 지역 위치로 표시합니다.`);}
};
try{
  const responses=await Promise.all([fetch(base+'generated/catalog.json'),fetch(base+'address/drawings/catalog.json'),fetch(base+'address/locations.json')]);
  if(!responses[0].ok)throw Error('장소 목록을 읽지 못했습니다.');const catalog=await responses[0].json();
  const collection=responses[1].ok?await responses[1].json():{drawings:[]};drawings=collection.drawings;const overrides=responses[2].ok?(await responses[2].json()).places:[];
  places=geoPlaces(catalog,drawings,overrides);$('#atlas-drawing-total').textContent=`추가 ${drawings.length}장`;
  const params=new URLSearchParams(location.search),requested=params.get('site');const start=places.find(p=>p.siteId===requested||p.floors.some(f=>f.id===requested))||places.find(p=>p.siteId==='10002042')||places[0];
  select(start.siteId,{focus:false});switchTab(params.get('tab')==='drawings'?'drawings':'map');
  initialized=true;status(`${places.length}개 장소의 주소 주변에 기존 건물 모델을 축소해 표시합니다. 장소를 선택하면 확대할 수 있습니다.`);
  window.__atlasMap={get state(){return {selected:selected?.siteId,places:places.length,drawings:drawings.length,tab,markers:markerRecords(filtered(),options()).map(p=>({siteId:p.siteId,quality:p.quality.id,position:p.position})),google:controller?.snapshot()||null,nearby:nearby?.snapshot()||null};}};
  if(tab==='map'){
    await showNearby();
    if(params.get('view')==='google'&&$('#atlas-google-key').value.trim())await connect();
  }
}catch(error){status(error.message,'error');}
addEventListener('pagehide',event=>{if(event.persisted)return;++connection;++geocoding;abort?.abort();controller?.dispose();nearby?.dispose();});
