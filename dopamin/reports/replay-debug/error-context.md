# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> replays launch, impact, block and boost effects with deterministic pause and seeking
- Location: tests/e2e/app.spec.ts:84:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "e75bf7aa0a1ab99829643d91134758f8c6b93a8489aad63dfb9e5a85957829b3"
Received: "2e637de5c26297fa53ff1e89f60dca58c224d59dd249deb1dc05d4e2cd5a6eab"
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
        - button "사운드 켜기" [ref=e27] [cursor=pointer]
        - button "도움말" [ref=e32] [cursor=pointer]
  - main [ref=e36]:
    - generic [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]: A LITTLE RACE. A LOT AT STAKE.
        - heading "커피 한 잔을 건, 한판 승부." [level=1] [ref=e41]
        - paragraph [ref=e42]: 운전은 카트에게, 응원은 우리에게. 마지막 코너까지 아무도 몰라요.
      - paragraph [ref=e45]:
        - text: 친구들과 가볍게.
        - strong [ref=e46]: 커피 내기는 짜릿하게.
    - region "레이스 화면" [ref=e47]:
      - img "로스터리 서킷 3D 레이싱 트랙" [ref=e49]
      - generic:
        - generic: RACE REPLAY
        - generic: 로스터리 서킷
        - generic: LAP 1 / 2
        - generic: 00:21.0
      - generic [ref=e50]:
        - generic [ref=e51]: LIVE STANDINGS
        - button "샷추가 카메라 보기" [ref=e58] [cursor=pointer]:
          - generic [ref=e59]: "1"
          - generic [ref=e61]: 샷추가
          - generic [ref=e62]: ◈
        - button "말차사랑 카메라 보기" [ref=e63] [cursor=pointer]:
          - generic [ref=e64]: "2"
          - generic [ref=e66]: 말차사랑
          - generic [ref=e67]: "132"
        - button "라떼러버 카메라 보기" [ref=e68] [cursor=pointer]:
          - generic [ref=e69]: "3"
          - generic [ref=e71]: 라떼러버
          - generic [ref=e72]: ❄
        - button "김커피 카메라 보기" [ref=e73] [cursor=pointer]:
          - generic [ref=e74]: "4"
          - generic [ref=e76]: 김커피
          - generic [ref=e77]: "132"
        - generic [ref=e78]: 레이서를 눌러 카메라 전환
      - generic:
        - generic: 김커피 → 라떼러버 얼음!
        - generic: 말차사랑 → 샷추가 원두탄!
        - generic: 샷추가 → 라떼러버 원두탄!
      - generic:
        - generic:
          - generic: IMPACT CAM
          - strong: DIRECT HIT!
          - generic: 아이스 큐브 · 김커피 → 라떼러버
        - generic:
          - generic: INCOMING
          - generic: ❄
          - generic: 얼음
        - generic "실시간 트랙 위치":
          - img "레이서 위치 지도"
          - text: ROUTE / 2 LAPS
        - generic:
          - generic: 3RD
          - generic: 라떼러버
          - generic: 106KM/H
      - generic [ref=e79]: 1인칭 · 피격 시점
    - generic [ref=e81]:
      - button "재생" [ref=e82] [cursor=pointer]
      - generic [ref=e85]: 00:21.0
      - slider "리플레이 타임라인" [active] [ref=e86] [cursor=pointer]: "21"
      - generic [ref=e87]: 00:48.9
      - button "재생 속도 1배" [ref=e88] [cursor=pointer]: 1×
      - button "전체 트랙 보기" [ref=e90] [cursor=pointer]
      - button "레이스 로그" [ref=e96] [cursor=pointer]
    - generic [ref=e101]:
      - generic [ref=e102]: 모든 주행과 아이템은 자동으로 진행돼요. 레이스 로그는 종료 후 저장됩니다.
      - button "로비로 돌아가기" [ref=e106] [cursor=pointer]
  - contentinfo [ref=e109]:
    - generic [ref=e110]:
      - text: BREW RACERS
      - generic [ref=e113]: 작은 내기, 큰 즐거움.
    - generic [ref=e114]:
      - text: MADE FOR YOUR COFFEE BREAK
      - generic [ref=e115]: ✳
      - button "플레이 가이드" [ref=e116] [cursor=pointer]
      - link "검증 리포트 ↗" [ref=e117] [cursor=pointer]:
        - /url: /reports/index.html
      - generic [ref=e118]: © 2026 BREW RACERS
