import references from '../public/plans/complex-references.json';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function floorDetails(site,index){
 if(!site?.basementFloors)return '';
 const asset=site.assets[index],levels=[...(site.assets.some(a=>a.floor==='SITE')?['SITE']:[]),...site.basementFloors];
 return `<section class="floor-details"><div class="eyebrow">FLOOR COLLECTION</div><div class="floor-levels" role="group" aria-label="층별 도면">${levels.map(floor=>{const i=site.assets.findIndex(a=>a.floor===floor);return `<button data-floor="${floor}" data-asset-index="${i}" aria-pressed="${i===index}" ${i<0?'disabled':''}>${floor==='SITE'?'단지':floor}<small>${i<0?'원본 미확보':i===index?'보는 중':'도면'}</small></button>`;}).join('')}</div><p id="floor-status">${esc(asset.floor==='SITE'?'단지 배치도':asset.floor)} · ${esc(site.documentStatus)}</p>${site.complexInfo?`<div class="complex-stats"><span><b>${site.complexInfo.households}</b>세대</span><span><b>${site.complexInfo.buildingCount}</b>개 동</span><span><b>B${site.basementFloors.length}</b>지하 규모</span></div><p>${esc(site.complexInfo.notes)}</p><a href="${site.complexInfo.source}" target="_blank" rel="noopener">공식 단지 개요 ↗</a>`:'<p>층마다 다른 원본을 분석합니다. 층간 램프·출입구 연결은 현장 검증 전입니다.</p>'}</section>`;
}

export function complexReferences(){
 return `<section class="complex-references" hidden><h3>대단지 지하주차장 원문 자료</h3>${references.map(r=>`<article data-reference="${r.id}"><div class="eyebrow">${esc(r.publisher)}</div><h4>${esc(r.name)}</h4><p><strong>${r.parkingSpaces.toLocaleString('ko-KR')}대</strong> · ${esc(r.addressStatus)}</p><small>${esc(r.parkingCountBasis)}</small><div class="reference-levels">${r.levels.map(f=>`<a href="${r.document}#page=${f.page}" target="_blank" rel="noopener">${esc(f.label)} 원문 ↗</a>`).join('')}</div><p>${esc(r.notice)}</p><a href="${r.source}" target="_blank" rel="noopener">자료 출처와 이용 조건 ↗</a></article>`).join('')}</section>`;
}
