# Five-minute browser evidence: independent raw review

The six fixed-view browser captures support the requirement to observe changing trades, depth, and chart over at least five minutes. They cover **328.583 seconds**, from **2026-09-21 14:37:43.050 UTC** to **14:43:11.633 UTC** (23:37:43.050–23:43:11.633 KST). This is six sampled browser frames plus pre-existing server observations, **not continuous video or proof of every rendered frame between captures**.

This review only read pre-existing files and ran an offline extraction/recalculation script. It made no browser, API, service, build, application-test, source, shared-document, or Git changes. Original captures and the running observer were not modified. Preparation sample 00 is excluded from the six-frame fixed-view claim.

## Original material and reproduction

- [Frozen capture metadata](../2026-09-21T14-37-05-534Z-browser-five-minute/capture-metadata.json) and [capture function](../2026-09-21T14-37-05-534Z-browser-five-minute/capture-function.txt).
- Original [01](../2026-09-21T14-37-05-534Z-browser-five-minute/01.png), [02](../2026-09-21T14-37-05-534Z-browser-five-minute/02.png), [03](../2026-09-21T14-37-05-534Z-browser-five-minute/03.png), [04](../2026-09-21T14-37-05-534Z-browser-five-minute/04.png), [05](../2026-09-21T14-37-05-534Z-browser-five-minute/05.png), and [06](../2026-09-21T14-37-05-534Z-browser-five-minute/06.png) images were all directly opened by the reviewer. Their matching `.json` files supply body text and chart outerHTML.
- Correctly suffixed **identical-byte JPEG copies** for rendering/user links: [01.jpg](rendered/01.jpg), [02.jpg](rendered/02.jpg), [03.jpg](rendered/03.jpg), [04.jpg](rendered/04.jpg), [05.jpg](rendered/05.jpg), [06.jpg](rendered/06.jpg). [copy-manifest.json](rendered/copy-manifest.json) records original and copy SHA-256 values, equal for all six. No conversion or image editing was performed.
- [analysis.json](analysis.json) preserves all extracted price-line `d` strings, all 80 coordinate pairs and 80 volume-bar geometries per frame, numeric depth rows, ten tape rows, each time/sequence/volume, and independent observer brackets.
- [analyze.mjs](analyze.mjs) is the exact offline extraction script; [analysis-tool-result.json](analysis-tool-result.json) records its successful exit 0 and output. Two earlier analysis-parser failures are retained separately: an incorrect PNG-encoding assumption and whitespace handling for an empty bid side. These were analysis-script issues, not exchange test failures. No product source was edited.
- [sources.sha256.json](sources.sha256.json) records the exact original capture bytes and the read-only `App.tsx` source hash used to identify chart and depth fields. [review-integrity.json](review-integrity.json) rechecks the original hashes after review and hashes derived output files.

All six DOM records report viewport **1280×720**, scroll **(0,324)**. The original `.png`-named image files actually contain **JPEG/JFIF 1265×712** bytes; their names and bytes are preserved unchanged. These are the dimensions of the browser tool's returned image result. This distinction does not change the visible evidence, imply an additional browser resize operation, or establish a product-layout failure.

## Browser values

Values below come from each single DOM read. Ask/bid notation is `price × remaining hours`; `none` is the explicit empty bid state. EVENT and cumulative volume come from full `bodyText`, including widgets outside the fixed screenshot viewport.

| Frame | DOM read started (UTC) | EVENT | Cumulative volume (h) | Last price | Best ask | Best bid | Newest tape price × h |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 01 | 14:37:43.050 | 117682 | 88821 | 979 | 980 × 2 | 974 × 1 | 979 × 1 |
| 02 | 14:38:33.774 | 117974 | 89051 | 1025 | 1027 × 1 | 1025 × 1 | 1025 × 1 |
| 03 | 14:39:35.164 | 118339 | 89360 | 1021 | 1025 × 3 | 1021 × 1 | 1021 × 1 |
| 04 | 14:41:06.178 | 118871 | 89758 | 972 | 974 × 1 | none | 972 × 2 |
| 05 | 14:42:15.939 | 119279 | 90095 | 979 | 979 × 2 | 978 × 4 | 979 × 1 |
| 06 | 14:43:11.633 | 119601 | 90330 | 973 | 978 × 2 | none | 973 × 1 |

