import {chromium} from '@playwright/test';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{user:{type:'string',default:process.env.DEMO_USER??'U0002'},'base-url':{type:'string',default:process.env.DEMO_BASE_URL??'http://127.0.0.1:3000'},name:{type:'string',default:process.env.DEMO_NAME??'refined'}}});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const prefix=values.name;
  await page.goto(values['base-url']+'/?user='+encodeURIComponent(values.user),{timeout:60000});
  await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c?.dataset.renderer==='webgl-cutout'?!!c.dataset.cutoutPath:Number(c?.dataset.modelTriangles)>100000;},null,{timeout:60000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:`test-results/${prefix}-desktop.png`,fullPage:true,timeout:60000});
  console.log(await page.locator('canvas').evaluate(c=>({triangles:c.dataset.modelTriangles,vehicle:c.dataset.vehicleId,renderer:c.dataset.renderer})));
  await page.getByRole('button',{name:/^(배터리 정보 보기|Battery Info)/}).click();await page.waitForTimeout(500);
  await page.screenshot({path:`test-results/${prefix}-focus.png`,fullPage:true,timeout:60000});
  if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
