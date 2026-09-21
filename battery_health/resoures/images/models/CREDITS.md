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

Manufacturer models below have official source URLs. An open redistribution license is not stated for those assets. Other detailed vehicle models remain to be supplied.

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

## Hyundai IONIQ 5

- Author/rightsholder: Hyundai Motor Company / Hyundai Motor Company Australia.
- Source: https://www.hyundai.com/au/en/cars/eco/ioniq5
- Original: https://www.hyundai.com/content/dam/hyundai/au/en/cgi/ioniq5/IONIQ5-7.glb
- Variant configuration: https://www.hyundai.com/content/dam/hyundai/au/en/cgi/ioniq5/IONIQ5-2026.json
- License: manufacturer copyright. This is a publicly served configurator model; an open redistribution license is not stated. It is **not** a CC-licensed community model.
- Modifications: official stock trim and CyberGrey material selection, unused trim parts and configurator lights disabled. Geometry unchanged. Regional trim differences remain.
- Provenance and checksums: `sources/hyundai-ioniq5-preparation.json`. Original GLB/configuration are retained under `sources/`.

## Hyundai Kona Electric (2019)

- Author: RADMATTER12. License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
- Source: https://sketchfab.com/3d-models/2019-hyundai-kona-20896e8928d943dabcaaf67dbb53c9da
- Public archive: https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-024/20896e8928d943dabcaaf67dbb53c9da.glb
- Original author/license/source are also embedded in the GLB asset metadata.
- Modifications: deduplication, texture compression, Draco compression; all 248,120 triangles retained. Non-surface construction lines removed; front orientation, smooth normals and studio materials adjusted in the viewer.
- The asset is the 2019 first-generation electric model. It represents the model name only and differs from the workbook's 2026 generation. This is explicitly labeled in the scene.

## Kia EV6 GT-Line (facelift)

- Runtime file: `kia_ev6.glb` (389,487 rendered triangles, 10,051,168 bytes).
- Author/rightsholder: Kia Corporation.
- Official source: https://www.kia.com/in/vr/showroom/index.html#/exterior/4
- Public showroom assets: https://www.kia.com/in/vr/showroom/static/models/car4/
- License: manufacturer copyright; public showroom delivery does not state an open redistribution license. **Not CC licensed.**
- Changes: original PlayCanvas geometry, normals, UVs and part transforms converted to glTF; PBR material translation, texture compression, Draco compression. Non-vehicle `CV_Shadow` plane excluded. Draco removes degenerate faces. No replacement vehicle geometry generated.
- Original configuration, scene, downloaded assets, source URLs and SHA-256 checksums: `../sources/kia-ev6/`.
- Representative regional GT-Line exterior; workbook trim details can differ. The scene states this limitation.

## Kia EV9 GT-Line

- Runtime file: `kia_ev9.glb` (228,611 rendered triangles, 1,037,612 bytes).
- Author/rightsholder: Kia Corporation.
- Official source: https://worldwide.kia.com/int/vr-showroom/mea/ev9/lhd2/index.html
- Public showroom assets: https://worldwide.kia.com/int/vr-showroom/mea/ev9/lhd2/static/models/car0/
- License: manufacturer copyright; an open redistribution license is not stated. **Not CC licensed.**
- Changes: official exterior and 21-inch wheel geometry converted from PlayCanvas to glTF; source part placement retained, PBR material translation, texture/Draco compression. No replacement vehicle geometry generated.
- Original configuration, scene, downloaded assets, source URLs and SHA-256 checksums: `../sources/kia-ev9/`.
- Representative GT-Line exterior; regional/year/trim differences are disclosed in the scene.

## Kia EV3 Air (2025)

- Runtime file: `kia_ev3.glb` (472,105 rendered triangles, 7,368,648 bytes).
- Author/rightsholder: Kia Corporation / Kia Netherlands.
- Official source: https://www.kia.com/nl/kies-je-kia/online-showroom/
- Public geometry: https://dmz7vryp5nloi.cloudfront.net/viscircle/trunk/vehicles/Kia/EV3/nl_air_2025/mq.json
- License: manufacturer copyright; an open redistribution license is not stated. **Not CC licensed.**
- Converted original Blend4Web 6.01 vertices, signed-short normals, UVs and scene transforms to glTF. Original 17-inch wheel meshes are placed at the four source wheel anchors. Aventurine Green source color selected, shader channels translated to PBR, glass adapted to studio lighting, texture/Draco compression applied. Source shadow plane excluded. No body or wheel geometry generated.
- Source files, binary geometry, textures, URLs and checksums: `../sources/kia-ev3/`.
- Representative Netherlands Air 2025 exterior; year and trim differences are disclosed in the scene.

## Kia Niro EV (second generation)

