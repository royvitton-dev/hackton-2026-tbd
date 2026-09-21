import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import models from '../src/data/vehicleModelSources.json' with { type: 'json' };

test('photos and visually rejected meshes do not satisfy the required 3D asset gate', () => {
  const missing = models.filter(model => !model.available);
  const rejected = models.filter(model => model.visualReview?.status === 'rejected');
  const integrity = spawnSync(process.execPath, ['scripts/verify-vehicle-assets.mjs'], { encoding: 'utf8' });
  assert.equal(integrity.status, 0, integrity.stderr);
  const required3d = spawnSync(process.execPath, ['scripts/verify-vehicle-assets.mjs', '--require-3d'], { encoding: 'utf8' });
  assert.equal(required3d.status, missing.length || rejected.length ? 1 : 0, required3d.stderr);
  for (const model of missing) {
    assert.ok(required3d.stderr.includes(model.vehicleId), `Missing failure for ${model.vehicleId}`);
    assert.ok(required3d.stderr.includes('Static PNG cannot provide rotation or battery x-ray'));
  }
  for (const model of rejected) {
    assert.ok(required3d.stderr.includes(`${model.vehicleId}: 3D VISUAL REVIEW FAILED`));
  }
});
