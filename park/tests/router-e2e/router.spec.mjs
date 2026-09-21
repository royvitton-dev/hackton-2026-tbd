import {test,expect} from '@playwright/test';

test.beforeEach(async({page,baseURL})=>{
 const wrongPorts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const inspect=raw=>{const u=new URL(raw);if(['localhost','127.0.0.1'].includes(u.hostname)&&u.port!==new URL(baseURL).port)wrongPorts.push(raw);};
 page.on('request',r=>inspect(r.url()));page.on('websocket',w=>inspect(w.url()));
 page.__routerErrors=errors;page.__wrongPorts=wrongPorts;
});
test.afterEach(async({page})=>{expect(page.__wrongPorts).toEqual([]);expect(page.__routerErrors).toEqual([]);});
test('project directory, shared paths, redirects and mobile golden',async({page,request})=>{
 const apps=await (await request.get('/api/apps')).json();expect(apps.apps).toHaveLength(11);
 await page.goto('/projects/');await expect(page.locator('nav a')).toHaveCount(11);await expect(page).toHaveScreenshot('router-directory.png');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page).toHaveScreenshot('router-directory-mobile.png',{fullPage:true});
 const redirect=await request.get('/map?workspace=source-drive',{maxRedirects:0});expect(redirect.headers().location).toBe('/map/?workspace=source-drive');
 for(const id of ['map','dopamin','pinball','trading','movie','voice','battery_health']){const response=await request.post('/api/launch?id='+id);expect(response.status()).toBe(200);expect(new URL((await response.json()).url).pathname).toBe('/'+id+'/');}
 expect((await request.get('/movie/package.json')).status()).toBe(403);expect((await request.get('/map/.env')).status()).toBe(403);expect((await request.get('/unknown/')).status()).toBe(404);
});
test('park renders its WebGL scene under the shared route',async({page})=>{await page.goto('/?capture=1');await expect(page).toHaveURL(/\/park\/\?capture=1/);await page.locator('#world[data-ready=true]').waitFor({timeout:90000});expect(await page.evaluate(()=>window.__park.view.controls.target.toArray())).toEqual([0,0,0]);await expect(page.locator('.attraction-card[data-id=map]')).toBeVisible();});
test('map data, real B2 assets, category links and golden stay inside /map',async({page})=>{
 await page.goto('/map/mobility.html');await page.locator('body[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.source-card')).toHaveCount(9);await expect(page.locator('#route-map image')).toHaveAttribute('href','/map/plans/changdong-parking-b2.png');await expect(page.locator('.route-section')).toHaveScreenshot('router-mobility.png');
 await page.getByRole('link',{name:'B2 충전기 설치 검토 열기 ↗'}).click();await page.waitForFunction(()=>window.__atlas?.state.screen==='charging');expect(await page.evaluate(()=>window.__atlas.state.plan.id)).toBe('changdong-b2');expect(await page.evaluate(()=>window.__atlas.state.charging.result.selected)).toEqual([]);
 await page.reload();await page.waitForFunction(()=>window.__atlas?.state.screen==='charging');
});
test('racing scene renders inside /dopamin',async({page})=>{await page.goto('/dopamin/');await expect(page.locator('canvas').first()).toBeVisible();await expect(page.getByText('BREW RACERS',{exact:false}).first()).toBeVisible();});
test('pinball can start and pause without a child server',async({page})=>{await page.goto('/pinball/');await page.waitForFunction(()=>window.pinball);await page.locator('#start').click();await page.locator('#pause:not([disabled])').waitFor();await page.locator('#pause').click();await expect(page.locator('#pause-overlay')).toBeVisible();await page.reload();await page.waitForFunction(()=>window.pinball);});
test('film uses ranged media and real playback under /movie',async({page,request})=>{const r=await request.get('/movie/output/wonder-park-30s.mp4',{headers:{Range:'bytes=0-255'}});expect(r.status()).toBe(206);expect((await r.body()).length).toBe(256);await page.goto('/movie/');await page.locator('video').evaluate(async v=>{v.muted=true;await v.play();});await page.waitForFunction(()=>document.querySelector('video').currentTime>.5);await page.locator('video').evaluate(v=>v.pause());});
test('board game portraits and the nested health route render',async({page})=>{await page.goto('/webpage/');await expect(page.locator('canvas').first()).toBeVisible();await expect.poll(()=>page.locator('img').evaluateAll(es=>es.length>0&&es.every(e=>e.complete&&e.naturalWidth>0))).toBe(true);await page.goto('/webpage/health/');await expect(page.locator('body')).toContainText('VITALIS');await page.reload();await expect(page.locator('body')).toContainText('VITALIS');});
test('battery route shows U0037 in the 3D dashboard, preserves selection and exposes charging history',async({page,request})=>{
 test.setTimeout(240000);
 await page.goto('/battery_health/?user=U0037');
 await expect(page).toHaveURL(/\/battery_health\/\?user=U0037$/);
 const canvas=page.locator('canvas');
 await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toHaveValue('U0037');
 await expect(canvas).toHaveAttribute('data-renderer','webgl-3d-mesh',{timeout:150000});
 await expect(canvas).toHaveAttribute('data-vehicle-id','kia_niro_ev_2026');
 await expect.poll(async()=>Number(await canvas.getAttribute('data-model-triangles'))).toBeGreaterThan(1000);
 await expect(canvas).toHaveAttribute('data-camera-quaternion',/.+/);
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.getByTestId('vehicle-viewer')).toHaveScreenshot('router-battery-3d.png');
 const before=await canvas.getAttribute('data-camera-quaternion'),box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+90,box.y+box.height*.5,{steps:10});await page.mouse.up();
 await expect.poll(()=>canvas.getAttribute('data-camera-quaternion')).not.toBe(before);
 await page.getByRole('button',{name:'배터리 위치 보기'}).click();await expect(page.locator('#battery-info-panel')).toBeVisible();
 await page.getByRole('button',{name:'배터리 위치 보기'}).click();
 await page.getByRole('tab',{name:'충전 이력',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(5);
 const response=await request.get('/battery_health/api/users/U0037/sessions');expect(response.status()).toBe(200);expect((await response.json()).sessions).toHaveLength(11);
 await page.reload();await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toHaveValue('U0037');
 await page.getByRole('combobox',{name:'사용자 및 차량'}).selectOption('U0002');
 await expect(page).toHaveURL(/user=U0002/);
 await page.goto('/battery_health/');await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toHaveValue('U0002');
 await page.goto('/voice/');await expect(page.getByRole('heading',{name:'목소리로 시작하는 작업.'})).toBeVisible();await expect(page.locator('body')).toContainText('npm start -- --cwd ..');
});

