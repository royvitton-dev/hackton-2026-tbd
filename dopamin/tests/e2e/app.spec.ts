import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as { PNG: { sync: { read: (buffer:Buffer)=>{width:number;height:number;data:Buffer} } } };
import { test, expect, type Page } from '@playwright/test';
import { TRACKS } from '../../src/core/catalog';
import { VENUE_KINDS } from '../../src/graphics/sponsorVenues';

async function ready(page:Page){await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeEnabled();}
async function addManual(page:Page,name:string){await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('별명').fill(name);await page.getByRole('button',{name:'레이서 등록',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}

test('renders WebGL, all six tracks and responsive lobby without console errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  await expect(page.locator('.driver-card')).toHaveCount(4);await expect(page.locator('canvas')).toHaveCount(1);
  for(const track of TRACKS){await page.getByRole('button',{name:`${track.name} 난이도 ${track.level}`}).click();await expect(page.locator('.showcase-bottom h2')).toContainText(track.name);await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await expect(page.locator('.race-canvas')).toHaveAttribute('data-sponsors','GS차지비,GS그룹,GS칼텍스,GS리테일,GS건설,GS에너지,GS EPS,GS글로벌');await expect(page.locator('.race-canvas')).toHaveAttribute('data-sponsor-venue',VENUE_KINDS[track.id]);}
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'레이스 시작',exact:true})).toBeEnabled();expect(errors).toEqual([]);
});

test('registers up to eight racers, rejects duplicate names, persists and deletes profiles',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'체험 멤버 비우기'}).click();await expect(page.getByRole('button',{name:'레이스 시작',exact:true})).toBeDisabled();
  for(let i=1;i<=8;i++)await addManual(page,`레이서${i}`);
  await expect(page.locator('.driver-card')).toHaveCount(8);await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeDisabled();
  await page.reload();await expect(page.locator('.driver-card')).toHaveCount(8);
  await page.getByRole('button',{name:'레이서8 프로필 수정'}).click();await page.getByLabel('별명').fill('레이서1');await page.getByRole('button',{name:'변경 저장'}).click();await expect(page.getByRole('alert')).toContainText('이미 등록');
  await page.getByRole('button',{name:'레이서 삭제'}).click();await expect(page.locator('.driver-card')).toHaveCount(7);await expect(page.getByRole('button',{name:'레이서 추가',exact:true})).toBeEnabled();
});

test('handles denied microphone permissions and supports manual order entry',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('Permission denied','NotAllowedError');}});});
  await ready(page);await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('alert')).toContainText('마이크 권한');
  await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('별명').fill('수동참여');await page.getByRole('button',{name:'레이서 등록',exact:true}).click();
  await page.getByRole('button',{name:'음료 말하기',exact:true}).click();await page.getByRole('button',{name:'직접 입력할게요'}).click();await page.getByLabel('주문할 레이서').selectOption({label:'수동참여'});await page.getByLabel('오늘 마실 음료').selectOption('바닐라 라떼');await page.getByRole('button',{name:'음료 주문 완료'}).click();await expect(page.getByRole('button',{name:'수동참여 프로필 수정'})).toContainText('바닐라 라떼');
});

test('records audio, transcribes nickname, identifies the same local voice and saves its drink',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      const audio=new AudioContext();await audio.resume();const destination=audio.createMediaStreamDestination(),oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.frequency.value=150;oscillator.type='sawtooth';gain.gain.value=.3;oscillator.connect(gain);gain.connect(destination);oscillator.start();
      const track=destination.stream.getAudioTracks()[0],originalStop=track.stop.bind(track);track.stop=()=>{oscillator.stop();void audio.close();originalStop();};return destination.stream;
    }});
    class FakeSpeech {
      lang='';continuous=true;interimResults=true;onresult:((e:unknown)=>void)|null=null;onerror=null;
      start(){setTimeout(()=>this.onresult?.({results:[{0:{transcript:(window as unknown as {orderTest?:boolean}).orderTest?'카페 라떼 마실게요':'제 별명은 보이스왕입니다'},isFinal:true}],resultIndex:0}),250);}
      stop(){} abort(){}
    }
    (window as unknown as {SpeechRecognition:typeof FakeSpeech}).SpeechRecognition=FakeSpeech;
  });
  await ready(page);await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('button',{name:'녹음 완료',exact:true})).toBeEnabled();await page.waitForTimeout(3500);await page.getByRole('button',{name:'녹음 완료',exact:true}).click();await expect(page.getByLabel('별명')).toHaveValue('보이스왕');await page.getByRole('button',{name:'레이서 등록',exact:true}).click();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('VOICE SAVED');
  await page.evaluate(()=>{(window as unknown as {orderTest:boolean}).orderTest=true;});
  await page.getByRole('button',{name:'음료 말하기',exact:true}).click();await page.getByRole('button',{name:'목소리 등록 시작'}).click();await expect(page.getByRole('button',{name:'녹음 완료',exact:true})).toBeEnabled();await page.waitForTimeout(3500);await page.getByRole('button',{name:'녹음 완료',exact:true}).click();await expect(page.getByText('목소리를 찾았어요!',{exact:true})).toBeVisible();await expect(page.getByLabel('오늘 마실 음료')).toHaveValue('카페 라떼');await page.getByRole('button',{name:'음료 주문 완료'}).click();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('카페 라떼');
  await page.reload();await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toContainText('VOICE SAVED');
  await page.getByRole('button',{name:'보이스왕 프로필 수정'}).click();await page.getByRole('button',{name:'레이서 삭제'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'보이스왕 프로필 수정'})).toHaveCount(0);
  const voices=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open('brew-racers');request.onsuccess=()=>{const db=request.result,r=db.transaction('voices').objectStore('voices').count();r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>reject(r.error);};}));expect(voices).toBe(0);
});

