import { test, expect } from '@playwright/test';

test('Audi Q4 renders the verified vehicle texture without the floating charger box',async({page})=>{
  test.setTimeout(240000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?user=U0059');
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-vehicle-id','audi_q4_45_etron_2026',{timeout:90000});
  await expect(canvas).toHaveAttribute('data-renderer','webgl-cutout');
  await expect(canvas).toHaveAttribute('data-charger-visible','false');
  await expect(canvas).toHaveAttribute('data-cutout-path',/audi_q4_45_e_tron_2026\.png\?v=/);
  await expect(page.getByText('실차 이미지 · 회전·투시 미지원',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/audi-q4-clean-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'배터리 위치 보기'}).click();
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-charger-visible','false');
  await page.screenshot({path:'test-results/audi-q4-clean-focus.png',fullPage:true});
  await page.keyboard.press('Escape');
  for(const [id,model] of [['U0018','audi_q6_etron_quattro_2025'],['U0007','bmw_i5_edrive40_2026'],['U0040','mini_electric_cooper_2026'],['U0006','volvo_ex30_2026'],['U0076','vw_id4_pro_2026']]){
    await page.getByRole('combobox',{name:'사용자 및 차량'}).selectOption(id);
    await expect(canvas).toHaveAttribute('data-vehicle-id',model,{timeout:90000});
    await expect(canvas).toHaveAttribute('data-charger-visible','false');
    await page.screenshot({path:`test-results/clean-${model}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});
