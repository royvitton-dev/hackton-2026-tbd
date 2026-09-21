import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  page.on('pageerror',error=>console.error(error.message));
  await page.goto('http://127.0.0.1:3000/?user='+(process.env.DEMO_USER??'U0002'),{timeout:60000});
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.modelTriangles)>100000,null,{timeout:60000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/refined-desktop.png',fullPage:true,timeout:60000});
  console.log(await page.locator('canvas').evaluate(c=>({triangles:c.dataset.modelTriangles,vehicle:c.dataset.vehicleId,renderer:c.dataset.renderer})));
  await page.getByRole('button',{name:/^Battery Info/}).click();await page.waitForTimeout(500);
  await page.screenshot({path:'test-results/refined-focus.png',fullPage:true,timeout:60000});
}finally{await browser.close();}