```

# Test source

```ts
  1   | import { createHash } from 'node:crypto';
  2   | import { createRequire } from 'node:module';
  3   | const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as { PNG: { sync: { read: (buffer:Buffer)=>{width:number;height:number;data:Buffer} } } };
  4   | import { test, expect, type Page } from '@playwright/test';
  5   | import { TRACKS } from '../../src/core/catalog';
  6   | 
  7   | async function ready(page:Page){await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeEnabled();}
  8   | async function addManual(page:Page,name:string){await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('별명').fill(name);await page.getByRole('button',{name:'레이서 등록',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  9   | 
  10  | test('renders WebGL, all six tracks and responsive lobby without console errors',async({page})=>{
  11  |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  12  |   await expect(page.locator('.driver-card')).toHaveCount(4);await expect(page.locator('canvas')).toHaveCount(1);
  13  |   for(const track of TRACKS){await page.getByRole('button',{name:`${track.name} 난이도 ${track.level}`}).click();await expect(page.locator('.showcase-bottom h2')).toContainText(track.name);await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');}
  14  |   await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  15  |   await expect(page.getByRole('button',{name:'레이스 시작',exact:true})).toBeEnabled();expect(errors).toEqual([]);
  16  | });
  17  | 
  18  | test('registers up to eight racers, rejects duplicate names, persists and deletes profiles',async({page})=>{
  19  |   await ready(page);await page.getByRole('button',{name:'체험 멤버 비우기'}).click();await expect(page.getByRole('button',{name:'레이스 시작',exact:true})).toBeDisabled();
  20  |   for(let i=1;i<=8;i++)await addManual(page,`레이서${i}`);
  21  |   await expect(page.locator('.driver-card')).toHaveCount(8);await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeDisabled();
  22  |   await page.reload();await expect(page.locator('.driver-card')).toHaveCount(8);
  23  |   await page.getByRole('button',{name:'레이서8 프로필 수정'}).click();await page.getByLabel('별명').fill('레이서1');await page.getByRole('button',{name:'변경 저장'}).click();await expect(page.getByRole('alert')).toContainText('이미 등록');
  24  |   await page.getByRole('button',{name:'레이서 삭제'}).click();await expect(page.locator('.driver-card')).toHaveCount(7);await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeEnabled();
  25  | });
  26  | 
  27  | test('handles denied microphone permissions and supports manual order entry',async({page})=>{
  28  |   await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('Permission denied','NotAllowedError');}});});
  29  |   await ready(page);await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('alert')).toContainText('마이크 권한');
  30  |   await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('별명').fill('수동참여');await page.getByRole('button',{name:'레이서 등록',exact:true}).click();
  31  |   await page.getByRole('button',{name:'음료 말하기',exact:true}).click();await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('주문할 레이서').selectOption({label:'수동참여'});await page.getByLabel('오늘 마실 음료').selectOption('바닐라 라떼');await page.getByRole('button',{name:'음료 주문 완료'}).click();await expect(page.getByRole('button',{name:'수동참여 프로필 수정'})).toContainText('바닐라 라떼');
  32  | });
  33  | 
  34  | test('records audio, transcribes nickname, identifies the same local voice and saves its drink',async({page})=>{
  35  |   await page.addInitScript(()=>{
  36  |     Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
  37  |       const audio=new AudioContext();await audio.resume();const destination=audio.createMediaStreamDestination(),oscillator=audio.createOscillator(),gain=audio.createGain();
  38  |       oscillator.frequency.value=150;oscillator.type='sawtooth';gain.gain.value=.3;oscillator.connect(gain);gain.connect(destination);oscillator.start();
  39  |       const track=destination.stream.getAudioTracks()[0],originalStop=track.stop.bind(track);track.stop=()=>{oscillator.stop();void audio.close();originalStop();};return destination.stream;
  40  |     }});
  41  |     class FakeSpeech {
  42  |       lang='';continuous=true;interimResults=true;onresult:((e:unknown)=>void)|null=null;onerror=null;
  43  |       start(){setTimeout(()=>this.onresult?.({results:[{0:{transcript:(window as unknown as {orderTest?:boolean}).orderTest?'카페 라떼 마실게요':'제 별명은 보이스왕입니다'},isFinal:true}],resultIndex:0}),250);}
  44  |       stop(){} abort(){}
  45  |     }
  46  |     (window as unknown as {SpeechRecognition:typeof FakeSpeech}).SpeechRecognition=FakeSpeech;
  47  |   });
  48  |   await ready(page);await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('button',{name:'녹음 완료',exact:true})).toBeEnabled();await page.waitForTimeout(3500);await page.getByRole('button',{name:'녹음 완료',exact:true}).click();await expect(page.getByLabel('별명')).toHaveValue('보이스왕');await page.getByRole('button',{name:'레이서 등록',exact:true}).click();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('VOICE SAVED');
  49  |   await page.evaluate(()=>{(window as unknown as {orderTest:boolean}).orderTest=true;});
  50  |   await page.getByRole('button',{name:'음료 말하기',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('button',{name:'녹음 완료',exact:true})).toBeEnabled();await page.waitForTimeout(3500);await page.getByRole('button',{name:'녹음 완료',exact:true}).click();await expect(page.getByText('목소리를 찾았어요!',{exact:true})).toBeVisible();await expect(page.getByLabel('오늘 마실 음료')).toHaveValue('카페 라떼');await page.getByRole('button',{name:'음료 주문 완료'}).click();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('카페 라떼');
  51  |   await page.reload();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('VOICE SAVED');
  52  |   await page.getByRole('button',{name:'보이스왕 프로필 수정'}).click();await page.getByRole('button',{name:'레이서 삭제'}).click();
  53  |   await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toHaveCount(0);
  54  |   const voices=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open('brew-racers');request.onsuccess=()=>{const db=request.result,r=db.transaction('voices').objectStore('voices').count();r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>reject(r.error);};}));expect(voices).toBe(0);
  55  | });
  56  | 
  57  | test('runs two laps, celebrates last place, loops highlights, downloads and replays logs',async({page})=>{
  58  |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  59  |   await page.getByRole('button',{name:'레이스 시작',exact:true}).click();await expect(page.locator('.countdown')).toBeVisible();await expect(page.locator('.countdown')).toHaveCount(0);
  60  |   await page.getByRole('button',{name:'재생 속도 1배'}).click();await page.getByRole('button',{name:'재생 속도 2배'}).click();
  61  |   await expect(page.locator('.leaderboard')).toBeVisible();await page.getByRole('button',{name:'전체 트랙 보기'}).click();await expect(page.locator('.camera-badge')).toContainText('전체 트랙');await page.getByRole('button',{name:'팔로우 카메라'}).click();
  62  |   await page.getByRole('button',{name:'일시 정지',exact:true}).click();const before=await page.locator('.race-timer').textContent();await page.waitForTimeout(500);expect(await page.locator('.race-timer').textContent()).toBe(before);await page.getByRole('button',{name:'재생',exact:true}).click();
  63  |   await expect(page.locator('.winner-card')).toBeVisible({timeout:60000});await expect(page.locator('.winner-card h2')).toHaveText('달다 달아이썩겠네.');await expect(page.locator('.final-ranks>div')).toHaveCount(4);
  64  |   const hero=await page.locator('.winner-name').textContent(),last=await page.locator('.final-ranks>div').last().locator('strong').textContent();expect(hero).toContain(last!);
  65  |   const currentClip=await page.locator('.highlight-caption>span').textContent();await expect(page.locator('.highlight-caption>span')).not.toHaveText(currentClip!,{timeout:15000});
  66  |   await page.screenshot({path:'reports/screenshots/results.png',fullPage:true});
  67  |   const download=page.waitForEvent('download');await page.getByRole('button',{name:'레이스 로그',exact:true}).click();const downloaded=await download;await downloaded.saveAs('reports/replay-example.json');
  68  |   await page.getByRole('button',{name:'전체 리플레이',exact:true}).click();await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await page.getByRole('button',{name:'일시 정지',exact:true}).click();await page.getByRole('slider',{name:'리플레이 타임라인'}).fill('20');await expect(page.locator('.race-timer')).toContainText('00:20');
  69  |   await page.screenshot({path:'reports/screenshots/race.png',fullPage:true});await page.getByRole('button',{name:'BREW RACERS 홈'}).click();await page.getByRole('button',{name:/^리플레이/}).click();await expect(page.locator('.history-card')).toHaveCount(1);expect(errors).toEqual([]);
  70  | });
  71  | 
  72  | test('imports valid replay JSON and rejects corrupted files with a helpful message',async({page})=>{
  73  |   await ready(page);await page.getByRole('button',{name:/^리플레이/}).click();
  74  |   await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.getByRole('status')).toContainText('올바른 JSON');
  75  |   const {simulateRace}=await import('../../src/core/race'),{demoDrivers}=await import('../../src/core/catalog');const log=simulateRace(demoDrivers(),'forest',456,'2026-09-20T00:00:00Z');
  76  |   await page.locator('input[type=file]').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(log))});await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await expect(page.locator('.race-track-name')).toHaveText('말차 포레스트');
  77  | });
  78  | 
  79  | test('keyboard closes modal and keeps help reachable on a phone',async({page})=>{
  80  |   await ready(page);await page.getByRole('button',{name:'도움말',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  81  |   await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'플레이 가이드',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);await page.getByRole('button',{name:'닫기',exact:true}).click();
  82  | });
  83  | 
  84  | test('replays launch, impact, block and boost effects with deterministic pause and seeking',async({page},testInfo)=>{
  85  |   const {actionTime,loadReplay,seek}=await import('./replay');
  86  |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  87  |   await page.emulateMedia({reducedMotion:'no-preference'});await loadReplay(page);
  88  |   for(const phase of ['launch','hit','blocked','boost'] as const){
  89  |     await seek(page,actionTime(phase));await expect(page.locator('.race-hud')).toHaveAttribute('data-phase',phase);await expect(page.locator('.race-canvas')).toHaveAttribute('data-phase',phase);
  90  |     await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera',phase==='hit'?'first-person':'third-person');
  91  |     expect(Number(await page.locator('.race-canvas').getAttribute('data-particles'))).toBeGreaterThan(0);
  92  |   }
  93  |   await seek(page,actionTime('hit','ice'));const digest=(buffer:Buffer)=>createHash('sha256').update(buffer).digest('hex');const first=PNG.sync.read(await page.locator('.race-canvas').screenshot());
> 94  |   await page.waitForTimeout(300);expect(digest(PNG.sync.read(await page.locator('.race-canvas').screenshot()).data)).toBe(digest(first.data));
      |                                                                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  95  |   await seek(page,1);await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera','third-person');
  96  |   await seek(page,actionTime('hit','ice'));const returned=PNG.sync.read(await page.locator('.race-canvas').screenshot());
  97  |   expect([returned.width,returned.height]).toEqual([first.width,first.height]);
  98  |   let changed=0;for(let i=0;i<first.data.length;i+=4)if(Math.max(...[0,1,2,3].map(c=>Math.abs(first.data[i+c]-returned.data[i+c])))>2)changed++;
  99  |   const changedRatio=changed/(first.width*first.height);await testInfo.attach('replay-pixel-comparison',{body:JSON.stringify({changed,changedRatio,tolerance:.0001}),contentType:'application/json'});
  100 |   expect(changedRatio).toBeLessThanOrEqual(.0001);
  101 |   await page.getByRole('button',{name:'전체 트랙 보기'}).click();await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera','overview');
  102 |   await seek(page,5.1);await page.getByRole('button',{name:'사운드 켜기'}).click();await page.getByRole('button',{name:'재생',exact:true}).click();await page.waitForTimeout(1700);await page.getByRole('button',{name:'일시 정지',exact:true}).click();await page.getByRole('button',{name:'사운드 끄기'}).click();
  103 |   expect(errors).toEqual([]);
  104 | });
  105 | 
```