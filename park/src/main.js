import './style.css';
import { ParkScene } from './scene.js';
import { CHARACTERS } from '../lib/characters.mjs';

const paths={castle:'M3 21V9h4v4h3V5l2-3 2 3v8h3V9h4v12H3Zm7 0v-5h4v5M3 9V6m4 3V6m10 3V6m4 3V6',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4',moon:'M20.6 14.4A8.8 8.8 0 0 1 9.6 3.4a9 9 0 1 0 11 11Z',arrow:'M5 12h14m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',play:'m8 4 12 8-12 8V4Z',pause:'M8 4v16M16 4v16',refresh:'M20 7V2m0 5h-5M4 17v5m0-5h5M5.3 6a8 8 0 0 1 14.1 1M4.6 17A8 8 0 0 0 18.7 18',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',map:'m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17',car:'m4 9 2-5h12l2 5M3 9h18v8H3V9Zm3 8v3m12-3v3M6 12h2m8 0h2',film:'M3 4h18v16H3V4Zm4 0v16m10-16v16M3 8h4m10 0h4M3 15h4m10 0h4',mic:'M8 5a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0V5Zm-3 6v1a7 7 0 0 0 14 0v-1M12 19v4m-4 0h8',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',sound:'M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',plus:'M12 5v14M5 12h14',minus:'M5 12h14',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',check:'m5 12 4 4L19 6',github:'M8 20c-4 1-4-2-6-2m12 4v-4c0-1 .1-2-1-3 4 0 7-1 7-6 0-1-1-3-1-3s0-2 0-3c0 0-2 0-4 2a15 15 0 0 0-7 0C6 3 4 3 4 3c-1 1 0 3 0 3S3 8 3 9c0 5 3 6 7 6-1 1-1 2-1 3v4'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.star}"/></svg>`;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themeIcon=t=>({bumper:'car',theater:'film',music:'mic'}[t]||'star');
const statusName=s=>({attention:'확인 필요',construction:'공사 중',incoming:'입장 준비 중'}[s]||'운영 중');
const time=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
let state={attractions:[],git:{commits:[]},sync:null}, selected=null, view=null, currentQuality='high', connectionError=false;
const capture=new URLSearchParams(location.search).has('capture');

