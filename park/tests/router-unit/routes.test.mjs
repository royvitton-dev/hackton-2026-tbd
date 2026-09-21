import {describe,it,expect} from 'vitest';
import {APPS,NEXT_BASE_PATH,appPath,matchApp,privatePath,staticPath,redirectPath} from '../../server/routes.mjs';

describe('one server routes',()=>{
 it('serves the 3D battery dashboard with Next and redirects old vehicle links without losing the user or API path',()=>{
  expect(NEXT_BASE_PATH).toBe('/battery_health');
  expect(APPS.filter(app=>app.kind==='next').map(app=>app.id)).toEqual(['battery_health']);
  expect(APPS.filter(app=>app.kind==='vite').map(app=>app.id)).not.toContain('battery_health');
  expect(redirectPath('/battery_health','?user=U0037')).toBe('/battery_health/?user=U0037');
  expect(redirectPath('/battery_health/','?user=U0037')).toBeNull();
  expect(redirectPath('/vehicle','?user=U0037')).toBe('/battery_health/?user=U0037');
  expect(redirectPath('/vehicle/','?user=U0037&intro=pitstop')).toBe('/battery_health/?user=U0037&intro=pitstop');
  expect(redirectPath('/vehicle/api/users/U0037/sessions','?page=2')).toBe('/battery_health/api/users/U0037/sessions?page=2');
  expect(redirectPath('/vehicle/assets/vehicles/models/tesla_model_3.glb')).toBe('/battery_health/assets/vehicles/models/tesla_model_3.glb');
 });
 it('assigns unique paths to every supported project',()=>{expect(APPS).toHaveLength(11);expect(new Set(APPS.map(a=>appPath(a.id))).size).toBe(11);for(const a of APPS){expect(matchApp(appPath(a.id))).toBe(a);expect(matchApp(`/${a.id}`)).toBe(a);expect(matchApp(`${appPath(a.id)}nested/page`)).toBe(a);}expect(appPath('unknown')).toBeNull();expect(matchApp('/mapish/')).toBeNull();});
 it('preserves query strings through redirects and compatibility links',()=>{expect(redirectPath('/','?capture=1')).toBe('/park/?capture=1');expect(redirectPath('/map','?workspace=source-drive')).toBe('/map/?workspace=source-drive');expect(redirectPath('/apps/pinball/src/app.js','?v=1')).toBe('/pinball/src/app.js?v=1');expect(redirectPath('/apps/unknown/')).toBeNull();expect(redirectPath('/map/')).toBeNull();expect(redirectPath('/unknown')).toBeNull();});
 it.each(['/map/.env','/movie/.git/config','/movie/%2e%2e/README.md','/voice/private.pem','/park/key.KEY','/map/%00','/movie/..%5Csecret','/%xx'])('blocks private paths %s',p=>expect(privatePath(p)).toBe(true));
 it.each(['/map/plans/catalog.json','/park/node_modules/.vite/deps/three.js','/park/node_modules/.vite-unified/park/deps/three.js'])('permits public assets and dev module cache %s',p=>expect(privatePath(p)).toBe(false));
 it('limits static projects to published assets and preserves module paths',()=>{const movie=matchApp('/movie/'),pinball=matchApp('/pinball/');expect(staticPath(movie,'/movie/')).toBe('index.html');expect(staticPath(movie,'/movie/output/wonder-park-30s.mp4')).toBe('output/wonder-park-30s.mp4');expect(staticPath(pinball,'/pinball/vendor/three.module.js')).toBe('vendor/three.module.js');expect(staticPath(movie,'/movie/STORYBOARD.md')).toBe('STORYBOARD.md');for(const p of ['/movie/scripts/serve.mjs','/movie/package.json','/movie/assets/foo.exe','/movie/.env'])expect(staticPath(movie,p)).toBeNull();expect(staticPath(null,'/')).toBeNull();expect(staticPath(APPS[0],'/park/')).toBeNull();});
});
