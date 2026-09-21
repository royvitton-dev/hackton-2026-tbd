# Vehicle exterior review — 2026-09-22

The user rejected the photo/3D comparison switch. It has been removed. Vehicles stay in the same WebGL model for orbit and battery focus. Original photographs remain reference/provenance assets; they are not a second vehicle presentation mode.

## Unfinished model work

BMW i5, Audi Q4, Audi Q6 and MINI Cooper Electric still use project-authored approximations. Their silhouette, glazing, grille, headlamps and wheel details are insufficiently faithful to the references. **These four models failed visual acceptance.** Loading a GLB, counting triangles and passing interaction tests do not establish photorealistic quality.

A revised procedural prototype adjusted the body/hood seam, curvature and glass material. Its screenshot still showed an inaccurate body and unrealistic windshield. It was rejected, and none of those prototype GLBs replaced the runtime files. The original model generator was restored.

## Image-to-mesh attempts

Only the supplied BMW stock-image cutout was uploaded to public image-to-3D demos. No workbook, user records, charging records or credentials were sent.

| Service | Request | Result |
| --- | --- | --- |
| Microsoft TRELLIS.2 | Public `gradio_api/call/start_session` | POST accepted; event stream returned `error` with `404: Not Found`. No mesh generated. |
| Microsoft TRELLIS.2 | Same request retaining anonymous session cookies | Same `404: Not Found` event error. No mesh generated. |
| Tencent Hunyuan3D-2.1 | Public `call/generation_all`, supplied cutout, 512 resolution | POST accepted; event stream returned `event: error`, `data: null`. The service supplied no further reason. No mesh generated. |
| Microsoft TRELLIS.2 official `@gradio/client@2.7.0` | Queue API: session, preprocessing, image-to-mesh | Session and preprocessing succeeded. Generation returned `ZeroGPU quota exceeded`: `120s requested vs. 0s left`. No mesh generated. The earlier convenience API error was not sufficient to identify this quota limit. |

No authenticated endpoint was bypassed and no failed generation was recorded as a successful model. Temporary prototype/API files are in the ignored research cache, not public runtime assets.

## Required next input

The remaining work needs a legitimately downloaded detailed GLB/GLTF/FBX for each exact vehicle, with its source/license, or an image-to-3D generation service with available GPU quota followed by visual inspection. No further anonymous GPU retries were made after the explicit quota error. Existing candidate/failure records are in `battery_health/resoures/images/sources/remaining-model-research-20260921.json` and `studio-20260921/model-research.json`.

Keep downloaded originals under `battery_health/resoures/images/sources/` and reviewed runtime GLBs under `battery_health/resoures/images/models/`. Connect the latter in `src/data/vehicleImageMap.ts`, record provenance and review in `model_sources.json`, then run asset sync. Clear a rejected visual review only after inspecting the corresponding replacement, including its default view, limited drag and battery focus.

`verify:assets` continues to check file integrity and synchronization. `verify:vehicle-3d` now also fails for an explicitly rejected visual review, so these four models cannot be reported as complete just because files exist.

## Validation of the UI correction

- `npm run lint`: passed.
- `npm run typecheck`: passed after correcting an optional `visualReview` access in the new test.
- `npm run vehicle:build`: passed (Next.js build, TypeScript and static generation).
- `node --import tsx --test tests/vehicle-assets.test.ts tests/authored-vehicles.test.ts`: 2 passed.
- Browser tests against production snapshot `ePVVDkTftwAxBmLZwUHOp` on port 3115: 2 passed. `authored-vehicles.spec.ts` (BMW) checked actual GLB response, bounded drag, battery transparency, restoration and mobile overflow. `user-images.spec.ts` switched Q4 → MINI → BMW → Q6 → Q4, checked no photo toggle, GLB renderer, battery panels, archived image hashes and mobile layout. No page errors were reported.
- `npm run verify:assets`: passed, 20 profile mappings / 16 original and cutout pairs, synchronized public assets.
- `npm run verify:vehicle-3d`: **failed as expected for the four visually rejected models**. This is an outstanding acceptance failure, not a completed rendering improvement.
- Reviewed the BMW browser screenshot after these changes: its body and windshield remain visibly inaccurate. No new exterior model is published by this change.