test('trading UI sends REST and WebSocket traffic through the shared origin',async({page})=>{const requests=[],sockets=[];page.on('request',r=>{if(r.url().includes('/trading/backend/'))requests.push(r.url());});page.on('websocket',w=>{if(new URL(w.url()).pathname.includes('/backend/'))sockets.push(w.url());});await page.goto('/trading/');await expect(page.locator('body')).toContainText('LEAVE');await expect.poll(()=>requests.length).toBeGreaterThan(0);await expect.poll(()=>sockets.length).toBeGreaterThan(0);expect(sockets.every(u=>new URL(u).pathname==='/trading/backend/ws')).toBe(true);});
test('legacy vehicle links preserve user and API access in the 3D battery dashboard',async({page,request})=>{test.setTimeout(240000);await page.goto('/vehicle/?user=U0002');await expect(page).toHaveURL(/\/battery_health\/\?user=U0002$/);await expect(page.locator('canvas')).toHaveAttribute('data-renderer','webgl-3d-mesh',{timeout:150000});await page.getByRole('tab',{name:'충전 이력',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(5);const r=await request.get('/vehicle/api/users/U0002/sessions');expect(r.status()).toBe(200);expect((await r.json()).sessions).toHaveLength(6);await page.reload();await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toHaveValue('U0002');});
