import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1150},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
await page.locator('.race-canvas[data-ready="true"]').waitFor();
await page.evaluate(()=>document.fonts.ready);
if(process.argv.includes('--buildings')){
  const venues=await page.evaluate(async()=>{
    const enginePath='/node_modules/three/build/three.module.js',sponsorPath='/src/graphics/sponsors.ts',venuePath='/src/graphics/sponsorVenues.ts';
    const T=await import(enginePath),{GS_SPONSORS}=await import(sponsorPath),{createSponsorVenue}=await import(venuePath);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,560);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    const output=[];
    for(const [index,sponsor]of GS_SPONSORS.entries()){
      const scene=new T.Scene();scene.background=new T.Color('#edf2e8');scene.add(new T.HemisphereLight('#eaf5ff','#839877',2));
      const sun=new T.DirectionalLight('#fff3d4',3.2);sun.position.set(-15,30,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-24;sun.shadow.camera.far=100;sun.shadow.normalBias=.04;scene.add(sun);
      const venue=createSponsorVenue('city-building',sponsor,index);scene.add(venue);const bounds=new T.Box3().setFromObject(venue),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
      const floor=new T.Mesh(new T.PlaneGeometry(70,70),new T.MeshStandardMaterial({color:'#e1e8da'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;scene.add(floor);
      const framing=Math.max(size.y*1.55,(size.x+size.z)*.98),aspect=640/560,camera=new T.OrthographicCamera(-framing*aspect/2,framing*aspect/2,framing/2,-framing/2,.1,150);
      camera.position.copy(center).add(new T.Vector3(27,19,34));camera.lookAt(center);renderer.render(scene,camera);
      output.push({name:sponsor.name,business:sponsor.business,features:venue.userData.features,dimensions:size.toArray(),png:renderer.domElement.toDataURL('image/png')});
      scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material]){material.map?.dispose();material.dispose();}}});
    }
    renderer.dispose();return output;
  });
  await fs.mkdir('reports/sponsors/buildings',{recursive:true});
  for(const venue of venues)await fs.writeFile(`reports/sponsors/buildings/${venue.business}.png`,Buffer.from(venue.png.split(',')[1],'base64'));
  await fs.writeFile('reports/sponsors/buildings.json',JSON.stringify(venues.map(({png,...venue})=>venue),null,2));
  await page.setViewportSize({width:1280,height:2360});
  await page.setContent(`<style>body{margin:0;background:#edf2e8;font:18px system-ui;color:#214e48}.buildings{display:grid;grid-template-columns:1fr 1fr}figure{margin:0}img{display:block;width:100%}figcaption{text-align:center;padding:0 0 20px}</style><div class="buildings">${venues.map(v=>`<figure><img src="${v.png}"><figcaption>${v.name}</figcaption></figure>`).join('')}</div>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  await page.screenshot({path:'reports/screenshots/sponsor-buildings.png',fullPage:true});
  console.log(JSON.stringify({venues:venues.map(({png,...venue})=>venue),errors}));await browser.close();process.exit(0);
}
if(process.argv.includes('--sponsors')){
  const posters=await page.evaluate(async()=>{
    const modulePath='/src/graphics/sponsors.ts';const {GS_SPONSORS,sponsorCanvas}=await import(modulePath);
    return GS_SPONSORS.map(sponsor=>({...sponsor,png:sponsorCanvas(sponsor).toDataURL('image/png')}));
  });
  await fs.mkdir('reports/sponsors/artwork',{recursive:true});
  for(const poster of posters)await fs.writeFile(`reports/sponsors/artwork/${poster.business}.png`,Buffer.from(poster.png.split(',')[1],'base64'));
  await fs.writeFile('reports/sponsors/artwork.json',JSON.stringify(posters.map(({png,...poster})=>poster),null,2));
  await page.setViewportSize({width:1100,height:860});
  await page.setContent(`<style>body{margin:0;background:#e9eee5;padding:24px;font:14px system-ui;color:#284740}.posters{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{display:block;width:100%;border-radius:6px}figcaption{padding:7px 0}</style><div class="posters">${posters.map(p=>`<figure><img src="${p.png}"><figcaption>${p.name} · ${p.caption}</figcaption></figure>`).join('')}</div>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  await page.screenshot({path:'reports/screenshots/sponsor-posters.png',fullPage:true});
  console.log(JSON.stringify({posters:posters.map(p=>p.name),errors}));await browser.close();process.exit(0);
}

await page.waitForTimeout(1500);
await fs.mkdir('reports/screenshots',{recursive:true});
await page.screenshot({path:'reports/screenshots/lobby.png',fullPage:true});
console.log(JSON.stringify({title:await page.title(),errors,canvas:await page.locator('canvas').count(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},null,2));
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(500);
await page.screenshot({path:'reports/screenshots/mobile.png',fullPage:true});
await browser.close();
