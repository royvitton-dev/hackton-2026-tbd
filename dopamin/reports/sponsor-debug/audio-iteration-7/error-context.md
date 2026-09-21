# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audio.spec.ts >> BGM produces real audio, obeys mute/pause/recording and remembers the setting
- Location: tests/e2e/audio.spec.ts:23:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 0.0001
Received:   0.010761458426713943

Call Log:
- Timeout 12000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - button "BREW RACERS 홈" [ref=e6] [cursor=pointer]:
        - generic [ref=e15]:
          - text: BREW
          - generic [ref=e16]:
            - text: RACERS
            - generic [ref=e17]: ®
      - navigation "메인 메뉴" [ref=e18]:
        - button "레이스 로비" [ref=e19] [cursor=pointer]
        - button "리플레이 01" [ref=e20] [cursor=pointer]:
          - text: 리플레이
          - generic [ref=e21]: "01"
        - button "플레이 가이드 ↗" [ref=e22] [cursor=pointer]
      - generic [ref=e23]:
        - generic [ref=e24]: LOCAL PLAY
        - button "사운드 켜기" [active] [ref=e27] [cursor=pointer]
        - button "도움말" [ref=e32] [cursor=pointer]
  - main [ref=e36]:
    - generic [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]: A LITTLE RACE. A LOT AT STAKE.
        - heading "오늘 커피는, 누가 쏠까? ✳" [level=1] [ref=e41]:
          - text: 오늘 커피는, 누가 쏠까?
          - generic [ref=e42]: ✳
        - paragraph [ref=e43]: 목소리로 입장하고, 운명은 트랙에 맡기세요. 꼴찌가 쏘는 커피는 더 달콤하니까!
      - paragraph [ref=e46]:
        - text: 친구들과 가볍게.
        - strong [ref=e47]: 커피 내기는 짜릿하게.
    - generic [ref=e48]:
      - region "트랙 미리보기" [ref=e49]:
        - generic:
          - generic: LIVE TRACK PREVIEW
          - generic: 01 / 06
        - img "로스터리 서킷 3D 레이싱 트랙 · GS차지비, GS그룹, GS칼텍스, GS리테일, GS건설, GS에너지, GS EPS, GS글로벌 광고 배너" [ref=e51]
        - generic [ref=e52]:
          - generic [ref=e53]: 100%
          - generic [ref=e54]: AUTO RACING응원만 준비하세요.
        - generic:
          - generic:
            - generic: ROASTERY CIRCUIT
            - heading "로스터리 서킷 LV. 1" [level=2]:
              - text: 로스터리 서킷
              - generic: LV. 1
            - paragraph: 커피 향을 따라, 가볍게 한 바퀴.
          - generic:
            - generic: 2 LAPS
            - generic: 약 1분
      - complementary [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]: "01"
          - text: SELECT YOUR TRACK
        - heading "어디서 달려볼까요?" [level=2] [ref=e61]
        - paragraph [ref=e62]: 취향대로 고르는 6가지 작은 모험.
        - generic [ref=e63]:
          - button "로스터리 서킷 난이도 1" [pressed] [ref=e64] [cursor=pointer]:
            - strong [ref=e72]: 로스터리 서킷
            - generic [ref=e73]: LV.1
          - button "선셋 비치 난이도 2" [ref=e81] [cursor=pointer]:
            - strong [ref=e90]: 선셋 비치
            - generic [ref=e91]: LV.2
          - button "말차 포레스트 난이도 3" [ref=e99] [cursor=pointer]:
            - strong [ref=e107]: 말차 포레스트
            - generic [ref=e108]: LV.3
          - button "미드나잇 시티 난이도 4" [ref=e116] [cursor=pointer]:
            - strong [ref=e125]: 미드나잇 시티
            - generic [ref=e126]: LV.4
          - button "슈가 마운틴 난이도 5" [ref=e134] [cursor=pointer]:
            - strong [ref=e141]: 슈가 마운틴
            - generic [ref=e142]: LV.5
          - button "에스프레소 볼케이노 난이도 6" [ref=e150] [cursor=pointer]:
            - strong [ref=e157]: 에스프레소 볼케이노
            - generic [ref=e158]: LV.6
        - generic [ref=e170]:
          - strong [ref=e171]: 발은 쉬고, 심장은 바쁘게.
          - paragraph [ref=e172]: 주행도 아이템도 알아서. 100% 자동 레이스.
    - generic [ref=e173]:
      - generic [ref=e174]:
        - generic [ref=e175]:
          - generic [ref=e176]:
            - generic [ref=e177]: "02"
            - text: MEET THE RACERS
          - heading "함께 달릴 멤버 4/ 8" [level=2] [ref=e178]:
            - text: 함께 달릴 멤버
            - generic [ref=e179]: 4/ 8
        - generic [ref=e180]:
          - button "체험 멤버 비우기" [ref=e181] [cursor=pointer]
          - button "음료 말하기" [ref=e182] [cursor=pointer]
          - button "레이서 추가" [ref=e186] [cursor=pointer]
      - generic [ref=e188]:
        - button "김커피 프로필 수정" [ref=e189] [cursor=pointer]:
          - generic [ref=e190]: "01"
          - generic [ref=e191]: READY
          - generic [ref=e193]:
            - img "마리오 3D 얼굴 아바타" [ref=e195]
            - generic [ref=e196]:
              - heading "김커피" [level=3] [ref=e197]
              - generic [ref=e200]: 마리오
              - generic [ref=e201]: 공유 무드
              - paragraph [ref=e203]: 아이스 아메리카노
          - generic [ref=e206]:
            - generic [ref=e207]: TANGERINE KART
            - generic [ref=e209]: 체험 레이서
        - button "라떼러버 프로필 수정" [ref=e210] [cursor=pointer]:
          - generic [ref=e211]: "02"
          - generic [ref=e212]: READY
          - generic [ref=e214]:
            - img "키노피오 3D 얼굴 아바타" [ref=e216]
            - generic [ref=e217]:
              - heading "라떼러버" [level=3] [ref=e218]
              - generic [ref=e221]: 키노피오
              - generic [ref=e222]: 아이유 무드
              - paragraph [ref=e224]: 카페 라떼
          - generic [ref=e227]:
            - generic [ref=e228]: LAVENDER KART
            - generic [ref=e230]: 체험 레이서
        - button "샷추가 프로필 수정" [ref=e231] [cursor=pointer]:
          - generic [ref=e232]: "03"
          - generic [ref=e233]: READY
          - generic [ref=e235]:
            - img "피치 3D 얼굴 아바타" [ref=e237]
            - generic [ref=e238]:
              - heading "샷추가" [level=3] [ref=e239]
              - generic [ref=e242]: 피치
              - generic [ref=e243]: 박서준 무드
              - paragraph [ref=e245]: 콜드브루
          - generic [ref=e248]:
            - generic [ref=e249]: MATCHA KART
            - generic [ref=e251]: 체험 레이서
        - button "말차사랑 프로필 수정" [ref=e252] [cursor=pointer]:
          - generic [ref=e253]: "04"
          - generic [ref=e254]: READY
          - generic [ref=e256]:
            - img "동키콩 3D 얼굴 아바타" [ref=e258]
            - generic [ref=e259]:
              - heading "말차사랑" [level=3] [ref=e260]
              - generic [ref=e263]: 동키콩
              - generic [ref=e264]: 박보영 무드
              - paragraph [ref=e266]: 말차 라떼
          - generic [ref=e269]:
            - generic [ref=e270]: BUTTER KART
            - generic [ref=e272]: 체험 레이서
      - generic [ref=e273]:
        - generic [ref=e277]: 목소리와 프로필은 이 기기에 저장돼요.
        - generic [ref=e278]: ·
        - generic [ref=e279]: 아바타를 누르면 프로필과 음료를 바꿀 수 있어요.
    - generic [ref=e280]:
      - generic [ref=e286]:
        - strong [ref=e287]: 마지막으로 들어오는 사람이, 오늘의 커피 히어로.
        - paragraph [ref=e288]:
          - generic [ref=e289]: 2바퀴 자동 주행
          - generic [ref=e291]: 랜덤 아이템
          - generic [ref=e293]: 꼴찌가 커피 쏘기
      - generic [ref=e294]:
        - generic [ref=e295]:
          - generic [ref=e296]: 4명
          - text: 모두 준비 완료!
        - button "레이스 시작" [ref=e297] [cursor=pointer]
    - generic [ref=e300]: 아이템 한 방이면 순위는 뒤집힌다. 오늘의 행운을 믿어보세요.
  - contentinfo [ref=e303]:
    - generic [ref=e304]:
      - text: BREW RACERS
      - generic [ref=e307]: 작은 내기, 큰 즐거움.
    - generic [ref=e308]:
      - text: MADE FOR YOUR COFFEE BREAK
      - generic [ref=e309]: ✳
      - button "플레이 가이드" [ref=e310] [cursor=pointer]
      - link "검증 리포트 ↗" [ref=e311] [cursor=pointer]:
        - /url: /reports/index.html
      - generic [ref=e312]: © 2026 BREW RACERS
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | import fs from 'node:fs/promises';
  3  | import { createHash } from 'node:crypto';
  4  | import { loadReplay, seek } from './replay';
  5  | 
  6  | async function installAudioProbe(page:Page){
  7  |   await page.addInitScript(()=>{
  8  |     const probes:AnalyserNode[]=[];const original=AudioNode.prototype.connect;
  9  |     AudioNode.prototype.connect=function(destination:AudioNode|AudioParam,...args:number[]){
  10 |       if(destination instanceof AudioDestinationNode){
  11 |         const analyser=this.context.createAnalyser();analyser.fftSize=2048;probes.push(analyser);
  12 |         Reflect.apply(original,this,[analyser]);return Reflect.apply(original,analyser,[destination]);
  13 |       }
  14 |       return Reflect.apply(original,this,[destination,...args]);
  15 |     } as typeof original;
  16 |     (window as unknown as {audioLevel:()=>number}).audioLevel=()=>{
  17 |       let peak=0;for(const analyser of probes){const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);for(const value of data)peak=Math.max(peak,Math.abs(value));}return peak;
  18 |     };
  19 |   });
  20 | }
  21 | const level=(page:Page)=>page.evaluate(()=>(window as unknown as {audioLevel:()=>number}).audioLevel());
  22 | 
  23 | test('BGM produces real audio, obeys mute/pause/recording and remembers the setting',async({page})=>{
  24 |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await installAudioProbe(page);await loadReplay(page);await seek(page,5.1);
  25 |   await expect.poll(()=>level(page)).toBeLessThan(.0001);
  26 |   await page.getByRole('button',{name:'재생',exact:true}).click();await expect.poll(()=>level(page),{timeout:5000}).toBeGreaterThan(.005);
  27 |   await page.getByRole('button',{name:'일시 정지',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  28 |   await page.getByRole('button',{name:'BREW RACERS 홈'}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);
  29 |   await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  30 |   await page.getByRole('button',{name:'닫기',exact:true}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);
> 31 |   await page.getByRole('button',{name:'사운드 끄기',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
     |                                                                                                        ^ Error: expect(received).toBeLessThan(expected)
  32 |   await page.reload();await expect(page.getByRole('button',{name:'사운드 켜기',exact:true})).toBeVisible();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  33 |   await page.getByRole('button',{name:'사운드 켜기',exact:true}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);expect(errors).toEqual([]);
  34 | });
  35 | 
  36 | test('renders non-silent unclipped music and distinct item samples through real Web Audio',async({page},testInfo)=>{
  37 |   // This sample renderer imports source modules and requires the development server.
  38 |   await page.goto(process.env.AUDIO_TEST_URL||'http://127.0.0.1:5173');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');
  39 |   const samples=await page.evaluate(async()=>{
  40 |     const scorePath='/src/audio/music.ts',synthPath='/src/audio/synth.ts',effectsPath='/src/audio/effects.ts';
  41 |     const {createScore}=await import(scorePath),{Synth}=await import(synthPath),{scheduleItemSound}=await import(effectsPath);
  42 |     const output:{name:string;rms:number;peak:number;wav:string}[]=[];
  43 |     for(const name of ['lobby','race','results','launch-bean','hit-bean','hit-ice','hit-storm','blocked-bean','item-boost','item-shield']){
  44 |       const isMusic=!name.includes('-'),score=isMusic?createScore(name):null,duration=score?score.steps*60/score.bpm/4:1.2;
  45 |       const context=new OfflineAudioContext(2,Math.ceil(duration*24000),24000),synth=new Synth(context);
  46 |       if(score)for(const note of score.notes)synth.note(note.instrument,note.midi,note.step*60/score.bpm/4,note.length*60/score.bpm/4,note.velocity);
  47 |       else{const [type,item]=name.split('-');scheduleItemSound(synth,{type,item,time:0,actor:'a',target:'b'},.02);}
  48 |       const buffer=await context.startRendering(),left=buffer.getChannelData(0),right=buffer.getChannelData(1);let squares=0,peak=0;
  49 |       const wav=new ArrayBuffer(44+buffer.length*4),view=new DataView(wav),str=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  50 |       str(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,24000,true);view.setUint32(28,96000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,buffer.length*4,true);
  51 |       for(let i=0;i<buffer.length;i++)for(let c=0;c<2;c++){const value=(c?right:left)[i];squares+=value*value;peak=Math.max(peak,Math.abs(value));view.setInt16(44+i*4+c*2,Math.max(-32768,Math.min(32767,Math.round(value*32767))),true);}
  52 |       let binary='';const bytes=new Uint8Array(wav);for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  53 |       output.push({name,rms:Math.sqrt(squares/(buffer.length*2)),peak,wav:btoa(binary)});synth.dispose();
  54 |     }
  55 |     return output;
  56 |   });
  57 |   await fs.mkdir('reports/audio/samples',{recursive:true});
  58 |   for(const sample of samples){expect(sample.rms).toBeGreaterThan(.002);expect(sample.peak).toBeLessThan(.98);await fs.writeFile(`reports/audio/samples/${sample.name}.wav`,Buffer.from(sample.wav,'base64'));}
  59 |   const stats=samples.map(({name,rms,peak})=>({name,rms,peak}));expect(new Set(samples.map(s=>createHash('sha256').update(Buffer.from(s.wav,'base64').subarray(44)).digest('hex'))).size).toBe(samples.length);
  60 |   await fs.writeFile('reports/audio/levels.json',JSON.stringify(stats,null,2));await testInfo.attach('real-web-audio-levels',{body:JSON.stringify(stats),contentType:'application/json'});
  61 | });
  62 | 
```