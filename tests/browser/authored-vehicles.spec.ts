import { test, expect } from '@playwright/test';

for (const [user,id] of [
  ['U0007','bmw_i5_edrive40_2026'],['U0059','audi_q4_45_etron_2026'],
  ['U0040','mini_electric_cooper_2026'],['U0018','audi_q6_etron_quattro_2025'],
]) {
  test(`${id}: real geometry, bounded orbit and battery inside transparent body`, async ({ page, request }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror',error=>errors.push(error.message));
    const viewerPath=process.env.EVISION_VIEWER_PATH??'/';
    // A stale Vite catch-all can return HTTP 200 with HTML at a GLB URL.
    // Verify the actual response, not just its status or local file existence.
    const model=await request.get(`${viewerPath}assets/vehicles/models/${id}_authored.glb`);
    expect(model.status()).toBe(200);
    expect(model.headers()['content-type']).toContain('model/gltf-binary');
    expect((await model.body()).subarray(0,4).toString()).toBe('glTF');
    await page.goto(`${viewerPath}?user=${user}`);
    const canvas=page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-vehicle-id',id,{timeout:90000});
    await expect(canvas).toHaveAttribute('data-renderer','webgl-3d-mesh');
    await expect(canvas).toHaveAttribute('data-model-kind','authored-approximation');
    expect(Number(await canvas.getAttribute('data-model-triangles'))).toBeGreaterThan(50000);
    await expect(page.getByText(/자체 제작 개략 3D · 정밀 CAD 아님/)).toBeVisible();
    await expect(canvas).toHaveAttribute('data-pack-inside-vehicle','true');
    await expect(canvas).toHaveAttribute('data-charger-visible','false');
    await page.locator('[data-testid="vehicle-viewer"]').screenshot({path:`test-results/authored-${id}.png`});
    await canvas.scrollIntoViewIfNeeded();
    const box=(await canvas.boundingBox())!,before=await canvas.getAttribute('data-camera-quaternion');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width-5,box.y+20,{steps:8});
    await page.mouse.up();
    await expect.poll(()=>canvas.getAttribute('data-camera-quaternion')).not.toBe(before);
    const angle=async(name:string)=>Number(await canvas.getAttribute(name));
    expect(await angle('data-azimuth')).toBeGreaterThanOrEqual(-65.1);
    expect(await angle('data-azimuth')).toBeLessThanOrEqual(-14.9);
    expect(await angle('data-polar')).toBeGreaterThanOrEqual(54.9);
    expect(await angle('data-polar')).toBeLessThanOrEqual(78.1);
    await page.getByRole('button',{name:'배터리 위치 보기'}).click();
    await expect(page.locator('#battery-info-panel')).toBeVisible();
    await expect.poll(async()=>Number(await canvas.getAttribute('data-faded-vehicle-materials'))).toBeGreaterThan(5);
    await expect(canvas).toHaveAttribute('data-pack-inside-vehicle','true');
    await expect(canvas).toHaveAttribute('data-pack-depth-tested','true');
    await page.locator('[data-testid="vehicle-viewer"]').screenshot({path:`test-results/authored-${id}-battery.png`});
    await page.keyboard.press('Escape');
    await expect(canvas).toHaveAttribute('data-faded-vehicle-materials','0');
    await page.setViewportSize({width:390,height:844});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('button',{name:'실차 사진',exact:true})).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-renderer','webgl-3d-mesh');
    expect(errors).toEqual([]);
  });
}
