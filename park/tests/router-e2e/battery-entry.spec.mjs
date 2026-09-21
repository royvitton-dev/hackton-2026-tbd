import {test,expect} from '@playwright/test';

test.use({reducedMotion:'no-preference'});

test('main router battery entry opens the pit stop and skip reveals the selected user',async({page,request,baseURL})=>{
 const response=await request.post('/api/launch?id=battery_health');
 expect(response.status()).toBe(200);
 const entry=await response.json(),url=new URL(entry.url);
 expect(url.origin).toBe(new URL(baseURL).origin);
 expect(entry.path).toBe('/battery_health/?intro=pitstop');
 expect(url.pathname+url.search).toBe(entry.path);
 url.searchParams.set('user','U0056');
 // Keep the intro visible independently of machine speed/autoplay policy.
 await page.clock.install({time:new Date('2026-09-21T00:00:00Z')});
 await page.clock.pauseAt(new Date('2026-09-21T00:01:00Z'));
 await page.goto(url.href);
 await expect.poll(async()=>{await page.clock.runFor(32);return page.getByRole('dialog').count();},{timeout:60000}).toBe(1);
 await expect(page.getByRole('button',{name:'건너뛰기 →'})).toBeVisible();
 await page.getByRole('button',{name:'건너뛰기 →'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page).toHaveURL(/\/battery_health\/\?user=U0056$/);
 await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toHaveValue('U0056');
 await expect(page.getByTestId('health-score')).toHaveText('7');
 await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
});

test('project directory battery and vehicle links both request the entry animation',async({page})=>{
 await page.goto('/projects/');
 for(const name of ['배터리 관리','EVision · 차량 인텔리전스']){
  await expect(page.getByRole('link',{name:new RegExp(name)})).toHaveAttribute('href','/battery_health/?intro=pitstop');
 }
});
