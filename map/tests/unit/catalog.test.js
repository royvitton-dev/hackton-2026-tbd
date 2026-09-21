import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../public',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL(root.href+'/plans/catalog.json'),'utf8'));
it('ships 30 distinct additional parking sites with source drawings and visual evidence',()=>{
 const parking=catalog.filter(s=>s.kind==='public-parking-plan');
 expect(catalog).toHaveLength(40);expect(parking).toHaveLength(30);expect(new Set(parking.map(s=>s.source)).size).toBe(30);
 expect(parking.filter(s=>s.address.includes('서울'))).toHaveLength(15);
 for(const s of parking){expect(s.parkingStatus).toBe('verified-in-published-plan');expect(s.parkingEvidence.note.length).toBeGreaterThan(10);expect(s.parkingEvidence.currentFacilityStatus).toBe('not-surveyed');expect(s.assets.length).toBeGreaterThan(0);expect(s.lat).toBeNull();expect(s.lng).toBeNull();}
});
it('checks every shipped original drawing against its recorded byte count and SHA256',()=>{
 const hashes=[];for(const s of catalog)for(const a of s.assets){const bytes=readFileSync(new URL(root.href+a.file));expect(bytes.length,a.file).toBe(a.bytes);expect(createHash('sha256').update(bytes).digest('hex'),a.file).toBe(a.sha256);hashes.push(a.sha256);}
 expect(new Set(hashes).size).toBe(hashes.length);
});

it('stores a source and explicit position precision for every catalog address',()=>{const locations=JSON.parse(readFileSync(new URL(root.href+'/plans/locations.json'),'utf8'));for(const site of catalog){const p=locations[site.id];expect(Number.isFinite(p.lat)&&Number.isFinite(p.lng)).toBe(true);expect(p.lat).toBeGreaterThan(33);expect(p.lat).toBeLessThan(39);expect(p.source).toMatch(/^https:/);expect(['address-result','address-area','publisher-unverified']).toContain(p.precision);}});
