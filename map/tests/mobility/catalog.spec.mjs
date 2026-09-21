import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function ready(page){await page.goto('/mobility.html');await page.locator('body[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);}
test('mobility category desktop golden, source evidence and accessible search',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await expect(page.locator('.source-card')).toHaveCount(9);
 await expect(page).toHaveScreenshot('mobility-desktop.png',{fullPage:true});
 await page.getByRole('button',{name:'충전 위치·수요',exact:true}).click();await expect(page.locator('.source-card')).toHaveCount(4);
 await page.getByRole('searchbox',{name:'자료 검색'}).fill('한국환경공단');await expect(page.locator('.source-card')).toHaveCount(1);await expect(page.locator('.source-card')).toContainText('키 필요');
 await page.getByRole('searchbox',{name:'자료 검색'}).fill('없는자료');await expect(page.getByText('일치하는 자료가 없습니다.')).toBeVisible();await page.getByRole('button',{name:'검색 초기화'}).click();await expect(page.locator('.source-card')).toHaveCount(9);
 await page.locator('[data-source=palo-alto] [data-detail]').click();await expect(page.locator('dialog')).toBeVisible();await expect(page.locator('dialog')).toContainText('준공 상태');await expect(page.locator('dialog')).toContainText('SHA-256');
 await expect(page).toHaveScreenshot('mobility-source.png');await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toBeVisible();expect(errors).toEqual([]);
});
test('vehicle dimensions, blocked route, motion and filtered JSON download',async({page})=>{
 await ready(page);await expect(page.locator('#envelope-summary')).toContainText('0.427 m');
 expect(await page.evaluate(()=>window.__mobility.state.result.turningVerified)).toBe(false);
 await page.locator('#vehicle').selectOption('ev6');await expect(page.locator('#vehicle-dimensions')).toContainText('미확인');await expect(page.locator('#envelope-summary')).toContainText('0.432 m');
 await page.locator('#destination').selectOption('C');expect(await page.evaluate(()=>window.__mobility.state.result.path.destination.id)).toBe('C');
 await page.locator('#clearance').press('End');await expect(page.locator('#drive')).toBeDisabled();await expect(page.locator('#route-summary')).toContainText('동선 후보 없음');
 await page.locator('#clearance').press('Home');for(let i=0;i<5;i++)await page.locator('#clearance').press('ArrowRight');await page.locator('#drive').click();await page.waitForFunction(()=>window.__mobility.state.travel>.5);await page.locator('#drive').click();const distance=await page.evaluate(()=>window.__mobility.state.travel);await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__mobility.state.travel)).toBe(distance);
 await page.getByRole('button',{name:'차량 제원',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'현재 자료 목록 내려받기 ↓'}).click();const file=await downloaded;const json=JSON.parse(await readFile(await file.path(),'utf8'));expect(json.sources.map(s=>s.id)).toEqual(['ioniq5','ev6']);expect(json.vehicles).toHaveLength(2);
});
test('mobility mobile golden and source dialog keyboard controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page).toHaveScreenshot('mobility-mobile.png',{fullPage:true});await page.locator('#vehicle-source').click();await expect(page.locator('dialog')).toContainText('현대 IONIQ 5');await page.getByRole('button',{name:'자료 상세 닫기'}).click();await expect(page.locator('dialog')).not.toBeVisible();
});
test('category is connected from ATLAS and opens the actual B2 charging workspace',async({page})=>{
 test.setTimeout(120000);await page.goto('/?capture=1');await page.getByRole('link',{name:'실차·충전 데이터',exact:true}).waitFor();await page.getByRole('link',{name:'실차·충전 데이터',exact:true}).click();await page.locator('body[data-ready=true]').waitFor();
 await page.getByRole('link',{name:'B2 충전기 설치 검토 열기 ↗'}).click();await page.waitForFunction(()=>window.__atlas?.state.screen==='charging');
 const state=await page.evaluate(()=>({id:window.__atlas.state.plan.id,source:window.__atlas.state.plan.sourceType,selected:window.__atlas.state.charging.result.selected.length}));expect(state.id).toBe('changdong-b2');expect(state.source).toBe('annotated-svg');expect(state.selected).toBe(0);
});
