const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sourceEvidence(plan){
 if(!plan.sourceAsset)return '';
 return `<section class="source-evidence" data-plan-id="${esc(plan.id)}"><span>분석한 원본 도면 · ${esc(plan.floor||'층 미지정')}${plan.sourcePage?` · ${plan.sourcePage}쪽`:''}</span><button data-source-preview><img src="${esc(plan.sourceAsset)}" alt="${esc(plan.name)} 원본"><strong>${esc(plan.name)}<small>원본 크게 보기 ↗</small></strong></button><label><input type="checkbox" data-source-overlay checked> 3D 바닥에 원본 겹쳐보기</label></section>`;
}

export function bindSourceEvidence(container,{scene,plan,dialog}){
 const preview=container.querySelector('[data-source-preview]');if(!preview)return;
 scene.showSourceBlueprint(plan);
 preview.onclick=()=>dialog(`<div class="eyebrow">ANALYSIS SOURCE · ${esc(plan.floor||'선택 도면')}</div><h2>${esc(plan.name)}</h2><img class="source-dialog-image" src="${esc(plan.sourceAsset)}" alt="분석에 사용한 원본 도면"><p>3D 구조와 비교한 원본입니다. 구조선과 축척은 현장 확인 전의 추정값입니다.</p>`);
 container.querySelector('[data-source-overlay]').onchange=e=>{const overlay=scene.world.getObjectByName('source-blueprint');if(overlay)overlay.visible=e.target.checked;};
}
