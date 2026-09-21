// Kept in the root entry so both the existing park and the latest QA remain visible.
const element=document.querySelector('#parking-quality');
if(element){
  const style=document.createElement('style');style.textContent='#parking-quality{position:fixed;right:24px;bottom:56px;z-index:12;max-width:320px;background:#fbfcf3ee;color:#49654d;border:1px solid #cad8bf;border-radius:7px;padding:10px 13px;font:11px -apple-system,sans-serif;box-shadow:0 4px 15px #29412a10}#parking-quality summary{cursor:pointer}#parking-quality p{font-size:11px;line-height:1.7}#parking-quality a{display:block;color:#3b6a4c;font-size:11px;margin-top:9px}@media(max-width:600px){#parking-quality{bottom:51px;right:12px;max-width:240px;font-size:10px}}';document.head.append(style);
  let pending=false;
  async function refresh(){if(pending)return;pending=true;try{
    const r=await fetch('/reports/map_new/latest.json',{cache:'no-store'});if(!r.ok)throw Error();const report=await r.json();
    const label={passed:'검증 통과',failed:'실패 항목 확인',running:'검증 중'}[report.status]||'검증 확인';
    element.querySelector('summary').textContent=`ATLAS 주차 · ${label}`;
    element.querySelector('p').textContent=`${new Date(report.at).toLocaleString('ko-KR')} · 단위 ${report.unit?.passed??'—'} / 실패 ${report.unit?.failed??'—'} · 골든·브라우저 ${report.e2e?.passed??'—'} · 문장 커버리지 ${report.coverage?.statements?.pct??'—'}%. ${report.openItems?.length?`미완료 ${report.openItems.length}개 항목은 보고서에서 확인할 수 있습니다.`:''}`;
  }catch{element.querySelector('p').textContent='아직 검증 기록이 없습니다. 주차 연구소에서 도면을 확인할 수 있습니다.';}finally{pending=false;}}
  refresh();const timer=setInterval(refresh,15000);window.addEventListener('pagehide',()=>clearInterval(timer));
}
