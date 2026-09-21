import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../public',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL(root.href+'/plans/catalog.json'),'utf8'));
it('ships 30 distinct additional parking sites with source drawings and visual evidence',()=>{
 const parking=catalog.filter(s=>s.kind==='public-parking-plan');
 expect(catalog).toHaveLength(42);expect(parking).toHaveLength(30);expect(new Set(parking.map(s=>s.source)).size).toBe(30);
 expect(parking.filter(s=>s.address.includes('서울'))).toHaveLength(15);
 for(const s of parking){expect(s.parkingStatus).toBe('verified-in-published-plan');expect(s.parkingEvidence.note.length).toBeGreaterThan(10);expect(s.parkingEvidence.currentFacilityStatus).toBe('not-surveyed');expect(s.assets.length).toBeGreaterThan(0);expect(s.lat).toBeNull();expect(s.lng).toBeNull();}
});
it('checks every shipped original drawing against its recorded byte count and SHA256',()=>{
 const hashes=[];for(const s of catalog)for(const a of s.assets){const bytes=readFileSync(new URL(root.href+a.file));expect(bytes.length,a.file).toBe(a.bytes);expect(createHash('sha256').update(bytes).digest('hex'),a.file).toBe(a.sha256);hashes.push(a.sha256);}
 expect(new Set(hashes).size).toBe(hashes.length);
});

it('stores a source and explicit position precision for every catalog address',()=>{const locations=JSON.parse(readFileSync(new URL(root.href+'/plans/locations.json'),'utf8'));for(const site of catalog){const p=locations[site.id];expect(Number.isFinite(p.lat)&&Number.isFinite(p.lng)).toBe(true);expect(p.lat).toBeGreaterThan(33);expect(p.lat).toBeLessThan(39);expect(p.source).toMatch(/^https:/);expect(['address-result','address-area','publisher-unverified']).toContain(p.precision);}});


it('keeps B1–B4 source drawings separate and does not invent missing apartment basement plans',()=>{
 const building=catalog.find(s=>s.id==='multilevel-dogok');expect(building.assets.map(a=>a.floor)).toEqual(['B1','B2','B3','B4']);expect(new Set(building.assets.map(a=>a.sha256)).size).toBe(4);for(const a of building.assets){expect(a.sourcePage).toBe(17);expect(a.url).toContain('A0051136.pdf');expect(a.kind).toBe('parking-plan');}
 const apartment=catalog.find(s=>s.id==='complex-onepentas');expect(apartment.complexInfo.households).toBe(641);expect(apartment.basementFloors).toEqual(['B1','B2','B3','B4']);expect(apartment.parkingStatus).toBe('basement-plans-not-acquired');expect(apartment.assets.map(a=>a.floor)).toEqual(['SITE']);
 const references=JSON.parse(readFileSync(new URL(root.href+'/plans/complex-references.json'),'utf8'));expect(references[0].parkingSpaces).toBe(1509);expect(references[0].access).toBe('publisher-link-only');expect(references[0].levels.map(x=>x.page)).toEqual([12,13,14,22]);expect(references[0].lat).toBeUndefined();
});
