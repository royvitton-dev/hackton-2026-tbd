import {it,expect} from 'vitest';
import {dampHeading} from '../../src/core/camera.js';
it('eases left and right turns without an instantaneous corner snap',()=>{
 for(const direction of [-1,1]){let h=0;const target=direction*Math.PI/2;for(let i=0;i<180;i++){const next=dampHeading(h,target,1/60);expect(Math.abs(next-h)).toBeLessThanOrEqual(1.9/60+1e-12);expect(direction*(next-h)).toBeGreaterThanOrEqual(0);h=next;}expect(h).toBeCloseTo(target,4);}
});
it('crosses the ±180 degree boundary on the short arc',()=>{const start=179*Math.PI/180,target=-179*Math.PI/180;const next=dampHeading(start,target,1/60);expect(next).toBeGreaterThan(start);expect(next-start).toBeLessThan(2*Math.PI/180);});
it('is consistent across frame rates and caps long frame gaps',()=>{const follow=dt=>{let h=0;for(let t=0;t<2-dt/2;t+=dt)h=dampHeading(h,Math.PI/2,dt);return h;};expect(follow(1/30)).toBeCloseTo(follow(1/60),3);expect(dampHeading(0,Math.PI/2,10)).toBeLessThanOrEqual(1.9*.12);expect(dampHeading(1,1,0)).toBe(1);for(const args of [[NaN,0,0],[0,Infinity,0],[0,1,-1]])expect(()=>dampHeading(...args)).toThrow();});
