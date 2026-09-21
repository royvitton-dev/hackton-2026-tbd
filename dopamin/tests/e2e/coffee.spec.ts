import { test, expect } from '@playwright/test';
import { actionLog, finishReplay } from './replay';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';

test('the coffee hero pours and serves smiling guests during the spoken celebration, then loops highlights',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    (window as unknown as {spoken:string[]}).spoken=[];
    speechSynthesis.speak=(utterance:SpeechSynthesisUtterance)=>{(window as unknown as {spoken:string[]}).spoken.push(utterance.text);};
  });
  await page.emulateMedia({reducedMotion:'no-preference'});await finishReplay(page);await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();
  const barista=actionLog.order.at(-1)!,guests=actionLog.order.slice(0,-1),scene=page.locator('.coffee-canvas');
  await expect(scene).toHaveAttribute('data-ready','true');await expect(scene).toHaveAttribute('data-barista',barista);await expect(scene).toHaveAttribute('data-guests',guests.join(','));
  await expect(page.locator('.coffee-heading h2')).toHaveText('달다 달아 이썩겠네.');await expect(page.locator('.coffee-orders li')).toHaveCount(guests.length);
  const spoken=await page.evaluate(()=>(window as unknown as {spoken:string[]}).spoken);expect(spoken).toHaveLength(1);expect(spoken[0]).toContain('달다 달아 이썩겠네.');expect(spoken[0]).toContain(actionLog.drivers.find(d=>d.id===barista)!.nickname);
  await expect(scene).toHaveAttribute('data-phase','pour');await page.getByRole('button',{name:'일시 정지',exact:true}).click();
  const time=await scene.getAttribute('data-time');await page.waitForTimeout(400);await expect(scene).toHaveAttribute('data-time',time!);
  await page.screenshot({path:'reports/screenshots/coffee-truck.png',fullPage:true});await page.getByRole('button',{name:'재생',exact:true}).click();
  await expect(scene).toHaveAttribute('data-served',/[1-7]/,{timeout:8000});
  await expect(page.locator('.winner-card')).toBeVisible({timeout:25000});await expect(page.locator('.highlight-caption')).toBeVisible();
  await page.getByRole('button',{name:'커피차 다시 보기',exact:true}).click();await expect(scene).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'하이라이트 보기',exact:true}).click();await expect(page.locator('.winner-card')).toBeVisible();expect(errors).toEqual([]);
});

test('all seven other racers wait for the eight-player coffee truck on a phone',async({page})=>{
  await page.setViewportSize({width:390,height:844});const demo=demoDrivers();const drivers=Array.from({length:8},(_,i)=>({...demo[i%4],id:`coffee-${i}`,nickname:`친구${i+1}`,avatar:i}));
  const log=simulateRace(drivers,'roastery',65,'2026-09-21T00:00:00Z');await finishReplay(page,log);await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();
  await expect(page.locator('.coffee-canvas')).toHaveAttribute('data-ready','true');await expect(page.locator('.coffee-orders li')).toHaveCount(7);await expect(page.locator(`.coffee-orders li[data-guest="${log.order.at(-1)}"]`)).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'reports/screenshots/coffee-truck-eight-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'하이라이트 보기',exact:true}).click();await expect(page.locator('.winner-card')).toBeVisible();
});
