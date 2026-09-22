import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createMiniature,miniatureScale} from '../../src/address/miniature-model.js';
it('reuses the saved wall triangles without mutating the source or fabricating an exterior',()=>{
  const data=JSON.parse(readFileSync(new URL('../../public/generated/parking-159344-0.json',import.meta.url)));
  const original=JSON.stringify(data),model=createMiniature({siteId:'parking-159344'},data);
  expect(model.kind).toBe('drawing');expect(model.sourceMeshes).toBe(data.model.meshes.length);
  const triangles=model.root.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0);
  expect(triangles).toBe(data.model.meshes.reduce((n,m)=>n+m.indices.length/3,0)+12);
  expect(model.renderMeshes).toBeLessThan(model.sourceMeshes);expect(JSON.stringify(data)).toBe(original);model.dispose();
});
it('shrinks uniformly, caps large sites, and never substitutes a fake building for missing geometry',()=>{
  expect(miniatureScale({x:20,y:15,z:10},70)).toBeCloseTo(.7);
  expect(miniatureScale({x:200,y:4,z:100},70)*200).toBeCloseTo(25.2);
  expect(createMiniature({siteId:'empty'},{model:{meshes:[],objects:[]}})).toBeNull();
});
