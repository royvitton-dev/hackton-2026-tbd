import { test, expect, type Page } from '@playwright/test';
import { createGame, reducer, SAVE_KEY, type GameState } from '../../src/game/engine';
async function seed(page: Page, game: GameState, fixedRandom = false) {
  await page.addInitScript(({game,key,fixedRandom}) => { if(!sessionStorage.getItem('test-seeded')) {localStorage.setItem(key,JSON.stringify(game));sessionStorage.setItem('test-seeded','yes');} if(fixedRandom) Math.random=()=>0; },{game,key:SAVE_KEY,fixedRandom});
  await page.goto('/');
}
async function read(page: Page): Promise<GameState> { return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY); }
async function performVocal(page: Page) { await page.getByRole('button',{name:'퍼포먼스 시작'}).click(); for(let i=0;i<5;i++) {await page.keyboard.press('Space');await page.waitForTimeout(180);} }
async function performDance(page: Page, key: string) { await page.getByRole('button',{name:'퍼포먼스 시작'}).click();for(let i=0;i<8;i++){await page.keyboard.press(key);await page.waitForTimeout(180);} }
test('WebGL, photo assets, camera, roster, rules and 4-human setup work', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('.board-canvas')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.board-canvas')).toHaveAttribute('data-webgl','true');await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(()=>page.locator('.roster img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  for(const label of ['보드 확대','보드 축소','보드 위에서 보기','보드 시점 초기화']) await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('button',{name:'새 게임 설정',exact:true}).click();
  await page.getByRole('button',{name:'제니 선택'}).click();
  await page.getByLabel('플레이어 이름').fill('테스트스타');await page.getByLabel('직접 플레이하는 사람').selectOption('4');
  await page.getByLabel('데뷔 목표 점수').selectOption('300');await page.getByRole('button',{name:'새 게임 시작',exact:true}).click();
  expect((await read(page)).players.filter(p=>p.cpu)).toHaveLength(0);expect((await read(page)).players[0].idol).toBe(2);
  await page.getByRole('button',{name:'연습생',exact:true}).click();await expect(page.locator('.trainee-card')).toHaveCount(4);
  await page.locator('.trainee-card').first().click();await expect(page.getByRole('dialog')).toContainText('테스트스타');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'랭킹',exact:true}).click();await expect(page.locator('.collection-heading')).toContainText('빛나는 연습생');
  await page.getByRole('button',{name:'보드로 돌아가기'}).click();
  await page.getByRole('button',{name:'게임 방법',exact:true}).first().click();await expect(page.getByRole('dialog')).toContainText('매 4라운드');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'사진 출처',exact:true}).click();await expect(page.getByRole('dialog').locator('a')).toHaveCount(5);await page.keyboard.press('Escape');
  await page.screenshot({path:'test-results/game/verified-desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('dice → training → persisted result → collision → two human performances', async ({page}) => {
  const game=createGame({count:2,humans:2,target:400,idol:0,name:''});await seed(page,game,true);
  await page.getByTestId('roll-dice').click();await expect(page.getByRole('dialog')).toContainText('보컬 클래스');
  await performVocal(page);await expect(page.getByRole('dialog',{name:'턴 결과'})).toBeVisible();
  const saved=await read(page);expect(saved.players[0].stats.vocal).toBeGreaterThan(20);expect(saved.players[0].score).toBeGreaterThan(0);
  await page.reload();await expect(page.getByRole('dialog',{name:'턴 결과'})).toBeVisible();expect((await read(page)).players[0].score).toBe(saved.players[0].score);
  await page.getByRole('button',{name:'다음 턴으로'}).click();await page.getByTestId('roll-dice').click();
  await expect(page.getByRole('dialog')).toContainText('보컬 클래스');await performVocal(page);
  await page.getByRole('button',{name:'라이벌과 배틀하기'}).click();await expect(page.getByRole('dialog')).toContainText('무대 위의 만남');
  await page.getByRole('button',{name:/댄스 배틀/}).click();await performDance(page,'ArrowLeft');
  await expect(page.locator('.handoff')).toContainText('카리나의 차례');await performDance(page,'ArrowRight');
  await expect(page.getByRole('dialog',{name:'턴 결과'})).toContainText('장원영, 배틀 승리');
  expect((await read(page)).players[1].wins).toBe(1);await page.screenshot({path:'test-results/game/battle-result.png'});
  await page.getByRole('button',{name:'다음 턴으로'}).click();expect((await read(page)).day).toBe(2);
});
test('rap hold/release and an unanswered mini-game both finish', async ({page}) => {
  const game=createGame({count:1,humans:1,target:400,idol:0,name:''});game.phase='training';game.players[0].position=4;
  await seed(page,game);await page.getByRole('button',{name:'퍼포먼스 시작'}).click();
  const button=page.locator('.performance-button');
  for(const duration of [450,700,550,850,650]){await button.dispatchEvent('pointerdown',{pointerId:1});await page.waitForTimeout(duration);await button.dispatchEvent('pointerup',{pointerId:1});await page.waitForTimeout(100);}
  await expect(page.getByRole('dialog',{name:'턴 결과'})).toBeVisible();expect((await read(page)).players[0].stats.rap).toBeGreaterThan(23);
  const timeoutState=createGame({count:1,humans:1,target:400,idol:0,name:''});timeoutState.phase='training';timeoutState.players[0].position=2;
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:SAVE_KEY,state:timeoutState});await page.reload();
  await page.getByRole('button',{name:'퍼포먼스 시작'}).click();await expect(page.getByRole('dialog',{name:'턴 결과'})).toBeVisible({timeout:23000});
  expect((await read(page)).players[0].score).toBe(10);
});
test('AI takes its turn automatically and hands control back to a human', async ({page}) => {
  const game=createGame({count:2,humans:1,target:400,idol:0,name:''});game.active=1;
  await seed(page,game,true);await expect(page.getByRole('dialog',{name:'SM 트레이닝'})).toBeVisible();
  await expect(page.getByTestId('roll-dice')).toBeEnabled({timeout:20000});
  const state=await read(page);expect(state.active).toBe(0);expect(state.players[1].score).toBeGreaterThan(0);
});
test('monthly evaluation selects trainees, awards bonuses, and leads to a debut', async ({page}) => {
  let game=createGame({count:4,humans:4,target:400,idol:0,name:''});game.players.forEach((p,i)=>{p.score=[360,200,80,60][i];});game.active=3;game.day=4;game.phase='result';
  game=reducer(game,{type:'CONTINUE'});await seed(page,game);
  await expect(page.getByRole('dialog',{name:'월말 평가'})).toContainText('데뷔조 멤버');await page.screenshot({path:'test-results/game/evaluation.png'});
  await page.getByRole('button',{name:'데뷔 결과 확인'}).click();await expect(page.getByRole('dialog',{name:'데뷔 성공'})).toContainText('SUPERSTAR.');
  expect((await read(page)).winners).toEqual([0]);await page.screenshot({path:'test-results/game/debut.png'});
  await page.getByRole('button',{name:'새로운 데뷔 스토리 만들기'}).click();await page.getByRole('button',{name:'새 게임 시작',exact:true}).click();
  expect((await read(page)).phase).toBe('ready');expect((await read(page)).players[0].score).toBe(0);
});
test('mobile has no overflow, can configure solo play, roll and finish a mini-game', async ({page}) => {
  await page.setViewportSize({width:390,height:844});await seed(page,createGame(),true);
  await page.getByRole('button',{name:'새 게임',exact:true}).click();await page.getByRole('button',{name:'1명',exact:true}).click();
  await page.getByRole('button',{name:'새 게임 시작',exact:true}).click();
  await expect(page.locator('.roster-player')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByTestId('roll-dice').click();await page.getByRole('button',{name:'퍼포먼스 시작'}).click();
  for(let i=0;i<5;i++){await page.getByRole('button',{name:/음정 맞추기/}).click();await page.waitForTimeout(180);}
  await expect(page.getByRole('dialog',{name:'턴 결과'})).toBeVisible();await page.screenshot({path:'test-results/game/mobile-result.png',fullPage:true});
  await page.getByRole('button',{name:'다음 턴으로'}).click();expect((await read(page)).day).toBe(2);
});