document.querySelector('#app').innerHTML=`
<header class="topbar">
 <a class="brand" href="/" aria-label="Wonder Park 홈"><span class="brand-mark">${icon('castle')}</span><span>WONDER PARK<small>THE TBD IMAGINATION COMPANY</small></span></a>
 <nav aria-label="주 메뉴"><button class="nav-item active" data-nav="park">파크 둘러보기</button><button class="nav-item" data-nav="attractions">어트랙션 <span id="nav-count">03</span></button><button class="nav-item" data-nav="operations">운영 관리</button></nav>
 <div class="top-actions"><span class="park-open"><i></i> PARK IS OPEN</span><button class="manager-avatar" id="manager" aria-label="파크 관리자">W<span></span></button></div>
</header>
<main class="park-page">
 <section class="intro" aria-label="파크 소개"><div class="eyebrow"><span></span> A WORLD OF POSSIBILITIES</div><h1>Small world.<br>Endless <em>wonder.</em></h1><p>작은 별에 펼쳐진 테마별 모험.<br>성 위로 피어나는 불꽃, 함께하는 친구들.</p><button class="primary-button" id="tour">파크 산책하기 ${icon('arrow')}</button><div class="discovery-actions"><button id="meet-friends">친구들 만나기 <span>${CHARACTERS.length}</span></button><button id="castle-show">성 불꽃놀이 보기 ${icon('star')}</button></div><div class="intro-foot"><span class="tiny-star">✧</span><p>A little planet. A thousand dreams.<br><strong>A little magic everywhere.</strong></p></div></section>
 <div id="world" class="world"><div id="labels" class="map-labels"></div><div id="loading" class="loading"><div class="loading-castle">${icon('castle')}</div><span>작은 세계를 준비하고 있어요</span><i></i></div><div id="webgl-error" class="webgl-error" hidden><h2>3D 파크를 열 수 없어요</h2><p>WebGL을 지원하는 브라우저에서 다시 열어 주세요. 아래 어트랙션 메뉴는 계속 사용할 수 있습니다.</p><button class="secondary-button" onclick="location.reload()">다시 열기</button></div></div>
 <div class="view-tools"><div class="light-toggle" aria-label="시간대 선택"><button id="day" class="selected" aria-label="낮 풍경" aria-pressed="true">${icon('sun')}</button><button id="night" aria-label="야간 풍경" aria-pressed="false">${icon('moon')}</button></div><button class="tool-button" id="settings" aria-label="화질 및 동작 설정">${icon('settings')}</button></div>
 <div class="world-caption"><span id="view-caption">THE MAGIC HOUR</span><span class="caption-line"></span><span id="view-subtitle">상상이 가장 아름다운 시간</span></div>
 <div class="map-controls"><button class="tool-button" id="home-view" aria-label="전체 지도">${icon('map')}</button><div class="zoom-controls"><button id="zoom-in" aria-label="확대">${icon('plus')}</button><span></span><button id="zoom-out" aria-label="축소">${icon('minus')}</button></div><span class="compass">N<i></i></span></div>
 <div class="orbit-hint"><span>↔</span> 드래그하여 둘러보기 <b>·</b> 스크롤하여 확대</div>
 <section class="attraction-dock" aria-label="운영 중인 어트랙션"><div class="dock-heading"><span class="eyebrow">TODAY’S ADVENTURES</span><strong><span id="open-count">03</span> <small>개의 작은 모험</small></strong></div><div id="attraction-list" class="attraction-list"></div><button class="dock-expand" id="all-attractions" aria-label="전체 어트랙션 보기">${icon('arrow')}</button></section>
</main>
<footer class="footer"><span>© 2026 TBD WONDER PARK <i>✧</i> DREAM. BUILD. REPEAT.</span><button id="sync-button"><i class="sync-dot"></i><span id="sync-label">파크 연결 중</span><span class="sync-arrow">↗</span></button><a href="/reports/" target="_blank" rel="noopener">품질 보고서 ${icon('external')}</a></footer>
<aside id="detail" class="detail-panel" hidden aria-label="어트랙션 안내"></aside>
<dialog id="modal" class="modal"><div id="modal-content"></div></dialog>
<section id="cinema-ui" class="cinema-ui" hidden><div class="cinema-top"><button id="leave-cinema" class="cinema-back">${icon('arrow')} 파크로 돌아가기</button><div><span>STARLIGHT CINEMA</span><h2>지금, 우리의 이야기</h2></div><span class="cinema-badge">PRIVATE SCREENING</span></div><div class="cinema-bottom"><div><small>NOW PLAYING</small><h3>WONDER PARK · A Park Is Born</h3><p>모든 가능성은 작은 아이디어에서 시작됩니다.</p></div><div class="film-controls"><button id="film-play" aria-label="영상 재생">${icon('play')}</button><span id="film-time">0:00 / 0:30</span><input id="film-seek" type="range" min="0" max="30" step=".1" value="0" aria-label="영상 재생 위치"><button id="film-mute" aria-label="영상 음소거">${icon('sound')}</button></div></div></section>
<video id="film" playsinline preload="metadata" crossorigin="anonymous" src="/api/project-asset/movie/output/vitalis-hackathon-30s.mp4" hidden></video>
<div id="toast" class="toast" role="status" aria-live="polite"></div>`;

