import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,cp,rm,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),project=path.join(root,'map_new'),reports=path.join(root,'reports'),runtime=path.join(project,'.runtime');
const watch=process.argv.includes('--watch'),checkpoint=process.argv.includes('--checkpoint');
let activeChild,stopping=false;
await mkdir(reports,{recursive:true});await mkdir(runtime,{recursive:true});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readJson=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}};
async function atomic(file,value){await writeFile(file+'.tmp',value);const {rename}=await import('node:fs/promises');await rename(file+'.tmp',file);}
async function sourceDigest(){
  const hash=createHash('sha256');
  async function visit(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(['node_modules','dist','reports','.runtime','test-results','__pycache__','.env.local'].includes(e.name)||e.name.startsWith('.env.'))continue;const file=path.join(dir,e.name);if(e.isDirectory())await visit(file);else hash.update(path.relative(root,file)).update(await readFile(file));}}
  for(const dir of ['src','scripts','tests','public/sources','public/photos'])await visit(path.join(project,dir));
  for(const file of ['index.html','package.json','package-lock.json','vite.config.mjs','vitest.config.mjs','playwright.config.mjs'])hash.update(await readFile(path.join(project,file)));
  for(const file of ['park/server.mjs','park/server/routes.mjs','park/vite.config.mjs','index.html'])hash.update(await readFile(path.join(root,file)));
  return hash.digest('hex');
}
async function runStep(name,args,cwd,dir){
  const startedAt=new Date().toISOString();console.log(`\n[${name}] ${args.join(' ')}`);
  return new Promise(resolve=>{let output='';const child=spawn(process.execPath,args,{cwd,env:{...process.env,ATLAS_VERIFY_WORKER:'1'},stdio:['ignore','pipe','pipe']});activeChild=child;child.stdout.on('data',b=>{output+=b;process.stdout.write(b);});child.stderr.on('data',b=>{output+=b;process.stderr.write(b);});let done=false;const finish=async code=>{if(done)return;done=true;activeChild=null;await writeFile(path.join(dir,name+'.log'),output);resolve({name,exitCode:code,startedAt,finishedAt:new Date().toISOString()});};child.on('error',e=>{output+=e.message;finish(1);});child.on('exit',code=>finish(code??1));});
}
function page(report){
  const rows=report.steps.map(s=>`<tr><td>${escape(s.name)}</td><td class="${s.exitCode===0?'pass':'fail'}">${s.exitCode===0?'통과':'실패'}</td><td><a href="runs/${report.id}/${s.name}.log">실행 로그 ↗</a></td></tr>`).join('');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS 검증 · ${report.id}</title><style>body{font:15px/1.8 -apple-system,sans-serif;background:#f3f5ec;color:#334e3d;max-width:1050px;margin:45px auto;padding:0 24px}h1{font-size:32px;font-weight:500}a{color:#286f50}small{color:#85947c}.cards{display:flex;gap:20px;flex-wrap:wrap}.cards div{background:#fffdf5;border:1px solid #d4dfc9;border-radius:10px;padding:16px 24px;min-width:150px}.cards strong{font-size:28px;display:block}.pass{color:#2b845b}.fail{color:#b85836}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{text-align:left;border-bottom:1px solid #d5dfcb;padding:9px}code{font-size:12px;overflow-wrap:anywhere}li{margin:8px 0}.note{background:#fbf4e4;padding:18px;border-radius:8px}img{width:48%;border:1px solid #cbd7c2;margin:5px}section{margin-top:30px}</style><a href="/park/">Wonder Park</a> · <a href="/map_new/">3D 주차장</a> · <a href="index.html">최신 보고서</a><p><small>ATLAS / REPRODUCIBLE VERIFICATION</small></p><h1>주차 내비게이션 검증 보고서</h1><p>${escape(report.at)} · <b class="${report.status==='passed'?'pass':'fail'}">${report.status==='passed'?'이번 검증 통과':'실패 항목 확인'}</b></p><div class="cards"><div>단위 테스트<strong>${report.unit.passed} / ${report.unit.total}</strong></div><div>Python 영상 분석<strong>${report.python?.passed??0} / ${report.python?.total??0}</strong></div><div>브라우저·골든<strong>${report.e2e.passed} / ${report.e2e.total}</strong></div><div>문장 커버리지<strong>${report.coverage?.statements?.pct??'—'}%</strong></div><div>분기 커버리지<strong>${report.coverage?.branches?.pct??'—'}%</strong></div></div><p>코어 알고리즘·변환기의 V8 커버리지입니다. Python 영상 분석·UI 전체·외부 지도 서비스의 커버리지를 합산한 값이 아닙니다.</p><table><thead><tr><th>실행 단계</th><th>결과</th><th>근거</th></tr></thead><tbody>${rows}</tbody></table><a href="runs/${report.id}/coverage/index.html">커버리지 상세</a> · <a href="runs/${report.id}/unit.json">단위 결과 JSON</a> · <a href="runs/${report.id}/e2e.json">브라우저 결과 JSON</a><section><h2>이번 변경과 이전 실패 분석</h2><ul>${report.changes.map(c=>`<li>${escape(c)}</li>`).join('')}</ul><p>이전 회차: ${report.previous?escape(report.previous.id+' · '+report.previous.status):'최초 통합 검증'}</p></section><section class="note"><h2>전체 요구사항의 미완료·미검증 항목</h2><p>이번 테스트 통과와 전체 목표 달성을 구분합니다.</p><ul>${report.openItems.map(c=>`<li>${escape(c)}</li>`).join('')}</ul></section><section><h2>골든 기준</h2><p>비교 실행에서는 --update-snapshots를 사용하지 않습니다. PNG는 검토한 기준 화면입니다.</p>${['public-b2','integrated-route','photo-facade','parking-mobile','charging-screening','drawing-materials','charging-mobile','park-guide','parking-bay','detected-parking','drawing-details','daecheon-parking-route','dongtan-parking-route','native-analysis','reverse-parking','multilevel-route','driver-dashboard','driver-dashboard-mobile'].map(s=>`<a href="runs/${report.id}/golden/${s}.png"><img src="runs/${report.id}/golden/${s}.png" alt="${s}"></a>`).join('')}</section><section><h2>검증 대상 식별</h2><p>Git: <code>${escape(report.git)}</code> · 브랜치 <code>${escape(report.branch||'기록 없음')}</code><br>입력 SHA-256: <code>${report.sourceDigest}</code></p><p>${report.inventory?.places??'—'}개 실제 장소 · ${report.inventory?.drawings??'—'}장 공개 도면 · ${report.inventory?.uniqueStations??'—'}개 중복 제거 기지국 기록 + 별도 합성 통합 시나리오. 실제 B2의 동선은 수동 주석이고 축척은 추정값입니다. 합성 도면은 실제 장소나 승인된 대피 경로가 아닙니다.</p></section></html>`;
}
async function checkpointResult(id){
  const exec=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  if(exec(['diff','--cached','--name-only']))throw Error('기존 스테이징 내용이 있어 자동 체크포인트를 보류합니다.');
  exec(['add','--','map_new','reports']);if(!exec(['diff','--cached','--name-only']))return;
  exec(['commit','-m',`Verify ATLAS parking twin (${id})`]);
  try{exec(['push','origin','HEAD']);}catch(error){throw Error('체크포인트 커밋 완료, 원격 push 실패. 원격 변경을 확인해야 합니다. '+error.stderr);}
}
async function verify(){
  let lock;try{lock=await open(path.join(runtime,'verify.lock'),'wx');}catch{const previous=await readJson(path.join(runtime,'verify.lock'));try{if(previous?.pid)process.kill(previous.pid,0);else throw Error();console.log('검증 프로세스가 실행 중입니다.');return;}catch{await rm(path.join(runtime,'verify.lock'),{force:true});lock=await open(path.join(runtime,'verify.lock'),'wx');}}
  await lock.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
  const at=new Date().toISOString(),id=at.replace(/[:.]/g,'-'),dir=path.join(reports,'runs',id),previous=await readJson(path.join(reports,'latest.json'));
  const sourceBefore=await sourceDigest();
  await mkdir(dir,{recursive:true});
  try{
    await atomic(path.join(reports,'latest.json'),JSON.stringify({id,at,status:'running',previous:previous&&{id:previous.id,status:previous.status}},null,2));
    for(const file of ['reports/unit.json','reports/e2e.json','reports/vision.json','reports/coverage'])await rm(path.join(project,file),{recursive:true,force:true});
    const steps=[];
    for(const [name,args,cwd] of [
      ['convert',['scripts/convert.mjs'],project],
      ['python',['scripts/vision.mjs','--test'],project],
      ['unit',[path.join(root,'node_modules/vitest/vitest.mjs'),'run','--coverage'],project],
      ['build',[path.join(root,'node_modules/vite/bin/vite.js'),'build','--base','/map_new/','--outDir',path.join(root,'.server-dist/map_new'),'--emptyOutDir'],project],
      ['e2e',[path.join(root,'node_modules/@playwright/test/cli.js'),'test'],project],
      ['router',[path.join(root,'node_modules/vitest/vitest.mjs'),'run','--config','park/vitest.router.config.mjs'],root],
    ]){if(stopping)break;steps.push(await runStep(name,args,cwd,dir));}
    const unit=await readJson(path.join(project,'reports/unit.json')),e2e=await readJson(path.join(project,'reports/e2e.json')),coverage=await readJson(path.join(project,'reports/coverage/coverage-summary.json')),python=await readJson(path.join(project,'reports/vision.json'));
    const inventory=await readJson(path.join(project,'public/generated/inventory.json'));
    const report={id,at,inventory,branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),git:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceDigest:await sourceDigest(),status:steps.every(s=>s.exitCode===0)&&unit?.numTotalTests>0&&e2e?.stats?.expected>0?'passed':'failed',steps,unit:{passed:unit?.numPassedTests||0,failed:unit?.numFailedTests||0,total:unit?.numTotalTests||0},e2e:{passed:e2e?.stats?.expected||0,failed:e2e?.stats?.unexpected||0,total:(e2e?.stats?.expected||0)+(e2e?.stats?.unexpected||0)+(e2e?.stats?.skipped||0)},coverage:coverage?.total||null,previous:previous&&{id:previous.id,status:previous.status},changes:[
      '주차 정보가 확인된 4개 도면의 187면 모두에 접근 경로를 연결했습니다. 실제 도면 진입 시 가장 먼 일반 주차면으로 자동 안내하며 주차 정보가 없는 도면에는 차량 경로를 제공하지 않습니다.',
      '1인칭 시점을 차량 정면·경사에 고정하고 속도·기어·남은 거리 대시보드, 자동·수동 조향의 좌우 방향지시등, 정지 후 시선 유지를 추가했습니다.',
      '45개 실제 장소·9개 유형·63장 도면을 해시로 확인하고 공원과 공영주차장을 포함했습니다. 층별 도면을 장소 수에 중복 집계하지 않습니다.',
      '44개 장소 주변의 KCA 전파누리 기지국 공개 제원을 수집했습니다. 정확한 시설 위치가 없는 자료는 점수 계산을 보류합니다.',
      '충전기 사전 비교에 RF·공간·차로 접근성 점수와 초록/빨강/황색/회색 표시를 추가했습니다. 장애인·전용·좁은 구획은 일반 후보에서 제외합니다.',
      `${inventory.parkingBays}개 실제 도면 주차 구획, ${inventory.objects}개 공간 오브젝트와 6종 재질을 표시합니다. 장애인 구획은 파란 바닥 표식·입체 안내판을 유지하고 예시 차량으로 가리지 않습니다.`,
      'B2 원본 재검토에서 남측 주차 구획선을 벽으로 처리한 오분류와 설비·빗금 영역의 예시 차량을 바로잡았습니다. 원본의 점검층 명칭도 교정했습니다.',
      `${inventory.higherResolutionDrawings}장의 발행처 고해상도 원본을 확보했습니다. 이전 이미지와 새 이미지·발행처 페이지의 해시를 보존하고 원본이 변경된 OCR만 재생성했습니다.`,
      `${inventory.drawings}장 원본을 한국어·영어 OCR로 처리하고 인식 글자 ${inventory.ocrLabels}개를 원본 위치·신뢰도와 함께 보존합니다. 도면 정보 화면에서 공간별 치수와 미확인 항목을 확인합니다.`,
      `${inventory.detectedParking}개 자동 주차 구획 후보 중 ${inventory.matchedParking}개가 기존 검토 구획과 대응합니다. 점선과 별도 목록으로 제공하며 실제 주차면·충전기 점수·경로에는 자동 추가하지 않습니다.`,
      '고해상도 대천항 도면의 범례와 위치를 재검토해 실·기둥·계단·승강기 47개를 추가했습니다. 작은 글자와 원본 위치를 함께 확인할 수 있습니다.',
      '실제 공원 PDF 가져오기와 파일 교체 후 원본 미리보기·기지국 출처 초기화를 검증합니다. 현재 PDF 라이브러리의 loading task 정리 API를 사용합니다.',
      '너나들이 원본의 차로→주차면 연결 3곳을 보존했습니다. 차체·기둥·벽·회전반경을 검사하는 전진 주차와 충전기 후보의 경로 미리보기를 추가했습니다. 제원상 불가능한 경로는 제공하지 않습니다.',
      '대천항 도면의 일반 주차면 50곳 앞 차로까지 진입점에서 안내합니다. 차량 크기·회전·벽·기둥을 검사하며 주차면 클릭과 도착을 브라우저에서 확인합니다.',
      '동탄 1층의 일반 주차면 13곳 앞과 서측 출구까지 구역별 일방통행을 안내합니다. 서로 연결되지 않은 구역은 안내를 중지하고 확인된 출발점 변경을 제공합니다.',
      '동탄 원본의 치수선으로 축척을 보정하고 벽·난간 48개를 주석했습니다. PS 설비 샤프트와 남측 승강기 위치를 교정했습니다.',
      '대천항 원본의 벽 62개·유리면 10개·문 개구부를 주석했습니다. 도로 경계 점선을 벽에서 제외하고 원본 축척 막대를 적용했습니다.',
      '실제 대천항 구획에서 기본 차량의 후진·전진 재정렬, 회전반경·전체 차체·옆 구획 침범, 기어 전환 정지와 후진 속도를 검증했습니다. 주차 방식 선택과 Worker 계산 취소를 제공합니다.',
      '창동 B2의 원본 램프를 높이 있는 주행 경로에 연결했습니다. 3.3m 높이 가정을 표시하며 경사 제한·양방향 주행·수동 높이 추종을 검사합니다. 층간 이동 후 상층 주차는 별도의 합성 도면으로 검증했습니다.',
      '계단·문·출구·승강기·경사로의 색상을 구분하고 문틀·손잡이·열림 궤적과 출구 표지를 추가했습니다. 동탄 계단 출입문 4곳과 층별 보기·모바일 조작을 확인합니다.',
      '변환·경로·전파·후보 제외 규칙과 실제 Chrome의 재질·차량·모바일·내보내기 동작을 검증합니다. 화면 기준 갱신 후 업데이트 옵션 없이 별도로 비교합니다.',
    ],openItems:[
      '전파 점수는 공개 송신 제원에 가정 손실을 적용한 추정 수신전력입니다. RSRP 실측·현재 가동 여부·전원 용량·현장 설치 허용은 확인되지 않았습니다.',
      '63장 모두의 의미 오브젝트가 완전하게 해석된 것은 아닙니다. 실제 주차 구획은 4장, 동북권 B2는 원본 기재 121면 중 101면을 주석했으며 나머지는 원본과 OCR로 제공합니다.',
      '대천항·동탄은 주차면 앞 안내와 조건에 맞는 구획 내부 조작을 제공합니다. 동탄은 차량 상층 도면이 없어 층간 차로를 연결하지 않았습니다. 현재 게이트 운영은 미확인입니다.',
      '주차 조작은 도면 기반 제한 탐색입니다. 경로 미발견은 실제 주차 불가능 판정이 아닙니다. 현장 측량·실제 점유·정밀 차량 동역학은 미반영입니다.',
      'Google Maps 실제 계정 인증과 3D 오버레이는 API 설정이 없어 실서비스 검증되지 않았습니다.',
      'Kakao 로드뷰는 키 미설정 상태입니다. 네이버 좌표가 포함된 서울시 공개 페이지의 사진은 확보·반영했습니다.',
      '창동 B2 램프 높이 3.3m·유효 높이 2.4m와 문 열림 각도는 미리보기 가정입니다. 상층 전체 도면·외부 도로 연결·EV 설치 위치·지상 대피소는 미확인입니다.',
      '명시적인 차로 레이어는 교차점·주차 목적지 그래프를 자동 생성합니다. 일반 이미지/PDF는 구조선·반복 주차 구획 후보와 보관된 OCR을 제공합니다. 의미 레이어 없는 원본에서 진입점·안전 출구·차로 그래프를 자동 확정하지 않습니다.',
      '사진 기반 외관은 관찰한 색상과 층 구성의 개념 모델입니다. OSM 윤곽과 공개 층수는 반영했으나 정밀한 사진측량 복원 모델은 아닙니다.',
    ]};
    report.python=python;
    report.changes.push(`${inventory.pythonAnalyzedDrawings}장 전체를 Python/OpenCV로 원본 해상도에서 흑백·대비 보정하고 ${inventory.analysisTiles}개 겹침 타일로 분석했습니다. 원본 좌표·병합 구조선·타일별 PNG와 해시를 보존합니다.`);
    report.changes.push('전체 도면 인식 결과에서 원본 컬러·흑백·이진화·검출선을 전환하고 타일을 확대할 수 있습니다. 검토된 벽 주석·차로는 유지하고 공원·단지 배치도를 건물 벽으로 변환하지 않습니다.');
    report.changes.push('원본을 대조해 평면도가 아닌 안내 문서 3장·주택 입체도 4장을 구분했습니다. 이 자료의 표·사진·투영선을 평면 벽체로 변환하지 않습니다.');
    await cp(path.join(project,'reports/vision.json'),path.join(dir,'vision.json')).catch(()=>{});
    for(const [from,to] of [['reports/unit.json','unit.json'],['reports/e2e.json','e2e.json'],['reports/coverage','coverage'],['tests/e2e/golden','golden'],['test-results','browser-artifacts']])try{await cp(path.join(project,from),path.join(dir,to),{recursive:true});}catch{}
    report.sourceBefore=sourceBefore;
    if(sourceBefore!==report.sourceDigest){report.status='failed';report.changes.push('검증 도중 입력이 변경되어 현재 소스 검증으로 인정하지 않습니다. 다음 회차에서 다시 검증합니다.');}
    const html=page(report);await writeFile(path.join(reports,`report_${id}.html`),html);await atomic(path.join(reports,'index.html'),html);await atomic(path.join(reports,'latest.json'),JSON.stringify(report,null,2)+'\n');await writeFile(path.join(dir,'result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`\n${report.status}: /reports/map_new/report_${id}.html`);
    if(report.status==='passed'&&checkpoint)try{await checkpointResult(id);}catch(e){console.error(e.message);await writeFile(path.join(runtime,'checkpoint-error.txt'),e.message);}
    if(!watch&&report.status!=='passed')process.exitCode=1;
  }finally{await lock.close();await rm(path.join(runtime,'verify.lock'),{force:true});}
}
let busy=false,last,timer;
async function check(){if(busy)return;busy=true;try{const digest=await sourceDigest();if(digest!==last){await verify();last=digest;}}catch(e){console.error(e);if(!watch)process.exitCode=1;}finally{busy=false;}}
if(watch){
  const existing=await readJson(path.join(runtime,'heartbeat.json'));
  if(existing?.pid&&existing.pid!==process.pid){let alive=false;try{process.kill(existing.pid,0);alive=true;}catch{}if(alive&&Date.now()-Date.parse(existing.at)<30000){console.log('An ATLAS watcher is already alive.');process.exit(0);}}
  const beat=()=>atomic(path.join(runtime,'heartbeat.json'),JSON.stringify({pid:process.pid,at:new Date().toISOString(),busy}));await beat();timer=setInterval(()=>{beat().catch(console.error);if(!stopping)check();},10000);
  const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);activeChild?.kill('SIGTERM');if(!busy)process.exit(0);else{const exit=setInterval(()=>{if(!busy){clearInterval(exit);process.exit(0);}},200);}};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);console.log('ATLAS verification watcher running; rechecks changed inputs every 10 seconds.');
}
await check();
