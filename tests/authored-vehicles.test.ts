import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import models from '../src/data/vehicleModelSources.json' with {type:'json'};

test('authored models are volumetric geometry with transparent-body and opaque-wheel material separation',()=>{
  const authored=models.filter(model=>'sourceType' in model&&model.sourceType==='project-authored');
  assert.equal(authored.length,4);
  for(const model of authored){
    assert.equal(model.manufacturerCad,false);
    assert.equal(model.downloaded,false);
    assert.equal(model.generated,true);
    const data=readFileSync(`public${model.glbPath}`);
    const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
    assert.equal(gltf.images?.length??0,0,'A photograph plane must not pass as authored geometry');
    assert.ok(gltf.nodes.some((node:{name:string})=>node.name==='wheel_tire'));
    assert.ok(gltf.nodes.some((node:{name:string})=>node.name==='glass'));
    assert.ok(gltf.nodes.some((node:{name:string})=>node.name==='paint'));
    const paint=gltf.meshes.find((mesh:{name:string})=>mesh.name==='paint');
    const positions=gltf.accessors[paint.primitives[0].attributes.POSITION];
    const span=positions.max.map((v:number,i:number)=>v-positions.min[i]);
    assert.ok(span[0]>3 && span[1]>.8 && span[2]>1.5,'Body must have length, height and width');
    assert.ok(model.displayNote?.includes('정밀 CAD 아님'));
  }
});