const $=s=>document.querySelector(s), video=$('#film'), modal=$('#modal');
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function setNav(name){document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));}
function closeModal(){modal.close();setNav('park');}
function showModal(content){$('#modal-content').innerHTML=`<button class="modal-close" aria-label="닫기">${icon('close')}</button>${content}`;$('#modal-content .modal-close').onclick=closeModal;if(!modal.open)modal.showModal();}
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
modal.addEventListener('close',()=>setNav('park'));
function updateCatalog(next){
 state=next;connectionError=false;$('#open-count').textContent=String(state.attractions.length).padStart(2,'0');$('#nav-count').textContent=String(state.attractions.length).padStart(2,'0');
 $('#attraction-list').innerHTML=state.attractions.map((a,i)=>`<button class="attraction-card" data-id="${escape(a.id)}"><span class="attraction-number">0${i+1}</span><span class="attraction-symbol" style="--accent:${a.color}">${icon(themeIcon(a.theme))}</span><span class="attraction-copy"><small>${escape(a.english)}</small><strong>${escape(a.name)}</strong><span><i class="open-dot ${a.status==='attention'?'attention':''}"></i>${statusName(a.status)}</span></span><span class="card-arrow">↗</span></button>`).join('');
 $('#attraction-list').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
 $('#labels').innerHTML=state.attractions.map((a,i)=>`<button class="map-label" data-id="${escape(a.id)}" aria-label="${escape(a.name)} 살펴보기"><span class="label-pin" style="--accent:${a.color}">${icon(themeIcon(a.theme))}</span><span>${escape(a.name)}</span><small>0${i+1}</small></button>`).join('');
 $('#labels').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
 view?.setAttractions(state.attractions);
 $('#sync-label').textContent=state.watcher?(state.sync?.remote==='pending'?'새 커밋 확인 · 반영 대기':state.sync?.remote==='offline'?'로컬 운영 · 원격 재연결 대기':'10분마다 파크 업데이트'):'로컬 파크 운영 중';
 $('#sync-button').classList.toggle('attention',!!state.sync?.pending||state.sync?.remote==='offline');
 if(selected&&!state.attractions.some(a=>a.id===selected))closeDetail();
}
function closeDetail(){selected=null;$('#detail').hidden=true;document.body.classList.remove('has-detail');view?.overview();}
function select(id){
 const a=state.attractions.find(x=>x.id===id);if(!a)return;selected=id;view?.focus(id);$('#detail').hidden=false;document.body.classList.add('has-detail');
 const names=Object.fromEntries(CHARACTERS.map(c=>[c.id,c.name]));
 $('#detail').innerHTML=`<button class="detail-close" aria-label="어트랙션 안내 닫기">${icon('close')}</button><div class="detail-art" style="--accent:${a.color}"><span class="detail-orbit"></span>${icon(themeIcon(a.theme))}<span class="detail-ticket">ADMIT ONE</span></div><div class="detail-body"><div class="eyebrow">${escape(a.english)}</div><h2>${escape(a.name)}</h2><p>${escape(a.description)}</p><div class="detail-facts"><span><small>함께할 친구</small><strong>${names[a.character]}</strong></span><span><small>어트랙션 상태</small><strong><i class="open-dot"></i>${statusName(a.status)}</strong></span></div>${a.warning?`<p class="notice">${escape(a.warning)}</p>`:''}<button class="primary-button attraction-enter" data-enter="${escape(a.id)}">${escape(a.action)} ${icon('arrow')}</button><span class="detail-folder">${escape(a.folder)} / <small>우리의 프로젝트에서 자라난 모험</small></span></div>`;
 $('#detail .detail-close').onclick=closeDetail;$('#detail [data-enter]').onclick=()=>enter(a);
}
async function enter(a){
 if(a.id==='movie'||a.theme==='theater'&&a.id==='movie'){closeDetail();document.body.classList.add('in-cinema');$('#cinema-ui').hidden=false;view?.enterCinema();try{await video.play();}catch{toast('재생 버튼을 눌러 상영을 시작하세요.');}return;}
 if(a.hasWebApp||a.hasStaticApp||a.url){
  const button=$('#detail [data-enter]');button.disabled=true;button.textContent='어트랙션을 준비하고 있어요…';
  try{const response=await fetch('/api/launch?id='+encodeURIComponent(a.id),{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);const url=new URL(data.url);if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid URL');showModal(`<div class="eyebrow">YOUR ADVENTURE IS READY</div><h2>${escape(a.name)}</h2><p>어트랙션이 준비되었습니다. 새 창에서 모험을 시작하세요.</p><a class="primary-button launch-link" href="${escape(url.href)}" target="_blank" rel="noopener">어트랙션 열기 ${icon('external')}</a>`);}catch(e){toast('어트랙션을 실행하지 못했습니다. '+e.message);}finally{button.disabled=false;button.innerHTML=`${escape(a.action)} ${icon('arrow')}`;}return;
 }
 if(a.id!=='voice'){showModal(`<div class="eyebrow">${escape(a.english)}</div><h2>${escape(a.name)}</h2><p>${escape(a.description)}</p><div class="notice">아직 연결된 웹 화면이 없습니다. 프로젝트에 index.html 또는 실행 주소가 추가되면 입장이 연결됩니다.</div>`);return;}
 showModal(`<div class="eyebrow">MAGIC VOICE STAGE</div><h2>당신의 목소리가<br>마법의 시작.</h2><p>이 스테이지는 Mac에서 실행하는 음성 CLI와 연결됩니다. “헤이 TBD야”라고 부르고, 아이디어를 이야기해 보세요.</p><div class="voice-steps"><span>01 <strong>헤이 TBD야</strong><small>마법사를 불러 주세요</small></span><span>02 <strong>아이디어 이야기하기</strong><small>여러 문장으로 말해도 괜찮아요</small></span><span>03 <strong>TBD야 시작해줘</strong><small>함께 만들어 볼까요?</small></span></div><div class="command-box"><small>Mac 터미널에서 실행</small><code>cd voice<br>npm run build<br>npm start -- --cwd ..</code></div>`);
}
function allAttractions(){setNav('attractions');showModal(`<div class="eyebrow">FIND YOUR NEXT ADVENTURE</div><h2>어디로 떠나볼까요?</h2><p>작은 건물마다 우리가 만든 이야기가 기다립니다.</p><div class="attraction-directory">${state.attractions.map(a=>`<button data-id="${escape(a.id)}"><span style="--accent:${a.color}">${icon(themeIcon(a.theme))}</span><div><small>${escape(a.english)}</small><strong>${escape(a.name)}</strong><p>${escape(a.description)}</p></div>${icon('arrow')}</button>`).join('')}</div>`);$('#modal').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{closeModal();select(b.dataset.id);});}
function operations(){setNav('operations');const sync=state.sync;
 showModal(`<div class="eyebrow">BEHIND THE WONDER</div><h2>파크 운영실</h2><p>새로운 아이디어가 도착하면, 파크도 함께 자랍니다.</p><div class="ops-stats"><div><small>어트랙션</small><strong>${state.attractions.length}<em>곳</em></strong></div><div><small>자동 확인 주기</small><strong>10<em>분</em></strong></div><div><small>커밋 감시</small><strong class="ops-live">${state.watcher?'운영 중':'미실행'}</strong></div></div><div class="sync-status"><i class="open-dot"></i><span>${escape(sync?.message||'로컬 프로젝트를 표시하고 있습니다.')}<small>최근 확인 ${sync?.checkedAt?new Date(sync.checkedAt).toLocaleString('ko-KR'):'—'} · 다음 확인 ${sync?.nextCheckAt?new Date(sync.nextCheckAt).toLocaleTimeString('ko-KR'):'—'}</small></span><button id="refresh-now" aria-label="지금 커밋 확인">${icon('refresh')}</button></div><h3 class="section-label">최근 파크 작업</h3><div class="commit-list">${(state.git?.commits||[]).map(c=>`<div><span class="commit-node"></span><p>${escape(c.subject)}<small>${escape(c.hash)} · ${new Date(c.date).toLocaleDateString('ko-KR')}</small></p>${icon('check')}</div>`).join('')}</div><a class="report-link" href="/reports/" target="_blank" rel="noopener">${icon('check')} 코드 커버리지 · 골든 테스트 보고서 ${icon('external')}</a><a class="report-link" href="/reports/circuit/" target="_blank" rel="noopener">어트랙션 자동 입장 · 무한 순회 결과 ↗</a><div class="ops-note">프로젝트의 <code>attraction.json</code>으로 테마·이름·캐릭터·3D 모델을 설정할 수 있습니다. 다른 작업자의 수정 사항이 있으면 원격 반영을 보류하고 알려드립니다.</div>`);
 $('#refresh-now').onclick=async()=>{const b=$('#refresh-now');b.disabled=true;try{const r=await fetch('/api/refresh',{method:'POST'});if(!r.ok)throw new Error();toast(state.watcher?'커밋 확인을 요청했습니다. 잠시 뒤 운영실에 반영됩니다.':'감시 프로세스가 실행 중이지 않습니다. npm run park:watch로 시작하세요.');}catch{toast('커밋 확인 요청에 실패했습니다.');}finally{b.disabled=false;}};
}
$('#tour').onclick=()=>{closeDetail();view?.overview();if(view)view.tour=true;toast('파크 산책을 시작합니다. 화면을 드래그하면 직접 둘러볼 수 있어요.');};
$('#home-view').onclick=closeDetail;$('#all-attractions').onclick=allAttractions;
$('#meet-friends').onclick=()=>{
 showModal(`<div class="eyebrow">FRIENDS AROUND THE WORLD</div><h2>반가워, 나의 디즈니 친구들!</h2><p>친구를 선택하면 성의 정원으로 가까이 다가갑니다.</p><div class="character-directory">${CHARACTERS.map(c=>`<button data-character="${c.id}" style="--friend-color:${c.color}" aria-label="${c.name} 만나기"><span class="friend-monogram">${c.english[0]}</span><span><small>${c.english}</small><strong>${c.name}</strong><em>${c.location}</em></span><b>↗</b></button>`).join('')}</div>`);
 modal.querySelectorAll('[data-character]').forEach(button=>button.onclick=()=>{const c=CHARACTERS.find(c=>c.id===button.dataset.character);closeModal();closeDetail();view?.focusCharacter(c.id);toast(`${c.name}와 함께하는 작은 순간. 전체 지도로 돌아가면 작은 별을 다시 볼 수 있어요.`);});
};
$('#castle-show').onclick=()=>{closeDetail();daylight(true);view?.focusCastle();toast(view?.reduced?'움직임 줄이기 설정으로 불꽃을 정지 화면으로 보여드립니다.':'성 위의 불꽃놀이는 계속 이어집니다.');};
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='park'){closeModal();closeDetail();}else if(b.dataset.nav==='attractions')allAttractions();else operations();});
$('#manager').onclick=operations;$('#sync-button').onclick=operations;
function daylight(night){view?.setNight(night);document.body.classList.toggle('night',night);$('#day').classList.toggle('selected',!night);$('#night').classList.toggle('selected',night);$('#day').setAttribute('aria-pressed',String(!night));$('#night').setAttribute('aria-pressed',String(night));$('#view-caption').textContent=night?'AFTER THE STARS COME OUT':'THE MAGIC HOUR';$('#view-subtitle').textContent=night?'또 다른 마법이 시작되는 밤':'상상이 가장 아름다운 시간';}
$('#day').onclick=()=>daylight(false);$('#night').onclick=()=>daylight(true);
$('#zoom-in').onclick=()=>{if(view)view.camera.position.lerp(view.controls.target,.15);};$('#zoom-out').onclick=()=>{if(view)view.camera.position.lerp(view.controls.target,-.15);};
$('#settings').onclick=()=>{showModal(`<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>나만의 관람 환경</h2><p>파크의 작은 디테일까지 즐길 수 있도록 준비했습니다.</p><label class="setting-row"><span><strong>렌더링 품질</strong><small>그림자 · 반사 · 화면 공간 음영</small></span><select id="quality"><option value="ultra">최상</option><option value="high">높음</option><option value="balanced">부드러운 동작</option></select></label><label class="setting-row"><span><strong>움직임 줄이기</strong><small>캐릭터·어트랙션 모션을 정지합니다</small></span><input type="checkbox" id="reduce-motion" ${view?.reduced?'checked':''}></label><div class="settings-foot">드래그: 별 중심으로 회전 · 스크롤: 확대/축소<br>현재 렌더링 ${view?.fps||'—'} FPS · WebGL 2</div>`);$('#quality').value=currentQuality;$('#quality').onchange=e=>{currentQuality=e.target.value;view?.setQuality(currentQuality);};$('#reduce-motion').onchange=e=>{if(view)view.reduced=e.target.checked;};};
$('#leave-cinema').onclick=()=>{document.body.classList.remove('in-cinema');$('#cinema-ui').hidden=true;view?.leaveCinema();};
$('#film-play').onclick=()=>{if(video.paused)video.play().catch(()=>toast('영상 재생에 실패했습니다.'));else video.pause();};
$('#film-mute').onclick=()=>{video.muted=!video.muted;$('#film-mute').setAttribute('aria-pressed',String(video.muted));$('#film-mute').setAttribute('aria-label',video.muted?'영상 음소거 해제':'영상 음소거');};
$('#film-seek').oninput=e=>video.currentTime=Number(e.target.value);
function filmState(){const duration=Number.isFinite(video.duration)?video.duration:30;$('#film-time').textContent=time(video.currentTime)+' / '+time(duration);$('#film-seek').max=duration;$('#film-seek').value=video.currentTime;$('#film-play').innerHTML=icon(video.paused?'play':'pause');$('#film-play').setAttribute('aria-label',video.paused?'영상 재생':'영상 일시정지');}
['play','pause','timeupdate','loadedmetadata','ended'].forEach(event=>video.addEventListener(event,filmState));video.addEventListener('error',()=>toast('상영 영상을 불러오지 못했습니다. movie/output 파일을 확인해 주세요.'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.open){if(view?.mode==='cinema')$('#leave-cinema').click();else closeDetail();}});

