import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

async function ready(page){
 // Keep visual fixtures stable while other agents add real projects to the live worktree.
 const response=await page.request.get('/api/park');const fixture=await response.json();
 fixture.attractions=fixture.attractions.filter(a=>['dopamin','movie','voice'].includes(a.id));
 await page.route('**/api/park',route=>route.fulfill({json:fixture}));
 await page.route('**/api/events',route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify(fixture)}\n\n`}));
 await page.goto('/?capture=1',{waitUntil:'domcontentloaded'});
 await page.locator('#world[data-ready=true]').waitFor({timeout:90000});
 await page.waitForFunction(()=>window.__park?.getState().attractions.length>=3);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#loading').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__park.view.renderer.info.memory.geometries>0);
 await page.waitForTimeout(1500);
}
async function settled(page){await page.waitForFunction(()=>!window.__park.view.transition);await page.waitForTimeout(700);}
test.beforeEach(async({page})=>{await page.coverage.startJSCoverage({resetOnNavigation:false});});
test.afterEach(async({page},info)=>{
 const coverage=await page.coverage.stopJSCoverage();const entries=coverage.filter(e=>e.url.includes('/park/src/'));
 const dir='park/reports/browser-coverage/raw';await mkdir(dir,{recursive:true});await writeFile(path.join(dir,info.title.replace(/[^a-zA-Z0-9-]/g,'_')+'.json'),JSON.stringify(entries));
});
test('desktop miniature, real WebGL geometry, excluded project and day-night golden',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await expect(page.getByRole('heading',{name:'Small world. Endless wonder.'})).toBeVisible();
 await expect(page.locator('.attraction-card')).toHaveCount(3);
 expect(await page.evaluate(()=>window.__park.getState().attractions.map(a=>a.id))).toEqual(['dopamin','movie','voice']);
 const details=await page.evaluate(()=>{const v=window.__park.view;let vertices=0,meshes=0;v.scene.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});return {webgl:v.renderer.getContext() instanceof WebGL2RenderingContext,vertices,meshes};});
 expect(details.webgl).toBe(true);expect(details.vertices).toBeGreaterThan(100000);expect(details.meshes).toBeGreaterThan(50);
 const plaza=await page.evaluate(()=>{const v=window.__park.view;const landmark=v.scene.getObjectByName('GS central landmark');return {exists:!!landmark,center:landmark?.getWorldPosition(new v.camera.position.constructor()).toArray(),width:document.querySelector('#world').getBoundingClientRect().width/innerWidth};});
 expect(plaza.exists).toBe(true);expect(plaza.center[0]).toBe(0);expect(plaza.width).toBeGreaterThan(.95);
 await expect(page).toHaveScreenshot('park-desktop-day.png',{mask:[page.locator('#sync-button')]});
 await page.getByRole('button',{name:'야간 풍경',exact:true}).click();await expect(page.locator('body')).toHaveClass(/night/);await page.waitForTimeout(1200);
 await expect(page).toHaveScreenshot('park-desktop-night.png',{mask:[page.locator('#sync-button')]});
 await page.getByRole('button',{name:'낮 풍경',exact:true}).click();
 await page.locator('.attraction-card[data-id=dopamin]').click();await settled(page);await expect(page.locator('#detail h2')).toHaveText('도파민 범퍼카');
 await expect(page).toHaveScreenshot('bumper-attraction.png',{mask:[page.locator('#sync-button')]});
 expect(errors).toEqual([]);
});
test('cinema shows the real 30-second film on a 3D screen and playback controls work',async({page})=>{
 await ready(page);await page.locator('.attraction-card[data-id=movie]').click();await page.getByRole('button',{name:'극장 입장',exact:true}).click();
 await expect(page.locator('#cinema-ui')).toBeVisible();await settled(page);
 await page.evaluate(async()=>{const video=document.querySelector('#film');video.pause();if(video.readyState<1)await new Promise(r=>video.addEventListener('loadedmetadata',r,{once:true}));const sought=new Promise(r=>video.addEventListener('seeked',r,{once:true}));video.currentTime=8;await sought;});
 expect(await page.evaluate(()=>({duration:document.querySelector('#film').duration,texture:window.__park.view.cinema.screen.material.map.isVideoTexture,mode:window.__park.view.mode}))).toMatchObject({duration:30,texture:true,mode:'cinema'});
 await page.waitForTimeout(1000);await expect(page).toHaveScreenshot('cinema-screen.png');
 await page.getByRole('button',{name:'영상 재생',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#film').currentTime>8.5);
 await page.getByRole('button',{name:'영상 일시정지',exact:true}).click();await expect(page.locator('#film-seek')).toHaveAttribute('max','30');
 await page.getByRole('button',{name:'영상 음소거',exact:true}).click();expect(await page.evaluate(()=>document.querySelector('#film').muted)).toBe(true);
 await page.getByRole('button',{name:'파크로 돌아가기'}).click();await expect(page.locator('#cinema-ui')).toBeHidden();expect(await page.evaluate(()=>document.querySelector('#film').paused)).toBe(true);
});
test('mobile park, accessible attraction directory and full-screen detail golden',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page).toHaveScreenshot('park-mobile.png',{fullPage:true});
 await page.getByRole('button',{name:'전체 어트랙션 보기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'어디로 떠나볼까요?'})).toBeVisible();
 await page.locator('.attraction-directory [data-id=voice]').click();await expect(page.locator('#detail h2')).toHaveText('매직 보이스 스테이지');await settled(page);
 await expect(page).toHaveScreenshot('voice-mobile.png',{fullPage:true});
 await page.getByRole('button',{name:'스테이지 입장',exact:true}).click();await expect(page.locator('.command-box')).toContainText('npm start -- --cwd ..');
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'어트랙션 안내 닫기',exact:true}).click();await expect(page.locator('#detail')).toBeHidden();
});
test('manager, rendering controls, camera navigation and real character animations',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'운영 관리',exact:true}).click();
 await expect(page.getByRole('heading',{name:'파크 운영실'})).toBeVisible();await expect(page.locator('.ops-stats')).toContainText('10');await expect(page.locator('.commit-list>div')).not.toHaveCount(0);
 await page.getByRole('button',{name:'지금 커밋 확인',exact:true}).click();await expect(page.locator('#toast')).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'화질 및 동작 설정',exact:true}).click();await page.locator('#quality').selectOption('balanced');expect(await page.evaluate(()=>window.__park.view.ao.enabled)).toBe(false);
 await page.locator('#quality').selectOption('ultra');expect(await page.evaluate(()=>window.__park.view.ao.enabled)).toBe(true);await page.getByRole('button',{name:'닫기',exact:true}).click();
 const before=await page.evaluate(()=>window.__park.view.camera.position.length());await page.getByRole('button',{name:'확대',exact:true}).click();expect(await page.evaluate(()=>window.__park.view.camera.position.length())).toBeLessThan(before);await page.getByRole('button',{name:'전체 지도',exact:true}).click();await settled(page);
 const pose=await page.evaluate(()=>{const v=window.__park.view;const character=v.attractions[2].character;const b=character.children[0];v.setTime(1);v.frame(performance.now());const a=b.position.y;v.setTime(2);v.frame(performance.now());return [a,b.position.y];});expect(pose[0]).not.toBe(pose[1]);
});
test('new folders and changed themes update the live 3D park without a reload',async({page})=>{
 await ready(page);
 const added=await page.evaluate(()=>{const v=window.__park.view;const items=window.__park.getState().attractions;v.setAttractions([...items,{id:'test-rocket',revision:'new',name:'우주 여행',english:'SPACE',theme:'space',character:'olaf',color:'#719fae'}]);return {count:v.attractions.length,pick:v.picks.at(-1).userData.attraction,old:v.attractions.at(-1).root.uuid};});
 expect(added.count).toBe(4);expect(added.pick).toBe('test-rocket');
 const changed=await page.evaluate(()=>{const v=window.__park.view;v.setAttractions(v.items.map(a=>a.id==='test-rocket'?{...a,theme:'ocean',revision:'changed'}:a));return v.attractions.at(-1).root.uuid;});expect(changed).not.toBe(added.old);
});
test('media range requests and private-file boundaries',async({request})=>{
 const range=await request.get('/api/project-asset/movie/output/vitalis-hackathon-30s.mp4',{headers:{Range:'bytes=0-255'}});expect(range.status()).toBe(206);expect(range.headers()['content-range']).toMatch(/^bytes 0-255\//);expect((await range.body()).length).toBe(256);
 const invalid=await request.get('/api/project-asset/movie/output/vitalis-hackathon-30s.mp4',{headers:{Range:'bytes=999999999-'}});expect(invalid.status()).toBe(416);
 expect((await request.get('/api/project-asset/webpage/public/idols/jennie.png')).status()).toBe(403);
 expect((await request.get('/api/project-asset/movie/.env')).status()).toBe(403);
 expect((await request.post('/api/launch?id=webpage')).status()).toBe(404);
 expect((await request.post('/api/refresh',{headers:{Origin:'https://unrelated.example'}})).status()).toBe(403);
});
