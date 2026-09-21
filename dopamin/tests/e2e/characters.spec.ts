import { test, expect } from '@playwright/test';
import { CHARACTERS } from '../../src/core/characters';

test('shows eight Nintendo heads, persists a selected character and uses it in the race',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:'김커피 프로필 수정'}).click();
  for(const character of CHARACTERS){const button=page.getByRole('button',{name:`${character.name} 선택`,exact:true});await expect(button.getByAltText(`${character.name} 3D 얼굴 아바타`,{exact:true})).toHaveAttribute('alt',`${character.name} 3D 얼굴 아바타`);await button.click();await expect(button).toHaveAttribute('aria-pressed','true');}
  await page.getByRole('button',{name:'쿠파 선택',exact:true}).click();await page.getByRole('button',{name:'변경 저장'}).click();
  await expect(page.getByRole('button',{name:'김커피 프로필 수정'})).toContainText('쿠파');await page.reload();await expect(page.getByRole('button',{name:'김커피 프로필 수정'}).getByAltText('쿠파 3D 얼굴 아바타',{exact:true})).toHaveAttribute('alt','쿠파 3D 얼굴 아바타');
  await page.getByRole('button',{name:'레이스 시작',exact:true}).click();await expect(page.locator('.countdown')).toHaveCount(0);await page.getByRole('button',{name:'일시 정지',exact:true}).click();await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');
  expect(errors).toEqual([]);
});