- Runtime file: `kia_niro_ev.glb` (445,929 rendered triangles, 4,007,512 bytes).
- Author/rightsholder: Kia Corporation.
- Official source: https://www.kia.com/hk/en/showroom/niro-ev/vr-showroom.html
- Redirected showroom: https://worldwide.kia.com/int/vr-showroom/apac/sg2ev/rhd/index.html
- License: manufacturer copyright; an open redistribution license is not stated. **Not CC licensed.**
- Converted actual PlayCanvas geometry and compressed scene transforms to glTF; source body/interior/wheel geometry retained, separate shadow plane excluded, PBR translation and texture/Draco compression applied.
- Original data, source URLs and checksums: `../sources/kia-niro/`.
- Hong Kong right-hand-drive representative model. Exact workbook year/trim differs; the scene states this limitation.

## Hyundai Casper Electric — official 2026 configurator

- Source: https://casper.hyundai.com/vehicles/making/model
- Viewer: https://casper.hyundai.com/wcontents/configurator/ax07/pc/index.html
- Author/copyright: Hyundai Motor Company / Hyundai AutoEver. Public manufacturer asset; **no open redistribution license stated**. This is not a CC model.
- Source GLBs, original scene/config, FSC parts and color maps, per-file download URL/SHA-256: `battery_health/resoures/images/sources/hyundai-casper/`.
- Selected LHD FSC `6XS5ZDZ7ZCC069`, SAW exterior, NNB interior. Exact option package may differ from workbook.
- Original geometry retained; stock showroom shadow plane removed; compatible draw calls merged, opaque textures compressed, Draco compression.
- Runtime: `hyundai_casper_electric.glb`, 2,653,012 triangles, 15,337,036 bytes.

## Hyundai IONIQ 6 — 2025 Canadian Preferred Long Range

- Source: https://www.autotrader.ca/explore/hyundai/ioniq-6/build-your-own
- Public configurator: https://configurator.v2.londondynamics.com/by_product_id/e30a2277-db50-4c06-9223-22873d8899c9/hyundai-ioniq6-2025
- Author/rightsholder: Hyundai Motor Company / AutoTrader Pivot / London Dynamics. Public viewer asset; **no open redistribution license stated**. Not a CC model.
- Unmodified self-contained GLB: original body, doors, four wheels, seats and interior retained. No generated vehicle geometry or photo projection.
- Source configuration, URL, selected trim, SHA-256 and original GLB: `../sources/hyundai-ioniq6/`.
- Runtime: `hyundai_ioniq6_2025.glb`, 783,652 rendered triangles, 4,445,368 bytes.
- Representative 2025 Canadian trim; the UI discloses its difference from the workbook's 2026 vehicle.
- Runtime presentation uses silver body paint for the dark studio; source GLB remains unchanged. This is a display color, not a paint value from the charging workbook.

## Volvo EX30

- Author: LagzDesign / LAGZ26
- Original: https://sketchfab.com/3d-models/volvo-ex30-c5be588ea33d44cc8d2690ffdba389a4
- License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- Public redistribution: https://shop.americawant.com/wp-content/uploads/2026/08/volvo-ex30.glb
- Distributor attribution: https://shop.americawant.com/atribuciones/
- 2023 EX30 커뮤니티 외형 · 실내 미포함 · 2026 트림과 다름
- Original geometry retained; runtime orientation, grounding, material presentation and schematic battery added.

## Volkswagen ID.4

- Author: ItsDiyor
- Original: https://sketchfab.com/3d-models/volkswagen-id4-2021-502c1a0c911b4dfbaae57a7b25ec890f
- License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- Public redistribution: https://shop.americawant.com/wp-content/uploads/2026/08/volkswagen-id4.glb
- Distributor attribution: https://shop.americawant.com/atribuciones/
- 2021 ID.4 대표 외형 · 2026 트림과 다름
- Original geometry retained; runtime orientation, grounding, material presentation and schematic battery added.

## Project-authored BMW i5, Audi Q4/Q6 and MINI Cooper approximations (2026-09-22)

These four GLBs were authored by this project with `scripts/generate-authored-vehicles.mjs`. They contain curved body panels, glass, interior, lights and four volumetric wheel assemblies; no photograph or textured billboard is used. They are **approximate presentation geometry**, not manufacturer CAD, licensed scans, or photoreal reconstructions. The earlier failed download candidates remain in `model_sources.json` history. `downloaded` is false and `generated` is true.

Overall proportions reference the official BMW i5 technical data, Audi Q4/Q6 press information and MINI Cooper SE brochure; their URLs are recorded per model. Grilles, trim, panel curves and wheel designs are approximations. MINI geometry represents an electric hatchback; the user-supplied Cooper S photo is retained separately as a fixed reference. The model geometry is original project work; manufacturer trademarks and reference photographs retain their respective rights. No manufacturer license is asserted.

The separate battery pack is an interactive location schematic, not vehicle-specific battery CAD. Exterior fidelity remains below the downloaded manufacturer models, even though bounded orbit and internal battery visualization work.
