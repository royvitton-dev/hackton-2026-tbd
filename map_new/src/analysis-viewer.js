const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MODES={overlay:'검출선 겹쳐 보기',original:'원본 컬러',grayscale:'흑백·대비 보정',binary:'흑백 이진화'};

// A single image is reused for the overview and native-resolution tile crop.
// Request tokens prevent a slow image from replacing a newly selected drawing.
export function analysisViewer(container,{catalog,initialId,asset,onOpen,download}){
  const sites=catalog.filter(s=>!s.synthetic&&s.rasterAnalysis);
  let current,data,mode='overlay',tileIndex=0,request=0,imageRequest=0,disposed=false,loadedImage;
  const abort=new AbortController();
  container.innerHTML=`<div class="analysis-viewer"><p class="eyebrow">DRAWING RECOGNITION</p><h2>전체 도면 인식 결과</h2>
    <p class="analysis-intro">${sites.length} / ${catalog.filter(s=>!s.synthetic).length}장 원본 해상도 분석 · 겹치는 조각을 원래 좌표로 합쳤습니다.</p>
    <label class="analysis-site-label">도면 선택<select id="analysis-site" aria-label="분석 도면 선택">${sites.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('')}</select></label>
    <div class="analysis-modes" role="group" aria-label="도면 분석 이미지">${Object.entries(MODES).map(([id,name])=>`<button type="button" data-analysis-mode="${id}" aria-pressed="${id===mode}">${name}</button>`).join('')}</div>
    <p id="analysis-status" role="status">분석 결과를 불러옵니다.</p><div id="analysis-stats" class="analysis-stats"></div>
    <div class="analysis-images"><section><h3>전체 도면 <small>조각을 선택해 확대하세요</small></h3><div class="analysis-overview"><img id="analysis-overview-image" alt="전체 도면 분석"><div id="analysis-tiles" aria-label="분할 영역 선택"></div></div></section>
    <section><div class="analysis-tile-heading"><h3>선택한 조각</h3><select id="analysis-tile-select" aria-label="확대할 도면 조각"></select></div>
      <label class="analysis-zoom">확대 <input id="analysis-zoom" type="range" min="50" max="200" step="25" value="100"><output id="analysis-zoom-value">100%</output></label>
      <div class="analysis-tile-scroll"><canvas id="analysis-tile-canvas" aria-label="원본 좌표의 확대 도면 조각"></canvas></div><p id="analysis-tile-note"></p></section></div>
    <p class="analysis-legend"><i class="structural"></i> 두꺼운 구조선 후보 <i class="thin"></i> 가는 선·보조선 후보</p>
    <p class="drawing-note">색상은 검출선 구분입니다. 충전기·전파 점수와 다릅니다. 치수선·가구선이 남아 있을 수 있으며, 자동 검출 결과가 출입구나 차량 통행을 확정하지는 않습니다.</p>
    <div class="analysis-actions"><button id="analysis-open-plan" class="import-button">이 도면을 3D로 열기</button><button id="analysis-export" class="import-button">좌표·분할 결과 내려받기 ↓</button><a id="analysis-source" target="_blank" rel="noopener">원본 출처 ↗</a></div>
    <details class="analysis-inventory"><summary>전체 도면 처리 현황 · ${sites.length}장</summary><div class="drawing-table"><table><thead><tr><th>도면</th><th>원본 해상도</th><th>분할</th><th>검출선</th><th>주차 동선</th></tr></thead><tbody>${sites.map(s=>`<tr><td><button type="button" data-analysis-site="${escape(s.id)}">${escape(s.name)}</button></td><td>${s.rasterAnalysis.sourcePixels.width} × ${s.rasterAnalysis.sourcePixels.height}</td><td>${s.rasterAnalysis.tileCount}</td><td>${s.rasterAnalysis.candidates}</td><td>${s.routingReady?'주석 있음':'미확인'}</td></tr>`).join('')}</tbody></table></div></details>
  </div>`;
  const $=selector=>container.querySelector(selector);
  function tile(){
    if(!data||!loadedImage)return;
    const selected=data.tiles[tileIndex],canvas=$('#analysis-tile-canvas'),context=canvas.getContext('2d');
    const scaleX=loadedImage.naturalWidth/data.sourcePixels.width,scaleY=loadedImage.naturalHeight/data.sourcePixels.height;
    canvas.width=selected.width;canvas.height=selected.height;
    context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(loadedImage,selected.x*scaleX,selected.y*scaleY,selected.width*scaleX,selected.height*scaleY,0,0,selected.width,selected.height);
    // The overlay overview is bounded for fast loading. Crop the native grayscale
    // instead and draw original-coordinate vectors to retain sharp detail.
    if(mode==='overlay')for(const c of data.candidates){
      if(Math.max(c.x1,c.x2)<selected.x||Math.min(c.x1,c.x2)>selected.x+selected.width||Math.max(c.y1,c.y2)<selected.y||Math.min(c.y1,c.y2)>selected.y+selected.height)continue;
      context.strokeStyle=c.structuralStroke?'#1d6187':'#dd9e34';context.lineWidth=Math.max(1,Math.min(c.structuralStroke?5:2,c.thickness));context.beginPath();context.moveTo(c.x1-selected.x,c.y1-selected.y);context.lineTo(c.x2-selected.x,c.y2-selected.y);context.stroke();
    }
    $('#analysis-tile-note').textContent=`${selected.id} · 원본 (${selected.x}, ${selected.y})부터 ${selected.width} × ${selected.height}px · 분할 전 중복 포함 검출 ${selected.rawSegments}개`;
    $('#analysis-tile-select').value=String(tileIndex);canvas.dataset.tileId=selected.id;
    container.querySelectorAll('[data-analysis-tile]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.analysisTile)===tileIndex)));
  }
  async function showImage(){
    if(!data)return;const token=++imageRequest;loadedImage=null;
    $('#analysis-tile-canvas').getContext('2d').clearRect(0,0,1024,1024);
    const prefix=`analysis/${current.id}/`,file=mode==='original'?current.sourceAsset.file:prefix+(mode==='binary'?'binary.png':mode==='overlay'?'overlay.webp':'grayscale.webp');
    $('#analysis-overview-image').src=asset(file);$('#analysis-overview-image').alt=current.name+' · '+MODES[mode];
    const img=new Image();img.src=asset(mode==='overlay'?prefix+'grayscale.webp':file);
    try{await img.decode();if(disposed||token!==imageRequest)return;loadedImage=img;tile();$('#analysis-status').textContent=data.contextMap?'안내도·배치도: 선을 분석하고 건물 벽체 변환은 보류했습니다.':data.planarDrawing===false?data.sourceReview.note:'원본 좌표로 병합 완료 · 자동 검출선은 원본 대조가 필요합니다.';}
    catch{if(!disposed&&token===imageRequest)$('#analysis-status').textContent='이미지를 불러오지 못했습니다. 보기 방식을 다시 선택하세요.';}
  }
  async function select(id){
    const token=++request;++imageRequest;loadedImage=null;data=null;current=sites.find(s=>s.id===id)||sites[0];
    $('#analysis-site').value=current.id;$('#analysis-status').textContent='분석 결과를 불러옵니다.';$('#analysis-tiles').innerHTML='';
    $('#analysis-open-plan').disabled=true;$('#analysis-export').disabled=true;
    try{
      const response=await fetch(asset(current.rasterAnalysis.file),{signal:abort.signal});if(!response.ok)throw Error('도면 분석 파일을 읽지 못했습니다.');
      const next=await response.json();if(disposed||token!==request)return;data=next;tileIndex=0;
      const p=data.sourcePixels;$('#analysis-stats').innerHTML=`<span><b>${p.width} × ${p.height}</b>원본 픽셀 · 축소 없음</span><span><b>${data.tiles.length}개</b>분할 · ${data.overlap}px 겹침</span><span><b>${data.candidates.length}개</b>병합한 구조선 후보</span><span><b>${data.excludedTextBoxes}개</b>제외한 OCR 글자 영역</span>`;
      $('#analysis-tiles').innerHTML=data.tiles.map((t,i)=>`<button type="button" data-analysis-tile="${i}" aria-label="${t.id} 확대" aria-pressed="${i===0}" style="left:${t.x/p.width*100}%;top:${t.y/p.height*100}%;width:${t.width/p.width*100}%;height:${t.height/p.height*100}%"><span>${i+1}</span></button>`).join('');
      $('#analysis-tile-select').innerHTML=data.tiles.map((t,i)=>`<option value="${i}">${i+1} / ${data.tiles.length} · ${t.id}</option>`).join('');
      container.querySelectorAll('[data-analysis-tile]').forEach(b=>b.onclick=()=>{tileIndex=Number(b.dataset.analysisTile);tile();});
      $('#analysis-source').href=current.source;$('#analysis-open-plan').disabled=false;$('#analysis-export').disabled=false;
      await showImage();
    }catch(error){if(!disposed&&token===request)$('#analysis-status').textContent=error.message;}
  }
  $('#analysis-site').onchange=e=>select(e.target.value);
  container.querySelectorAll('[data-analysis-site]').forEach(b=>b.onclick=()=>select(b.dataset.analysisSite));
  container.querySelectorAll('[data-analysis-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.analysisMode;container.querySelectorAll('[data-analysis-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));showImage();});
  $('#analysis-tile-select').onchange=e=>{tileIndex=Number(e.target.value);tile();};
  $('#analysis-zoom').oninput=e=>{const zoom=Number(e.target.value);$('#analysis-zoom-value').value=zoom+'%';$('#analysis-tile-canvas').style.width=zoom+'%';};
  $('#analysis-open-plan').onclick=()=>onOpen(current.id);
  $('#analysis-export').onclick=()=>{if(data)download(data,current.id+'-native-analysis.json');};
  select(initialId);
  return ()=>{disposed=true;abort.abort();};
}