The browser sequence advances **1919**, and cumulative traded hours advance **1509**. Every DOM record says the market is connected, the engine is ready, 12 bots are connected, and resynchronization count is 0. The captured [console list](../2026-09-21T14-37-05-534Z-browser-five-minute/console.json) has zero entries; this is the scope of that captured list, not a claim about all console activity outside this window.

The chart extraction selects only the actual orange `fill="none"` price path and the 80 colored volume rectangles within `svg.price-chart`. Price-line comparison uses only numeric `d` geometry; volume comparison uses only x/y/width/height, excluding text, colors, and transparent pointer hit boxes. Each frame contains 80 price coordinates and 80 volume bars. This establishes geometry changes independently of moving clock or axis labels.

| Pair | Capture gap (s) | Δ EVENT | Δ hours | Changed price y coordinates / 80 | Changed volume heights / 80 | Depth numbers changed | Tape price/quantity changed |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 01→02 | 50.724 | 292 | 230 | 80 | 35 | yes | yes |
| 02→03 | 61.390 | 365 | 309 | 80 | 34 | yes | yes |
| 03→04 | 91.014 | 532 | 398 | 80 | 27 | yes | yes |
| 04→05 | 69.761 | 408 | 337 | 80 | 32 | yes | yes |
| 05→06 | 55.694 | 322 | 235 | 77 | 33 | yes | yes |

Direct image review confirms that each captured image simultaneously shows the chart price line and volume bars, numeric depth (or its explicit empty bid side), and the top recent-trade rows. Frame 06 has a slightly taller depth/chart row as an additional ask row appears; the DOM viewport and scroll position stay unchanged.

The capture function reads DOM, then takes the screenshot. Their acquisition lasts 77–208 ms, so a screenshot can show a later real market state. For example, frame 05 DOM has last price 979 and asks 981×5/979×2, while its image shows last price 981 and ask 981×4. Frame 03 image includes an extra ask 1023×2, and frame 06 an extra ask 973×2. These are explicitly separate samples within each capture operation; no claim of atomic DOM/image equality is made.

## Existing observer corroboration

The live append-only source was read once to its observed byte length, with only complete newline-terminated JSON records parsed. The exact in-window lines **3210–3273** are preserved as [observer-overlap.raw.jsonl](observer-overlap.raw.jsonl); the immediately preceding and following lines are also preserved in [observer-with-boundaries.raw.jsonl](observer-with-boundaries.raw.jsonl). [observer-line-map.json](observer-line-map.json) records original line numbers, offsets, byte lengths, per-line hashes, UTC strings, sequence, and volume.

- Source: [main observer samples](../2026-09-21T10-05-54-901Z-observe-0b80d28e/samples.jsonl).
- 64 in-window records, **14:37:45.651–14:43:07.080 UTC**, 321.4314084 seconds by the observer monotonic elapsed clock.
- EVENT **117696→119574 (+1878)**; cumulative traded hours **88833→90308 (+1475)**. WS received-event count also advances 1878. Events are not treated as individual trades.
- Every one of the 63 adjacent observer intervals has positive sequence and traded-hour growth: minimum **26 events / 10 h**, maximum sampling gap **5.5950104 s**.
- **64 distinct book hashes**; all 64 records report engine `ready`, 12 connected bots, and 12 bots with cumulative orders/trades. The latter does not prove each individual bot traded in every interval.
- WS gap and disconnect counters remain **0**. Every record has total points **15000000** and total hours **15000**.
- Each of the six DOM sequence and cumulative-volume values lies between the immediately preceding and following observer values. Independent capture times make exact equality unnecessary; all six brackets are stored in `analysis.json`.
- Raw in-window copy SHA-256: `9d11020a1d680d8746e2cf1905d4c8ae4ff88aaa8b394048537f0c32d7dd6a19`.
- Raw copy including boundaries SHA-256: `3da7dec83e5d8e43b092792ed35a62f8bcc7f60cf3baf61f12006f5f01a78cce`.

The observer data corroborates sustained real engine activity between browser captures. It is not additional browser-render evidence or a CPU/memory analysis. This review supports the five-minute sampled-UI acceptance item without extending the claim to every intermediate rendered frame.
