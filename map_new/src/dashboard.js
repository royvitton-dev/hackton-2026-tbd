export const dashboardMarkup=`<section id="cockpit" class="cockpit" aria-label="차량 대시보드" hidden>
 <div class="dash-wheel" aria-hidden="true"><div class="wheel-ring"><i></i><b>ATLAS</b></div></div>
 <div class="dash-cluster"><div class="dash-indicators"><span id="indicator-left" aria-label="좌측 방향지시등">◀</span><small>DRIVER VIEW</small><span id="indicator-right" aria-label="우측 방향지시등">▶</span></div>
 <div class="dash-speed"><strong id="dash-speed">0</strong><span>km/h</span><b id="dash-gear">D</b></div><div class="dash-meter"><i></i></div><p id="dash-route">경로를 선택하세요</p></div>
 <div class="dash-console"><b>정면 주행</b><span>W / ↑ 전진 · S / ↓ 후진<br>A / ← 좌회전 · D / → 우회전</span><small id="dash-signal" role="status">방향지시등 꺼짐</small></div>
</section>`;
export function updateDashboard({visible,speed,pose,signal,lit,remaining,steer}){
 const el=document.querySelector('#cockpit');el.hidden=!visible;
 el.dataset.signal=signal||'off';el.dataset.lit=String(lit);el.style.setProperty('--steering',(steer||0)*-65+'deg');
 document.querySelector('#dash-speed').textContent=Math.round(Math.max(0,speed)*3.6);
 document.querySelector('#dash-gear').textContent=pose?.arrived?'P':pose?.gear===-1?'R':'D';
 document.querySelector('#dash-route').textContent=pose?.arrived?'목적지에 도착했습니다':remaining===null?'직접 운전 중':Math.ceil(remaining)+' m 남음';
 const text=signal==='left'?'좌측 방향지시등':signal==='right'?'우측 방향지시등':'방향지시등 꺼짐';
 const status=document.querySelector('#dash-signal');if(status.textContent!==text)status.textContent=text;
 for(const side of ['left','right'])document.querySelector('#indicator-'+side).setAttribute('aria-label',(side==='left'?'좌측':'우측')+' 방향지시등 '+(signal===side?'켜짐':'꺼짐'));
}
