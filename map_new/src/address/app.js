import './style.css';
import './facade.css';
import './web-sources.css';
import {AddressScene} from './scene.js';
import {parseMapInput,uniquePlaces,searchPlaces,metersBetween,preciseLocation,mapLinks,imagePixel,safeSource} from './location.js';
import {modelDescription} from './model.js';
import {facadeFor,isExteriorPhoto} from './facades.js';
import {geocode,referenceView} from './providers.js';
import {mountWebSources} from './web-sources.js';

const base=import.meta.env.BASE_URL, $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.title='ATLAS · 주소로 만나는 3D'; document.body.dataset.workspace='address';
$('#app').innerHTML=`
<header class="address-header"><a class="address-brand" href="${base}"><span>⌁</span> ATLAS <small>PLACE<br>STUDIO</small></a><nav aria-label="작업 공간"><a href="${base}">주차장 탐색</a><a href="${base}?view=address" aria-current="page">주소로 3D</a></nav><a class="address-park" href="/park/">Wonder Park ↗</a></header>
<main class="address-layout">
 <aside class="address-sidebar">
  <p class="address-kicker">AN ADDRESS. A NEW PERSPECTIVE.</p><h1>주소에서 시작하는<br><em>입체적인 발견.</em></h1><p class="address-intro">수집한 도면과 그곳의 사진을 연결해<br>건물의 다음 장면을 살펴보세요.</p>
  <form id="address-search"><label for="address-query">주소 · 건물 이름 · 지도 링크</label><textarea id="address-query" rows="2" placeholder="서울 중랑구 신내역로1길 145" maxlength="1000"></textarea><div class="address-search-row"><select id="address-provider" aria-label="주소 검색 서비스"><option value="collection">수집 자료에서</option><option value="naver">네이버 주소 검색</option><option value="kakao">카카오 주소 검색</option></select><button class="address-primary" type="submit">위치 찾기</button></div></form>
  <p id="address-status" role="status" aria-live="polite">수집 자료를 불러오고 있습니다.</p><div id="address-results" aria-label="주소 검색 결과"></div>
  <details class="address-library" open><summary>수집한 장소 <span id="address-count"></span></summary><div id="address-places"></div></details>
  <details class="address-connection"><summary>네이버 · 카카오 연결 설정</summary><p>실시간 주소 검색·지도·거리뷰에 사용하는 브라우저 키입니다. 저장된 도면과 공개 사진은 키 없이 볼 수 있습니다.</p><label>NAVER Maps Key ID<input id="address-naver-key" type="password" autocomplete="off" spellcheck="false"></label><label>Kakao JavaScript 키<input id="address-kakao-key" type="password" autocomplete="off" spellcheck="false"></label><button id="address-save-keys" type="button">이 탭에 설정 저장</button><small>REST API 키·Secret은 입력하지 마세요. 사용 중인 웹 주소를 지도 서비스의 허용 도메인에 등록해 주세요.</small></details>
 </aside>
 <section class="address-stage" aria-label="주소 연결 3D 모델"><canvas id="address-world" aria-label="건물 3D 모델 · 드래그 회전, 스크롤 확대"></canvas>
  <div class="address-stage-heading"><p class="address-kicker">FROM PLACE TO SPACE</p><h2 id="address-title">도면을 연결하고 있습니다</h2><p id="address-location"></p><span class="address-badge" id="address-model-note"></span></div>
  <div class="address-view-switch" role="group" aria-label="3D 표현"><button data-model-view="exterior" class="active">외관 미리보기</button><button data-model-view="drawing">도면 3D</button></div>
  <div class="address-compass" aria-label="북쪽">N<span>↑</span></div>
  <div class="address-stage-controls"><button id="address-home" title="처음 시점으로">전체 보기</button><button id="address-top">위에서 보기</button><label><input type="checkbox" id="address-rotate"> 천천히 회전</label></div>
  <div class="address-stage-footer"><span><i></i> LIVE 3D</span><span id="address-model-stats"></span><span>드래그하여 공간 둘러보기</span></div>
 </section>
 <aside class="address-inspector">
  <p class="address-kicker">THE PLACE, IN CONTEXT</p><h2>사진과 거리에서<br>발견한 단서들.</h2>
  <div class="address-reference-tabs" role="group" aria-label="사진과 지도"><button data-reference="photo" class="active">공개 사진</button><button data-reference="web">인터넷 자료 찾기</button><button data-reference="naver-map">네이버 지도</button><button data-reference="naver-road">네이버 거리뷰</button><button data-reference="kakao-map">카카오 지도</button><button data-reference="kakao-road">카카오 로드뷰</button></div>
  <div id="address-photo-box"><img id="address-photo" alt="선택한 건물의 공개 외관 사진" hidden><div id="address-photo-empty">이 장소의 외관 사진은 아직 연결되지 않았습니다.</div></div>
  <div id="address-reference" hidden></div><p id="address-reference-status" role="status"></p><div id="address-photo-choices"></div>
  <p id="address-photo-credit"></p><p id="address-sample-help" class="address-photo-help" hidden>사진의 외벽을 누르면 그 색을 3D 모델에 반영합니다.</p>
  <label class="address-sync"><input type="checkbox" id="address-sync" checked> 거리뷰 시선과 3D 시점 연결</label>
  <div class="address-links"><a id="address-naver-link" target="_blank" rel="noopener noreferrer">네이버에서 보기 ↗</a><a id="address-kakao-link" target="_blank" rel="noopener noreferrer">카카오에서 보기 ↗</a><a id="address-road-link" target="_blank" rel="noopener noreferrer">로드뷰 바로가기 ↗</a></div>
  <section class="address-model-settings"><div class="address-section-heading"><h3>모델에 반영하기</h3><span>FACADE STUDY</span></div><label>연결한 도면<select id="address-floor" aria-label="연결한 도면"></select></label><div id="address-exterior-settings"><div id="address-material-tools"><label><input type="checkbox" id="address-photo-texture" checked> 원본 사진 질감</label><button id="address-reset" type="button">사진 기준 복원</button></div><p id="address-material-note" role="status"></p><div class="address-setting-row"><label>가정 층수<input type="number" id="address-floors" min="1" max="20" step="1"></label><label>층 높이 (m)<input type="number" id="address-height" min="2" max="5" step="0.1"></label><label>외벽 색 실험<input type="color" id="address-color" value="#d8d8ca"></label></div><p id="address-height-note"></p></div><p id="address-facade-features"></p><p class="address-disclosure">사진이 있는 건물은 벽면 질감·창·난간·옥상 형태를 참고해 재구성합니다. 치수와 보이지 않는 면은 추정이며 사진측량 결과가 아닙니다.</p></section>
  <details class="address-evidence"><summary>위치와 모델의 출처</summary><div id="address-evidence"></div></details>
  <div class="address-bottom-actions"><a id="address-plan-link" class="address-primary">주차 도면 열기 ↗</a><button id="address-export">모델 정보 저장 ↓</button></div>
 </aside>
</main>`;
$('#address-search').insertAdjacentHTML('afterend','<button id="address-find-web" type="button">지도 웹사이트 · 인터넷 사진 검색 ↗</button>');
const atlasLink=document.createElement('a');atlasLink.id='address-atlas-link';atlasLink.textContent='주소 지도 · 추가 도면';atlasLink.href=base+'?view=google';$('.address-header nav').append(atlasLink);
$('.address-model-settings').insertAdjacentHTML('afterbegin','<a id="address-extra-drawings" class="address-extra-drawings">추가로 찾은 도면 보기 ↗</a>');

