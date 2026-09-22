const details={
 dopamin:{title:['도파민','범퍼카'],duration:18,features:['레이싱 · 실시간 순위','우승 시상식 · 트로피','커피차 · 커피 나누기'],segments:[{id:'race',name:'레이싱',start:0,end:6},{id:'podium',name:'우승 시상식',start:6,end:11},{id:'coffee',name:'커피차',start:11,end:18}],note:'실제 한 경기의 레이싱 → 시상식 → 커피차 · 샘플 레이서'},
 movie:{title:['스타라이트','시네마'],features:['영화 재생','챕터별 장면 이동'],note:'실제 플레이어 · 파크 탄생 영상 재생'},
 voice:{title:['매직 보이스','스테이지'],features:['호출어 인식','음성 명령 수집','실행 전 확인'],note:'합성 음성 파일의 실제 인식 기록 · 실행은 연습 모드'},
 battery_health:{title:['EVision','피트 스톱'],features:['3D 차량 · 배터리 투시','배터리 건강 상태','충전 이력 확인'],note:'실제 앱 조작 · 예시 차량 데이터'},
 map:{title:['아틀라스','설계 연구소'],features:['공개 원본 도면','구조선의 3D 변환','입체 공간 회전 탐색'],note:'공사 중 · 추정 구조선과 축척을 사용하는 미리보기'},
 map_new:{title:['아틀라스','주차 내비게이션'],duration:24,features:['원본 도면 → 3D 공간','도로 → 주차면 진입','충전기 설치 후보 비교','화재 우회 경로'],segments:[{id:'drawing',name:'원본 도면 → 3D',start:0,end:5},{id:'parking',name:'주차면까지 주행',start:5,end:13},{id:'charging',name:'충전기 설치 후보',start:13,end:19},{id:'evacuation',name:'화재 우회',start:19,end:24}],notes:{drawing:'공개 건축 도면 기반 3D 미리보기 · 신내소행주 너나들이',parking:'공개 도면 · OSM 도로 기반 경로 미리보기 · 소형차 1.7 × 4.1m · 현장 실측 전',charging:'공개 기지국 데이터 기반 설치 후보 비교 · 추정 수신전력 · 현장 검토 필요',evacuation:'합성 시험장 · 서측 화재를 피해 동측 옥외 집결지로 이동'}},
 pinball:{title:['럭키 핀볼','어드벤처'],features:['공의 물리 시뮬레이션','움직이는 놀이기구','재생 속도 전환'],note:'실제 게임 플레이 · 샘플 참가자'},
 trading:{title:['휴가','거래소'],features:['실시간 호가 확인','휴가 지정가 주문','주문 체결 · 잔고 갱신'],note:'실제 로컬 거래 엔진 · 촬영 전용 모의 데이터'},
};
const videos=new Map();let voice;
export async function loadDemos(items){
 await Promise.all(items.map(async item=>{
  if(item.id==='voice'){const r=await fetch(new URL('./assets/tour-demo/voice-session.json',import.meta.url));if(!r.ok)throw Error('Voice recording unavailable');voice=await r.json();return;}
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
  await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error(`Demo video unavailable: ${item.id}`)),{once:true});video.src=new URL(`./assets/tour-demo/${item.id}.mp4`,import.meta.url).href;video.load();});
  if(Math.abs(video.duration-(details[item.id].duration||6))>.1)throw Error(`Incomplete demo: ${item.id}`);videos.set(item.id,video);
 }));
 return details;
}
export async function paintDemo(ctx,shot,local){
 const d=details[shot.id],length=d.duration||6,time=Math.max(0,Math.min(length-.05,local));
 const segment=d.segments?.find(s=>time>=s.start&&time<s.end);
 const text=(s,x,y,size=28,color='#fff9ed',weight=500)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Apple SD Gothic Neo", Arial, sans-serif`;ctx.fillText(s,x,y);};
 ctx.fillStyle='#081625';ctx.fillRect(0,0,1920,1080);
 const light=ctx.createRadialGradient(1270,290,0,1270,290,1100);light.addColorStop(0,'#1c405b90');light.addColorStop(1,'#0a172300');ctx.fillStyle=light;ctx.fillRect(0,0,1920,1080);
 text('EXPERIENCE IN ACTION',76,184,15,'#efd09a',600);
 d.title.forEach((line,i)=>text(line,74,270+i*58,shot.id==='map_new'?39:45,'#fff9ed',650));
 ctx.fillStyle=shot.color;ctx.fillRect(76,377,54,4);
 d.features.forEach((label,i)=>{
  const active=d.segments?time>=d.segments[i].start:Math.min(d.features.length-1,Math.floor(time/(length/d.features.length)))>=i;
  text(String(i+1).padStart(2,'0'),76,457+i*100,16,active?'#efd09a':'#537086',600);
  text(label,76,493+i*100,24,active?'#fff9ed':'#83a1b4',500);
 });
 text(segment?.name||'실제 기능 시연',76,963,22,'#efd09a');
 const x=430,y=140,w=1410,h=881.25;
 ctx.fillStyle='#020912';ctx.fillRect(x-1,y-1,w+2,h+2);
 if(shot.id==='voice'){
  ctx.fillStyle='#0a1020';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#172238';ctx.fillRect(x,y,w,64);['#ef817f','#e8c773','#91bf9e'].forEach((c,i)=>{ctx.beginPath();ctx.fillStyle=c;ctx.arc(x+28+i*26,y+31,7,0,Math.PI*2);ctx.fill();});
  text('TBD VOICE  /  실제 음성 인식 세션',x+145,y+40,23,'#b4c5d5');
  text('APPLE SPEECH → VOICE CONTROLLER',x+48,y+130,22,'#90b2c9',600);
  const rec=voice.events.filter(e=>e.type==='recognized'),lines=[
   [0,'01  호출어',rec[0]?.value,'듣기 상태로 전환'],
   [1.7,'02  음성 명령',voice.submitted,'인식된 문장을 명령 버퍼에 저장'],
   [3.5,'03  시작어',rec.at(-1)?.value,'연습 모드 · 실행 전 확인 완료'],
  ];
  for(const [at,label,value,sub] of lines)if(time>=at){const i=lines.findIndex(l=>l[0]===at),py=y+210+i*184;ctx.globalAlpha=Math.min(1,(time-at)*5);text(label,x+48,py,22,'#efd09a',650);text(value,x+48,py+56,36,'#eaf5ff',500);text(sub,x+48,py+101,22,'#8bbca4');ctx.globalAlpha=1;}
  text('인식 입력: 로컬 합성 음성 파일  /  Codex·Warp 실행 없음',x+48,y+h-41,21,'#93a7bd');
 }else{
  const video=videos.get(shot.id);
  if(Math.abs(video.currentTime-time)>.012)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`Seek timeout: ${shot.id}`)),10000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});video.currentTime=time;});
  ctx.drawImage(video,x,y,w,h);
 }
 ctx.strokeStyle='#abc9d845';ctx.lineWidth=1;ctx.strokeRect(x-.5,y-.5,w+1,h+1);
 text(d.notes?.[segment?.id]||d.note,x,1060,19,'#a4b8ca');
 return {kind:shot.id==='voice'?'actual-speech-session':'browser-recording',time,segment:segment?.id,features:d.features};
}