test('runs two laps, celebrates last place, loops highlights, downloads and replays logs',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  await page.getByRole('button',{name:'레이스 시작',exact:true}).click();await expect(page.locator('.countdown')).toBeVisible();await expect(page.locator('.countdown')).toHaveCount(0);
  await page.getByRole('button',{name:'재생 속도 1배'}).click();await page.getByRole('button',{name:'재생 속도 2배'}).click();
  await expect(page.locator('.leaderboard')).toBeVisible();await page.getByRole('button',{name:'전체 트랙 보기'}).click();await expect(page.locator('.camera-badge')).toContainText('전체 트랙');await page.getByRole('button',{name:'팔로우 카메라'}).click();
  await page.getByRole('button',{name:'일시 정지',exact:true}).click();const before=await page.locator('.race-timer').textContent();await page.waitForTimeout(500);expect(await page.locator('.race-timer').textContent()).toBe(before);await page.getByRole('button',{name:'재생',exact:true}).click();
  await expect(page.locator('.winner-card')).toBeVisible({timeout:60000});await expect(page.locator('.winner-card h2')).toHaveText('달다 달아이썩겠네.');await expect(page.locator('.final-ranks>div')).toHaveCount(4);
  const hero=await page.locator('.winner-name').textContent(),last=await page.locator('.final-ranks>div').last().locator('strong').textContent();expect(hero).toContain(last!);
  const currentClip=await page.locator('.highlight-caption>span').textContent();await expect(page.locator('.highlight-caption>span')).not.toHaveText(currentClip!,{timeout:15000});
  await page.screenshot({path:'reports/screenshots/results.png',fullPage:true});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'레이스 로그',exact:true}).click();const downloaded=await download;await downloaded.saveAs('reports/replay-example.json');
  await page.getByRole('button',{name:'전체 리플레이',exact:true}).click();await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await page.getByRole('button',{name:'일시 정지',exact:true}).click();await page.getByRole('slider',{name:'리플레이 타임라인'}).fill('20');await expect(page.locator('.race-timer')).toContainText('00:20');
  await page.screenshot({path:'reports/screenshots/race.png',fullPage:true});await page.getByRole('button',{name:'BREW RACERS 홈'}).click();await page.getByRole('button',{name:/^리플레이/}).click();await expect(page.locator('.history-card')).toHaveCount(1);expect(errors).toEqual([]);
});

test('imports valid replay JSON and rejects corrupted files with a helpful message',async({page})=>{
  await ready(page);await page.getByRole('button',{name:/^리플레이/}).click();
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.getByRole('status')).toContainText('올바른 JSON');
  const {simulateRace}=await import('../../src/core/race'),{demoDrivers}=await import('../../src/core/catalog');const log=simulateRace(demoDrivers(),'forest',456,'2026-09-20T00:00:00Z');
  await page.locator('input[type=file]').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(log))});await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await expect(page.locator('.race-track-name')).toHaveText('말차 포레스트');
});

test('keyboard closes modal and keeps help reachable on a phone',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'도움말',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'플레이 가이드',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);await page.getByRole('button',{name:'닫기',exact:true}).click();
});

test('replays launch, impact, block and boost effects with deterministic pause and seeking',async({page},testInfo)=>{
  const {actionTime,loadReplay,seek}=await import('./replay');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.emulateMedia({reducedMotion:'no-preference'});await loadReplay(page);
  for(const phase of ['launch','hit','blocked','boost'] as const){
    await seek(page,actionTime(phase));await expect(page.locator('.race-hud')).toHaveAttribute('data-phase',phase);await expect(page.locator('.race-canvas')).toHaveAttribute('data-phase',phase);
    await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera',phase==='hit'?'first-person':'third-person');
    expect(Number(await page.locator('.race-canvas').getAttribute('data-particles'))).toBeGreaterThan(0);
  }
  await seek(page,actionTime('hit','ice'));const digest=(buffer:Buffer)=>createHash('sha256').update(buffer).digest('hex');const first=PNG.sync.read(await page.locator('.race-canvas').screenshot());
  await page.waitForTimeout(300);expect(digest(PNG.sync.read(await page.locator('.race-canvas').screenshot()).data)).toBe(digest(first.data));
  await seek(page,1);await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera','third-person');
  await seek(page,actionTime('hit','ice'));const returned=PNG.sync.read(await page.locator('.race-canvas').screenshot());
  expect([returned.width,returned.height]).toEqual([first.width,first.height]);
  let changed=0;for(let i=0;i<first.data.length;i+=4)if(Math.max(...[0,1,2,3].map(c=>Math.abs(first.data[i+c]-returned.data[i+c])))>2)changed++;
  const changedRatio=changed/(first.width*first.height);await testInfo.attach('replay-pixel-comparison',{body:JSON.stringify({changed,changedRatio,tolerance:.0001}),contentType:'application/json'});
  expect(changedRatio).toBeLessThanOrEqual(.0001);
  await page.getByRole('button',{name:'전체 트랙 보기'}).click();await expect(page.locator('.race-canvas')).toHaveAttribute('data-camera','overview');
  await seek(page,5.1);await page.getByRole('button',{name:'사운드 켜기'}).click();await page.getByRole('button',{name:'재생',exact:true}).click();await page.waitForTimeout(1700);await page.getByRole('button',{name:'일시 정지',exact:true}).click();await page.getByRole('button',{name:'사운드 끄기'}).click();
  expect(errors).toEqual([]);
});