try{
 view=new ParkScene($('#world'),{video,capture,onSelect:select,onReady:()=>{$('#loading').classList.add('loaded');setTimeout(()=>$('#loading').hidden=true,350);},onError:()=>{$('#loading').hidden=true;$('#webgl-error').hidden=false;},onLabels:labels=>labels.forEach(p=>{const el=[...$('#labels').children].find(e=>e.dataset.id===p.id);if(el){el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;el.style.visibility=p.visible?'visible':'hidden';}})});
 view.setQuality('ultra');currentQuality='ultra';
}catch(error){console.error(error);$('#loading').hidden=true;$('#webgl-error').hidden=false;}
try{const response=await fetch('/api/park');if(!response.ok)throw new Error('Cannot load park');updateCatalog(await response.json());}catch{connectionError=true;$('#sync-label').textContent='파크 연결을 확인해 주세요';toast('프로젝트 목록을 불러오지 못했습니다. 잠시 후 다시 연결합니다.');}
const events=new EventSource('/api/events');events.onmessage=e=>{try{updateCatalog(JSON.parse(e.data));}catch{}};events.onerror=()=>{connectionError=true;$('#sync-label').textContent='파크 연결 복구 중';};
window.__park={view,getState:()=>state,select,enterCinema:()=>enter(state.attractions.find(a=>a.id==='movie')),getConnectionError:()=>connectionError};
window.addEventListener('pagehide',()=>{events.close();view?.dispose();});
