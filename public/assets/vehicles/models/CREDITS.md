# Vehicle model credits

## Tesla Model 3

- File: `tesla_model_3.glb`
- Embedded GLB title: **Tesla White car.**
- Embedded author: **aarajesh**, https://sketchfab.com/aarajesh
- Original source: https://sketchfab.com/3d-models/tesla-white-car-2a4ee44439dc4b1b98f452a9ff427116
- License: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/
- Public distribution: https://github.com/Olrik-WP/TeslaHub/blob/main/src/TeslaHub.Web/public/community-models/community-m3-rigged.glb
- TeslaHub distribution credits also name **ChoochooLi**, “Tesla Model 3 (Realistic Graphics)”, CC BY 4.0. Both notices are retained because the embedded metadata differs from the distributor's notice.
- Prior modifications by distributor: rigging, Draco optimization, scale/orientation and material remapping.
- The original GLB is unchanged. A separate optimized derivative was generated with glTF Transform and meshoptimizer (681,368 → 146,003 triangles), but the original mesh is used at runtime to preserve body detail. Runtime orientation, scale, paint and focus transparency are modified.
- This is a representative pre-refresh Model 3; it is **not an exact 2026 trim/CAD model**.

No manufacturer GLB was bundled without a verifiable source. IONIQ 5 Sketchfab download was blocked by HTTP 401 (login required). Other detailed vehicle models remain to be supplied.

## Draco decoder

Decoder files under `public/assets/vehicles/decoders` are copied from the installed Three.js package. Draco: Google, Apache 2.0. https://github.com/google/draco/blob/main/LICENSE

## Tesla Model Y 2021

- Runtime file: `tesla_model_y_optimized.glb`
- Author: **763468712**, https://sketchfab.com/763468712
- Original model: https://sketchfab.com/3d-models/tesla-model-y-2021-c0a86cac582d4b33aba0fb1b1912d970
- License: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/
- Public archive: https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-124/c0a86cac582d4b33aba0fb1b1912d970.glb
- Source metadata: `../sources/tesla-model-y-glb-metadata.json`.
- Changes: mesh simplification (2,432,105 → 701,663 triangles), Draco compression, runtime scale/orientation/material adjustment. Original download 85,206,440 bytes; optimized 1,923,088 bytes.
- This is a 2021 representative model, **not an exact 2026 Model Y**.
