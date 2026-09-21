import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'no-preference' } });

async function installPausedClock(page: Page) {
  // Pause before navigation. Reading Date.now() and pausing at +1ms in a second
  // browser round-trip races the running clock on slow/software-WebGL hosts.
  await page.clock.install({ time: new Date('2026-09-21T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-21T00:01:00Z'));
}

async function enterPaused(page: Page) {
  await page.goto('/?user=U0004&intro=pitstop');
  await expect.poll(async()=>{
    await page.clock.runFor(32);
    return page.locator('canvas[aria-label="피트 스톱 입장 애니메이션"]').evaluateAll(nodes=>nodes[0]?.getAttribute('data-pit-phase')??null);
  },{timeout:60000}).toBe('racing');
  await page.clock.runFor(400);
}

test('portal entry plays a finite WebGL sequence then restores the dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(()=>{
    const contexts: AudioContext[]=[];
    const Native=window.AudioContext;
    window.AudioContext=class extends Native { constructor(){super();contexts.push(this);} };
    (window as Window & {pitAudioStates?:()=>string[]}).pitAudioStates=()=>contexts.map(context=>context.state);
  });
  await installPausedClock(page);
  await enterPaused(page);
  const intro = page.getByRole('dialog');
  await expect(intro).toBeVisible();
  await expect(intro.locator('canvas')).toHaveAttribute('aria-label', '피트 스톱 입장 애니메이션');
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/intro=pitstop/);
  const sound=page.getByRole('button',{name:/^소리 (켜기|끄기)$/});
  if(await sound.getAttribute('aria-pressed')!=='true')await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed','true');
  await page.clock.fastForward(3300);
  await page.clock.runFor(32);
  await expect(intro).toHaveAttribute('data-phase','service');
  await page.screenshot({path:'test-results/pit-stop-entry.png'});
  await page.setViewportSize({width:390,height:844});
  await page.clock.runFor(32);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/pit-stop-mobile.png'});
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expect(intro).toHaveAttribute('data-phase','service');
  await expect(sound).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(32);
  await expect(intro).toHaveAttribute('data-phase','service');
  await page.clock.fastForward(4000);
  await expect(intro).toHaveCount(0, {timeout:30000});
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  await expect(page.getByTestId('health-score')).toHaveText('55');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as Window & {pitAudioStates:()=>string[]}).pitAudioStates())).toEqual(['closed']);
  await page.clock.resume();
  await page.reload();
  await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toBeEnabled();
  await expect(intro).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('entry supports skip and Escape without trapping the dashboard', async ({ page }) => {
  await installPausedClock(page);
  await enterPaused(page);
  await page.getByRole('button',{name:'건너뛰기 →'}).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/^소리 (켜기|끄기)$/})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button',{name:'건너뛰기 →'})).toBeFocused();
  await page.getByRole('button',{name:'건너뛰기 →'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  await enterPaused(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('unavailable WebGL falls back and always releases the dashboard', async ({ page }) => {
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,type:string,...args:unknown[]){
      return type.includes('webgl')?null:Reflect.apply(original,this,[type,...args]);
    }});
  });
  await installPausedClock(page);
  await page.goto('/?user=U0004&intro=pitstop');
  await expect.poll(async()=>{
    await page.clock.runFor(32);
    return page.getByRole('dialog').count();
  }).toBe(1);
  await page.clock.fastForward(11000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toBeEnabled();
  await expect(page.getByTestId('health-score')).toHaveText('55');
});

test('reduced motion skips the animation and ordinary visits do not show an intro', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?intro=pitstop');
  await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toBeEnabled();
  await expect(page).not.toHaveURL(/intro=pitstop/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/?user=U0004');
  await expect(page.getByRole('combobox',{name:'사용자 및 차량'})).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
