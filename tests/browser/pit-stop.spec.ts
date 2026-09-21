import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'no-preference' } });

async function installPausedClock(page: Page) {
  // Pause before navigation. Reading Date.now() and pausing at +1ms in a second
  // browser round-trip races the running clock on slow/software-WebGL hosts.
  await page.clock.install({ time: new Date('2026-09-21T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-21T00:01:00Z'));
}

async function enterPaused(page: Page, silentStart = true) {
  await page.goto('/?user=U0004&intro=pitstop');
  await expect.poll(async()=>{
    await page.clock.runFor(32);
    return page.locator('canvas[aria-label="피트 스톱 입장 애니메이션"]').evaluateAll(nodes=>nodes[0]?.getAttribute('data-pit-phase')??null);
  },{timeout:60000}).toBe('racing');
  if (silentStart && await page.getByRole('button', { name: '무음으로 시작' }).isVisible()) {
    await page.getByRole('button', { name: '무음으로 시작' }).click();
  }
  await page.clock.runFor(400);
}

test('blocked autoplay waits for a click, produces an audio signal, and closes on skip', async ({ page }) => {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [], analysers: AnalyserNode[] = [];
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      private resumeCalls = 0;
      constructor() { super(); contexts.push(this); void this.suspend(); }
      resume() {
        // Deterministic autoplay denial: Playwright evaluation itself can mark
        // a document as user-activated. The actual button resumes the next call.
        this.resumeCalls++;
        return this.resumeCalls === 1 ? new Promise<void>(() => {}) : super.resume();
      }
    };
    const connect = AudioNode.prototype.connect;
    Object.defineProperty(AudioNode.prototype, 'connect', { value: function(this: AudioNode, destination: AudioNode, ...args: unknown[]) {
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser(); analysers.push(analyser);
        Reflect.apply(connect, this, [analyser]);
      }
      return Reflect.apply(connect, this, [destination, ...args]);
    } });
    (window as Window & { pitAudioProbe?: () => { states: string[]; rms: number } }).pitAudioProbe = () => ({
      states: contexts.map(context => context.state),
      rms: Math.max(0, ...analysers.map(analyser => {
        const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      })),
    });
  });
  await installPausedClock(page);
  await enterPaused(page, false);
  await page.clock.fastForward(8000);
  await expect(page.getByRole('dialog')).toHaveAttribute('data-phase', 'racing');
  await expect(page.getByRole('button', { name: '소리와 함께 시작' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(32);
  const skipButton = page.getByRole('button', { name: '건너뛰기 →' });
  await expect(skipButton).toBeVisible();
  const skipBounds = await skipButton.boundingBox();
  expect(skipBounds!.y).toBeLessThan(80);
  expect(skipBounds!.x + skipBounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/pit-stop-sound-start-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.clock.runFor(32);
  await page.getByRole('button', { name: '소리와 함께 시작' }).click();
  await expect(page.getByRole('button', { name: '소리 끄기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(500);
  const probe = () => page.evaluate(() => (window as Window & { pitAudioProbe?: () => { states: string[]; rms: number } }).pitAudioProbe!());
  await expect.poll(async () => (await probe()).rms).toBeGreaterThan(0.001);
  await page.clock.fastForward(3300);
  await page.clock.runFor(32);
  await expect(page.getByRole('dialog')).toHaveAttribute('data-phase', 'service');
  await expect.poll(async () => (await probe()).rms).toBeGreaterThan(0.0001);
  await page.getByRole('button', { name: '소리 끄기', exact: true }).click();
  await expect.poll(async () => (await probe()).states).toEqual(['suspended']);
  await page.getByRole('button', { name: '건너뛰기 →' }).click();
  await expect.poll(async () => (await probe()).states).toEqual(['closed']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

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
