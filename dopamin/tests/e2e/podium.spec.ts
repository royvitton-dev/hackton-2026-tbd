import { test, expect } from '@playwright/test';
import { actionLog, finishReplay } from './replay';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';

test('celebrates the true winner with a rising trophy, pauses, and automatically returns to coffee highlights',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.emulateMedia({reducedMotion:'no-preference'});await finishReplay(page);
  const champion=actionLog.drivers.find(d=>d.id===actionLog.order[0])!,loser=actionLog.drivers.find(d=>d.id===actionLog.order.at(-1))!;
  await expect(page.locator('.podium-heading h2')).toContainText(champion.nickname);await expect(page.locator('.podium-canvas')).toHaveAttribute('data-winner',champion.id);
  await expect(page.locator('.podium-canvas')).toHaveAttribute('data-backdrop','step-and-repeat');await expect(page.getByRole('img',{name:'1·2·3위 시상대와 우승 트로피 · 52G 2026 해커톤 스폰서 월',exact:true})).toBeVisible();
  await expect(page.locator('.podium-places li')).toHaveCount(3);await expect(page.locator('.podium-places [data-rank="1"]')).toContainText(champion.nickname);await expect(page.locator('.podium-footer')).toContainText(loser.nickname);
  await expect(page.locator('.podium-canvas')).toHaveAttribute('data-trophy','raised');
  await page.getByRole('button',{name:'일시 정지',exact:true}).click();const time=await page.locator('.podium-canvas').getAttribute('data-time');await page.waitForTimeout(400);await expect(page.locator('.podium-canvas')).toHaveAttribute('data-time',time!);
  await page.screenshot({path:'reports/screenshots/podium.png',fullPage:true});await page.getByRole('button',{name:'재생',exact:true}).click();
  await expect(page.locator('.coffee-canvas')).toHaveAttribute('data-ready','true',{timeout:15000});await page.getByRole('button',{name:'하이라이트 보기',exact:true}).click();await expect(page.locator('.winner-card')).toBeVisible();await expect(page.locator('.winner-name')).toContainText(loser.nickname);await expect(page.locator('.winner-card h2')).toHaveText('달다 달아이썩겠네.');
  await expect(page.locator('.highlight-caption')).toBeVisible();await page.getByRole('button',{name:'시상대 다시 보기',exact:true}).click();await expect(page.locator('.podium-heading h2')).toContainText(champion.nickname);
  await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();await expect(page.locator('.coffee-canvas')).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'하이라이트 보기',exact:true}).click();await expect(page.locator('.winner-card')).toBeVisible();expect(errors).toEqual([]);
});
test('renders a two-person podium on a phone without inventing third place',async({page})=>{
  await page.setViewportSize({width:390,height:844});const log=simulateRace(demoDrivers().slice(0,2),'coast',77,'2026-09-21T00:00:00Z');await finishReplay(page,log);
  await expect(page.locator('.podium-places li')).toHaveCount(2);await expect(page.locator('.podium-places [data-rank="3"]')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();await expect(page.locator('.coffee-orders li')).toHaveCount(1);await page.getByRole('button',{name:'하이라이트 보기',exact:true}).click();await expect(page.locator('.winner-card')).toBeVisible();
});
