import { expect, type Page } from '@playwright/test';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';
import { raceMoment } from '../../src/core/presentation';
import type { Item, RaceLog } from '../../src/core/types';
export const actionLog=simulateRace(demoDrivers(),'roastery',1234,'2026-09-20T00:00:00Z');
export function actionTime(phase:'launch'|'hit'|'blocked'|'boost',item?:Item,log=actionLog){
  for(let t=1;t<log.duration;t+=.1){const time=Number(t.toFixed(1)),moment=raceMoment(log,time);if(moment.phase===phase&&moment.age>=.099&&moment.age<(phase==='boost'?2.3:.3)&&(!item||moment.event?.item===item))return time;}
  throw new Error(`No ${phase}/${item} event in fixture`);
}
export async function loadReplay(page:Page,log:RaceLog=actionLog){
  await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:/^리플레이/}).click();
  await page.locator('input[type=file]').setInputFiles({name:'action.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(log))});
  await expect(page.getByText('RACE REPLAY',{exact:true})).toBeVisible();await page.getByRole('button',{name:'일시 정지',exact:true}).click();
}
export async function seek(page:Page,time:number){
  await page.getByRole('slider',{name:'리플레이 타임라인'}).fill(String(Number(time.toFixed(1))));
  await expect(page.locator('.race-canvas')).toHaveAttribute('data-time',time.toFixed(1));
}

export async function finishReplay(page:Page,log:RaceLog=actionLog){
  await loadReplay(page,log);await seek(page,Number((log.duration-.1).toFixed(1)));
  await page.getByRole('button',{name:'재생',exact:true}).click();
  await expect(page.locator('.podium-canvas')).toHaveAttribute('data-ready','true');
}
