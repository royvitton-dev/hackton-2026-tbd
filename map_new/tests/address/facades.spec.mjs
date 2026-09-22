import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const artifacts=fileURLToPath(new URL('../../.runtime/address-reference/',import.meta.url));
test.beforeEach(async({page})=>{
  await page.routeWebSocket('**',socket=>{const server=socket.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}socket.send(message);});});
});

test('six reviewed buildings load their own facade geometry and intact photographic materials',async({page})=>{
  const failures=[];page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
  for(const [id,type] of [['10000901','neonadeuli'],['20000441','onum'],['20000555','urban'],['20000474','saneunjari'],['20000536','amsa'],['10002042','koinonia']]) {
    await page.goto('/map_new/?view=address&site='+id+'-0');await page.waitForFunction(()=>window.__addressStudio);
    await expect(page.locator('#address-material-note')).toContainText('원본 사진의 벽면 질감 적용됨');
    const state=await page.evaluate(()=>__addressStudio.state);
    expect(state.view).toBe('exterior');expect(state.model.profile.facadeType).toBe(type);
    expect(state.model.photoSurfaces.length).toBeGreaterThan(0);expect(state.model.photoSurfaces.every(s=>s.state==='ready')).toBe(true);
    expect(state.model.details.window).toBeGreaterThan(8);
    if(id==='10000901')expect(state.photos).toBe(1);
    if(id==='10002042')expect(state.model.details.louver).toBeGreaterThan(100);
    else expect(state.model.details['piloti-column']).toBeGreaterThan(0);
    await page.screenshot({path:artifacts+'facade-'+id+'.png'});
  }
  expect(failures).toEqual([]);
});

test('original photo finish and proportions can be restored after a color and height experiment',async({page})=>{
  await page.goto('/map_new/?view=address&site=20000441-0');await page.waitForFunction(()=>window.__addressStudio);
  await expect(page.locator('#address-material-note')).toContainText('원본 사진의 벽면 질감 적용됨');
  const original=await page.evaluate(()=>__addressStudio.state.model.profile);
  await page.locator('#address-photo-texture').uncheck();expect(await page.evaluate(()=>__addressStudio.state.model.photoSurfaces)).toEqual([]);
  await page.locator('#address-floors').fill('7');await page.locator('#address-floors').blur();
  await page.locator('#address-color').evaluate(input=>{input.value='#8d9b76';input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(await page.evaluate(()=>__addressStudio.state.model.profile.color)).toBe('#8d9b76');
  await page.locator('#address-reset').click();await expect(page.locator('#address-material-note')).toContainText('원본 사진의 벽면 질감 적용됨');
  expect(await page.evaluate(()=>__addressStudio.state.model.profile)).toEqual(original);
});

test('a missing source texture is disclosed and the modeled facade remains usable',async({page})=>{
  await page.route('**/address/photos/20000441-1.jpg',route=>route.fulfill({status:404,body:'Unavailable for this test'}));
  await page.goto('/map_new/?view=address&site=20000441-0');await page.waitForFunction(()=>window.__addressStudio);
  await expect(page.locator('#address-material-note')).toContainText('사진 질감을 읽지 못해 기본 재질');
  expect(await page.evaluate(()=>__addressStudio.state.model.details.window)).toBeGreaterThan(8);
  await page.locator('[data-model-view=drawing]').click();await expect(page.locator('#address-world')).toHaveAttribute('data-model-kind','drawing');
});
