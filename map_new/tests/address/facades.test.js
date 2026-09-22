import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FACADES,isExteriorPhoto,photoHomography} from '../../src/address/facades.js';
import {buildingProfile} from '../../src/address/model.js';

describe('reviewed photographic facades',()=>{
  it('perspective-corrects each selected source patch without changing its four corners',()=>{
    const source=[[0,0],[1,0],[1,1],[0,1]];
    for(const facade of Object.values(FACADES))for(const material of Object.values(facade.materials)) {
      const q=material.photo.quad,h=photoHomography(q);
      source.forEach(([x,y],i)=>{const d=h[6]*x+h[7]*y+1;expect((h[0]*x+h[1]*y+h[2])/d).toBeCloseTo(q[i][0],9);expect((h[3]*x+h[4]*y+h[5])/d).toBeCloseTo(q[i][1],9);});
      expect(q.flat().every(n=>n>=0&&n<=1)).toBe(true);
    }
  });
  it('uses intact, reviewed exterior photos and excludes the kitchen even if its caption says scenery',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../../public/address/evidence.json',import.meta.url)));
    const byFile=new Map(manifest.places.flatMap(p=>p.photos.map(photo=>[photo.file,photo])));
    for(const [id,facade] of Object.entries(FACADES))for(const file of facade.photoFiles) {
      const photo=byFile.get(file);expect(photo?.reviewStatus).toBe('reviewed-exterior');expect(isExteriorPhoto(photo)).toBe(true);
      const bytes=readFileSync(new URL('../../public/'+file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(photo.sha256);
      expect(manifest.places.find(p=>p.siteId===id).photos.some(p=>p.file===file)).toBe(true);
    }
    expect(isExteriorPhoto({file:'address/photos/10000901-1.jpg',alt:'전경'})).toBe(false);
    expect(isExteriorPhoto({file:'new.jpg',alt:'주방 및 거실 전경'})).toBe(false);
    expect(byFile.has('address/photos/10000901-1.jpg')).toBe(false);
  });
  it('does not treat a drawing image extent as a surveyed facade and lets the original photo finish be restored',()=>{
    const site={siteId:'20000441'},plan={walls:[{x1:-150,z1:-100,x2:150,z2:100}]};
    const profile=buildingProfile(site,plan);expect(profile.footprintKind).toBe('photo-study');expect(profile.width).toBeLessThan(20);expect(profile.photoTexture).toBe(true);
    expect(buildingProfile(site,plan,{color:'#c0ffee'}).photoTexture).toBe(false);
    expect(buildingProfile(site,plan,{photoTexture:false}).photoTexture).toBe(false);
    expect(buildingProfile(site,plan,{})).toEqual(profile);
  });
});