let scene, catalog=[], places=[], evidence=[], site, data, settings={}, photos=[], photo, selection=0, searching=0, referenceVersion=0, reference, referenceAbort;
let referenceMode='photo';
const resolvedLocations=new Map();
const addedReferences=new Map();
const status=text=>{$('#address-status').textContent=text;};
const storage={get(key){try{return sessionStorage.getItem('atlas-address-'+key)||'';}catch{return '';}},set(key,value){try{sessionStorage.setItem('atlas-address-'+key,value);}catch{}}};
$('#address-naver-key').value=storage.get('naver')||import.meta.env.VITE_NAVER_MAPS_KEY_ID||'';
$('#address-kakao-key').value=storage.get('kakao')||import.meta.env.VITE_KAKAO_MAPS_APP_KEY||'';
const key=provider=>$('#address-'+provider+'-key').value.trim();
$('#address-save-keys').onclick=()=>{for(const p of ['naver','kakao'])storage.set(p,key(p));status('이 탭에 지도 연결 설정을 저장했습니다. 이미 연결한 키를 바꿨다면 새로고침해 주세요.');};

function renderPlaces(list=places) {
  $('#address-count').textContent=`${list.length}곳`;
  $('#address-places').innerHTML=list.map(p=>`<button class="address-place ${p.siteId===site?.siteId?'active':''}" data-address-site="${esc(p.id)}"><span>${esc(p.name.replace(/ · 도면 \d+$/, ''))}</span><small>${esc(p.address)}</small><em>${p.floors.length}개 도면${evidence.find(e=>e.siteId===p.siteId)?.photos.length?' · 외관 사진':''}</em></button>`).join('') || '<p>일치하는 수집 자료가 없습니다.</p>';
  $('#address-places').querySelectorAll('button').forEach(button=>button.onclick=()=>selectSite(button.dataset.addressSite));
}
function renderModel() {
  const profile=scene.show(site,data,settings,base);
  $('#address-model-note').textContent=modelDescription(profile,scene.view);
  if($('#address-evidence-shape'))$('#address-evidence-shape').textContent=modelDescription(profile,scene.view);
  $('#address-floors').value=profile.floors;$('#address-height').value=profile.floorHeight;$('#address-color').value=profile.color;
  $('#address-height-note').textContent=`${profile.floorEvidence} · 모델 높이 ${profile.height.toFixed(1)}m`;
  $('#address-material-tools').hidden=!profile.facadeType;$('#address-photo-texture').checked=profile.photoTexture;
  $('#address-material-note').textContent=profile.photoTexture?'사진의 벽면 질감을 불러오고 있습니다.':profile.facadeType?'재질의 기본 색으로 비교 중입니다.':'';
  $('#address-facade-features').textContent=profile.features?.join(' · ')||'';
  $('#address-exterior-settings').hidden=scene.view==='drawing';
  $('#address-model-stats').textContent=scene.view==='drawing'?`${data?.model?.meshes?.length||0}개 구조 메시`:`${profile.floors}개 층 · ${profile.facadeType?'사진 기반 외관':'외관 미리보기'}`;
  document.querySelectorAll('[data-model-view]').forEach(b=>{b.classList.toggle('active',b.dataset.modelView===scene.view);b.setAttribute('aria-pressed',String(b.dataset.modelView===scene.view));});
  $('[data-model-view="drawing"]').disabled=!data;
}
function setPhoto(next) {
  photo=next;
  const image=$('#address-photo');image.hidden=!photo;$('#address-photo-empty').hidden=!!photo;
  $('#address-photo-empty').textContent='이 장소의 외관 사진은 아직 연결되지 않았습니다.';
  $('#address-sample-help').hidden=!photo;
  if(photo){image.src=new URL(photo.file,new URL(base,location.href)).href;image.alt=photo.alt||site.name+' 외관';}
  else image.removeAttribute('src');
  const source=safeSource(photo?.source);
  $('#address-photo-credit').innerHTML=photo?`${esc(photo.publisher||'공개 원문')} · ${esc(photo.alt||'외관 사진')} ${source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">출처 ↗</a>`:''}`:'원본 도면은 연결한 도면의 3D 보기에서 확인할 수 있습니다.';
  $('#address-photo-choices').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',photos[i]===photo));
}
function renderPhotoChoices() {
  $('#address-photo-choices').innerHTML=photos.map((p,i)=>`<button data-photo-index="${i}">${p.local?'참고':'사진'} ${i+1}</button>`).join('');
  $('#address-photo-choices').querySelectorAll('button').forEach(b=>b.onclick=()=>setPhoto(photos[Number(b.dataset.photoIndex)]));
}
$('#address-photo').onerror=()=>{ $('#address-photo').hidden=true;$('#address-photo-empty').hidden=false;$('#address-photo-empty').textContent='사진을 읽지 못했습니다. 출처 링크에서 확인해 주세요.';$('#address-sample-help').hidden=true;};

function webReference(target,context,provider,kind) {
  target.classList.add('is-web');
  const placeId=context.siteId;
  return mountWebSources(target,context,{provider,kind,onPhoto:placeId===site.siteId?added=>{
    const own=addedReferences.get(placeId)||[];
    if(own.length>=6){URL.revokeObjectURL(added.file);status('건물마다 참고 사진을 최대 6장까지 추가할 수 있습니다.');return false;}
    own.push(added);addedReferences.set(placeId,own);photos.push(added);renderPhotoChoices();setPhoto(added);showReference('photo');
    status('이 건물에 참고 사진을 연결했습니다. 사진을 클릭해 외벽 색을 비교할 수 있습니다.');return true;
  }:null});
}
async function showReference(mode,context=site) {
  const version=++referenceVersion;referenceMode=mode;referenceAbort?.abort();reference?.dispose();reference=null;
  referenceAbort=new AbortController();
  const target=$('#address-reference');target.replaceChildren();target.hidden=mode==='photo';target.classList.remove('is-web');
  $('#address-photo-box').hidden=mode!=='photo';$('#address-photo-choices').hidden=mode!=='photo';$('#address-photo-credit').hidden=mode!=='photo';$('#address-sample-help').hidden=mode!=='photo'||!photo;
  document.querySelectorAll('[data-reference]').forEach(b=>{b.classList.toggle('active',b.dataset.reference===mode);b.setAttribute('aria-pressed',String(b.dataset.reference===mode));});
  $('#address-reference-status').textContent='';
  if(mode==='photo')return;
  const [provider,kind]=mode.split('-');
  if(mode==='web'||!key(provider)) {
    reference=webReference(target,context,mode==='web'?null:provider,kind);
    $('#address-reference-status').textContent=mode!=='web'&&kind==='road'&&!preciseLocation(context.location)?'건물 단위 위치가 아직 확인되지 않았습니다. 지도 웹사이트에서 주소를 먼저 검색해 주세요.':'API 키 없이 지도 웹사이트와 인터넷 검색으로 확인할 수 있습니다.';
    return;
  }
  if(!preciseLocation(context.location)){reference=webReference(target,context,provider,kind);$('#address-reference-status').textContent='건물 단위 위치가 아직 확인되지 않았습니다. 지도 웹사이트에서 주소를 먼저 검색해 주세요.';return;}
  $('#address-reference-status').textContent='해당 위치의 '+(kind==='map'?'지도':'거리뷰')+'를 연결하고 있습니다…';
  try {
    const result=await referenceView(target,context,provider,kind,key(provider),bearing=>{if($('#address-sync').checked&&version===referenceVersion)scene.setBearing(bearing);},referenceAbort.signal);
    if(version!==referenceVersion){result.dispose();return;}
    reference=result;$('#address-reference-status').textContent=(provider==='naver'?'네이버':'카카오')+' '+(kind==='map'?'지도':'거리뷰')+' 연결됨';
  } catch(error) {if(version===referenceVersion){reference=webReference(target,context,provider,kind);$('#address-reference-status').textContent=error.message+' 지도 웹사이트에서 계속 확인할 수 있습니다.';}}
}

async function selectSite(id, override) {
  const next=catalog.find(s=>s.id===id);if(!next)return;
  ++searching;
  const token=++selection;status('도면과 위치 정보를 연결하고 있습니다…');
  try {
    const response=await fetch(new URL(next.modelFile,new URL(base,location.href)));
    if(!response.ok)throw Error('연결한 도면을 읽지 못했습니다.');
    const model=await response.json();if(token!==selection)return;
    if(override?.location)resolvedLocations.set(next.siteId,override.location);
    site={...next,...override,location:override?.location||resolvedLocations.get(next.siteId)||next.location};data=model;settings={view:site.footprint||facadeFor(site)?'exterior':'drawing'};
    finishSelection();status('주소에 연결된 수집 도면을 3D로 표시했습니다.');
  } catch(error){if(token===selection)status(error.message);}
}
function finishSelection() {
  const enriched=evidence.find(e=>e.siteId===site.siteId);
  photos=[...(enriched?.photos?.length?enriched.photos:site.photo?[site.photo]:[]).filter(isExteriorPhoto),...(addedReferences.get(site.siteId)||[])];
  $('#address-title').textContent=site.name;$('#address-location').textContent=site.address||'';
  $('#address-atlas-link').href=base+'?view=google&site='+encodeURIComponent(site.siteId);$('#address-extra-drawings').href=base+'?view=google&tab=drawings&site='+encodeURIComponent(site.siteId);
  const floors=places.find(p=>p.siteId===site.siteId)?.floors||[];
  $('#address-floor').innerHTML=floors.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')||'<option>연결된 도면 없음</option>';
  $('#address-floor').value=site.id;$('#address-floor').disabled=!floors.length;
  renderPhotoChoices();
  setPhoto(photos[0]);renderModel();renderPlaces();
  const links=mapLinks(site);$('#address-naver-link').href=links.naver;$('#address-kakao-link').href=links.kakao;$('#address-road-link').hidden=!links.roadview;if(links.roadview)$('#address-road-link').href=links.roadview;
  $('#address-plan-link').hidden=!data;$('#address-plan-link').href=base+'?site='+encodeURIComponent(site.id);
  const loc=site.location,source=safeSource(loc?.source),drawingSource=safeSource(site.source);
  $('#address-evidence').innerHTML=`<dl><dt>수집 주소</dt><dd>${esc(site.address)}</dd><dt>좌표 출처</dt><dd>${loc?`${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}<br>${esc(loc.precision==='publisher-naver-point'?'발행처에 포함된 네이버 지도 좌표 · 주소 일치 별도 확인':loc.precision==='address-area'?'행정구역 중심 · 건물 위치 아님':loc.precision==='provider-address'?'지도 서비스의 주소 검색 결과':loc.precision)}`:'아직 확인되지 않음'}${source?`<br><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">위치 출처 ↗</a>`:''}</dd><dt>형상</dt><dd id="address-evidence-shape">${esc(modelDescription(scene.profile,scene.view))}</dd><dt>연결 도면</dt><dd>${drawingSource?`<a href="${esc(drawingSource)}" target="_blank" rel="noopener noreferrer">도면 발행처 ↗</a>`:'수집 도면 미연결'}</dd></dl>`;
  const url=new URL(location.href);url.searchParams.set('view','address');if(data)url.searchParams.set('site',site.id);else url.searchParams.delete('site');history.replaceState(null,'',url);
  showReference(referenceMode);
}

$('#address-search').onsubmit=async event=>{
  event.preventDefault();const token=++searching;$('#address-results').replaceChildren();
  try {
    const input=parseMapInput($('#address-query').value),provider=$('#address-provider').value;
    if(input.coordinate){
      const nearby=places.filter(p=>preciseLocation(p.location)&&metersBetween(input.coordinate,p.location)<100).sort((a,b)=>metersBetween(input.coordinate,a.location)-metersBetween(input.coordinate,b.location));
      renderPlaces(nearby);status(`지도 링크의 위치를 찾았습니다. 100m 안의 수집 장소 ${nearby.length}곳에서 연결할 도면을 선택해 주세요.`);
      ++selection;site={id:'map-link',siteId:'map-link',name:input.query||'지도 링크의 위치',address:input.query||'지도 링크 좌표',location:{...input.coordinate,precision:'map-link',source:input.source}};data=null;settings={view:'exterior'};finishSelection();renderPlaces(nearby);return;
    }
    if(provider==='collection') {
      const matches=searchPlaces(places,input.query);renderPlaces(matches);
      if(matches.length===1){await selectSite(matches[0].id);renderPlaces(matches);}
      else {status(matches.length?`${matches.length}곳의 수집 장소가 일치합니다. 도면을 선택해 주세요.`:'일치하는 수집 자료가 없습니다. 지도 웹사이트와 이미지 검색에서 확인해 주세요.');if(!matches.length)showReference('web',{siteId:'web-query',name:input.query,address:input.query});}
      return;
    }
    if(!key(provider)) {
      const matches=searchPlaces(places,input.query);renderPlaces(matches);
      if(matches.length===1){await selectSite(matches[0].id);renderPlaces(matches);showReference(provider+'-map');}
      else showReference(provider+'-map',{siteId:'web-query',name:input.query,address:input.query});
      status('API 키 없이 '+(provider==='naver'?'네이버':'카카오')+' 지도 웹사이트에서 검색할 수 있습니다.');return;
    }
    status('주소를 검색하고 있습니다…');const results=await geocode(provider,input.query,key(provider));if(token!==searching)return;
    status(results.length?`${results.length}개의 주소를 찾았습니다. 결과를 선택해 주세요.`:'해당 주소의 검색 결과가 없습니다.');
    $('#address-results').innerHTML=results.map((r,i)=>`<button class="address-result" data-result="${i}">${esc(r.address)}<small>${r.location.lat.toFixed(6)}, ${r.location.lng.toFixed(6)}</small></button>`).join('');
    $('#address-results').querySelectorAll('button').forEach(button=>button.onclick=async()=>{
      const result=results[Number(button.dataset.result)],matches=searchPlaces(places,result.address);
      if(matches.length===1)await selectSite(matches[0].id,{location:result.location});
      else {++selection;site={...result,id:'address-result',siteId:'address-result'};data=null;settings={view:'exterior'};finishSelection();status('위치를 확인했습니다. 수집 도면과 연결되지 않은 참고 매스입니다.');}
    });
  } catch(error){if(token===searching)status(error.message);}
};
$('#address-query').oninput=()=>{++searching;$('#address-results').replaceChildren();if($('#address-provider').value==='collection'&&!/^https?:/.test($('#address-query').value))renderPlaces(searchPlaces(places,$('#address-query').value));};
$('#address-find-web').onclick=()=>{
  try{const query=$('#address-query').value.trim()?parseMapInput($('#address-query').value).query:site.address||site.name;
    const context=searchPlaces([site],query).length?site:{siteId:'web-query',name:query,address:query};showReference('web',context);
    status('입력한 주소의 지도 웹사이트와 외관 사진 검색을 준비했습니다.');
  }catch(error){status(error.message);}
};
$('#address-floor').onchange=event=>selectSite(event.target.value);
document.querySelectorAll('[data-model-view]').forEach(button=>button.onclick=()=>{settings.view=button.dataset.modelView;renderModel();});
document.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>showReference(button.dataset.reference));
$('#address-home').onclick=()=>scene.home();$('#address-top').onclick=()=>scene.top();$('#address-rotate').onchange=event=>{scene.controls.autoRotate=event.target.checked;};
$('#address-floors').onchange=event=>{settings.floors=Number(event.target.value);renderModel();};$('#address-height').onchange=event=>{settings.floorHeight=Number(event.target.value);renderModel();};
$('#address-photo-texture').onchange=event=>{settings.photoTexture=event.target.checked;delete settings.color;renderModel();};
$('#address-reset').onclick=()=>{settings={view:'exterior'};renderModel();status('사진에서 확인한 외관과 원본 벽면 질감으로 복원했습니다.');};
$('#address-color').oninput=event=>{colorPicked(event.target.value,false);};
$('#address-photo').onclick=event=>{
  const img=event.currentTarget;if(!img.complete||!img.naturalWidth)return;
  const point=imagePixel(img.getBoundingClientRect(),img.naturalWidth,img.naturalHeight,event.clientX,event.clientY);if(!point)return;
  try {
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(img,point.x,point.y,1,1,0,0,1,1);
    const [r,g,b]=ctx.getImageData(0,0,1,1).data;colorPicked('#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''));
  } catch {status('사진의 색을 읽지 못했습니다. 외벽 색에서 직접 선택해 주세요.');}
};
function colorPicked(color,fromPhoto=true){settings.color=color;$('#address-color').value=color;scene.setColor(color);$('#address-photo-texture').checked=false;$('#address-material-note').textContent='선택한 단색으로 비교 중 · 사진 기준 복원으로 되돌릴 수 있습니다.';status((fromPhoto?'사진에서 고른 색 ':'선택한 색 ')+color+'을 3D 외벽에 반영했습니다.');}
$('#address-export').onclick=()=>{
  const record={version:1,kind:'address-model-study',site:{id:site.id,name:site.name,address:site.address,location:site.location,source:site.source,modelFile:site.modelFile},model:scene.snapshot(),photos:photos.map(p=>({file:p.local?undefined:p.file,fileName:p.fileName,localReference:!!p.local,source:p.source,sha256:p.sha256})),disclosure:modelDescription(scene.profile,scene.view)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=site.id+'-address-model.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try {
  const responses=await Promise.all([fetch(base+'generated/catalog.json'),fetch(base+'address/evidence.json')]);
  if(!responses[0].ok)throw Error('수집 도면 목록을 읽지 못했습니다.');
  catalog=await responses[0].json();evidence=responses[1].ok?(await responses[1].json()).places:[];places=uniquePlaces(catalog);
  scene=new AddressScene($('#address-world'));renderPlaces();
  scene.onMaterialsChanged=surfaces=>{if(scene.profile.photoTexture){const failed=surfaces.some(s=>s.state==='failed');$('#address-material-note').textContent=failed?'사진 질감을 읽지 못해 기본 재질로 표시합니다.':surfaces.every(s=>s.state==='ready')?'원본 사진의 벽면 질감 적용됨':'사진의 벽면 질감을 불러오고 있습니다.';}};
  const requested=new URLSearchParams(location.search).get('site');
  await selectSite(catalog.some(s=>s.id===requested)?requested:'10000901-0');
  window.__addressStudio={get state(){return {site,settings,view:scene.view,photos:photos.length,model:scene.snapshot(),referenceMode};}};
} catch(error){status(error.message);$('#address-model-note').textContent='3D 화면을 준비하지 못했습니다.';}
addEventListener('pagehide',event=>{if(event.persisted)return;referenceAbort?.abort();reference?.dispose();scene?.dispose();for(const photos of addedReferences.values())for(const photo of photos)URL.revokeObjectURL(photo.file);});
