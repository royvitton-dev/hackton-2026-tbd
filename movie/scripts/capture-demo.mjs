import { chromium } from '../../node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('assets/wonder/demo',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(process.env.PARK_URL||'http://localhost:5190/?capture=1',{waitUntil:'domcontentloaded'});
 await page.locator('#world[data-ready=true]').waitFor({timeout:90000});
 await page.waitForFunction(()=>window.__park?.getState().attractions.length>=3);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#loading').waitFor({state:'hidden'});
 await page.evaluate(()=>{const v=window.__park.view;v.renderer.setAnimationLoop(null);v.setQuality('balanced');v.setTime(5);v.frame(performance.now());});
 const state=await page.evaluate(()=>window.__park.getState());
 await writeFile('assets/wonder/park-catalog.json',JSON.stringify({attractions:state.attractions.map(({id,name,english,theme,character,color})=>({id,name,english,theme,character,color})),capturedAt:new Date().toISOString()},null,2));
 await page.screenshot({path:'assets/wonder/park-reference.png'});
 if(!process.argv.includes('--inspect')){
  for(let i=0;i<90;i++){
   if(i===27){await page.locator('.attraction-card[data-id="dopamin"]').click();await page.evaluate(()=>{const v=window.__park.view;v.transition.start=performance.now()-2000;v.frame(performance.now());});}
   if(i===56){await page.getByRole('button',{name:'어트랙션 안내 닫기'}).click();await page.getByRole('button',{name:'야간 풍경',exact:true}).click();await page.evaluate(()=>{const v=window.__park.view;v.transition.start=performance.now()-2000;v.frame(performance.now());});}
   await page.evaluate(i=>{const v=window.__park.view;v.setTime(5+i/15);if(i<27){const a=.64+i*.002;v.camera.position.set(Math.sin(a)*62,36,Math.cos(a)*62);}v.frame(performance.now());},i);
   await page.screenshot({path:`assets/wonder/demo/${String(i).padStart(3,'0')}.jpg`,type:'jpeg',quality:93});
   if(i%30===0)console.log(`Park capture ${i}/90`);
  }
  await writeFile('assets/wonder/demo/manifest.json',JSON.stringify({fps:15,frames:90,errors},null,2));
 }
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Wonder Park capture complete.');
} finally {await browser.close();}
