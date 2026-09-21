import { test, expect } from '@playwright/test';

test('desktop lobby golden',async({page})=>{
  await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.avatar img')).toHaveCount(4);
  await expect(page).toHaveScreenshot('lobby-desktop.png',{fullPage:true,animations:'disabled'});
});
test('mobile lobby golden',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.avatar img')).toHaveCount(4);
  await expect(page).toHaveScreenshot('lobby-mobile.png',{fullPage:true,animations:'disabled'});
});
test('voice registration dialog golden',async({page})=>{
  await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);await page.getByRole('button',{name:'레이서 추가',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveScreenshot('voice-registration.png',{animations:'disabled'});
});

for(const [name,phase,item] of [
  ['item-launch','launch','bean'],['ice-impact','hit','ice'],['lightning-impact','hit','storm'],['espresso-boost','boost',undefined],
] as const)test(`${name} action golden`,async({page})=>{
  const {loadReplay,seek,actionTime}=await import('./replay');await page.emulateMedia({reducedMotion:'no-preference'});await loadReplay(page);await seek(page,actionTime(phase,item));
  await expect(page.locator('.live-stage')).toHaveScreenshot(`${name}.png`,{animations:'disabled'});
});
test('mobile racing HUD golden',async({page})=>{
  const {loadReplay,seek}=await import('./replay');await page.setViewportSize({width:390,height:844});await loadReplay(page);await seek(page,2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.live-stage')).toHaveScreenshot('race-mobile.png',{animations:'disabled'});
});

for(const mobile of [false,true])test(`Nintendo character picker ${mobile?'mobile':'desktop'} golden`,async({page})=>{
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'김커피 프로필 수정'}).click();await expect(page.locator('.character-picker img')).toHaveCount(8);
  await expect(page.locator('.character-picker')).toHaveScreenshot(`nintendo-picker-${mobile?'mobile':'desktop'}.png`,{animations:'disabled'});
});

for(const mobile of [false,true])test(`winner podium ${mobile?'mobile':'desktop'} golden`,async({page})=>{
  const {finishReplay}=await import('./replay');if(mobile)await page.setViewportSize({width:390,height:844});
  await finishReplay(page);await page.getByRole('button',{name:'일시 정지',exact:true}).click();await expect(page.locator('.podium-canvas')).toHaveAttribute('data-trophy','raised');
  await expect(page.locator('.live-stage')).toHaveScreenshot(`winner-podium-${mobile?'mobile':'desktop'}.png`,{animations:'disabled'});
});

for(const mobile of [false,true])test(`coffee truck ${mobile?'mobile':'desktop'} golden`,async({page})=>{
  const {finishReplay}=await import('./replay');if(mobile)await page.setViewportSize({width:390,height:844});
  await finishReplay(page);await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();await expect(page.locator('.coffee-canvas')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:'일시 정지',exact:true}).click();await expect(page.locator('.live-stage')).toHaveScreenshot(`coffee-truck-${mobile?'mobile':'desktop'}.png`,{animations:'disabled'});
});

for(const trackId of ['roastery','coast','forest','city','snow','volcano'])test(`${trackId} integrated sponsor scenery golden`,async({page})=>{
  const {demoDrivers}=await import('../../src/core/catalog'),{simulateRace}=await import('../../src/core/race'),{loadReplay,seek}=await import('./replay');
  const log=simulateRace(demoDrivers(),trackId,1234,'2026-09-20T00:00:00Z');await loadReplay(page,log);await seek(page,3);
  await expect(page.locator('.live-stage')).toHaveScreenshot(`sponsor-scenery-${trackId}.png`,{animations:'disabled'});
});
