import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const output = path.dirname(fileURLToPath(import.meta.url))
const project = path.resolve(output, '../../..')
const browserSource = 'trading/evidence/2026-09-21T14-37-05-534Z-browser-five-minute'
const observerSource = 'trading/evidence/2026-09-21T10-05-54-901Z-observe-0b80d28e/samples.jsonl'
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const read = p => fs.readFileSync(path.join(project, p))
const writeJSON = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n')
const number = s => Number(s.replaceAll(',', ''))
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
const imageDimensions = b => {
  if (b.subarray(1, 4).toString() === 'PNG') return {format:'PNG', width:b.readUInt32BE(16), height:b.readUInt32BE(20)}
  assert.equal(b.readUInt16BE(0), 0xffd8)
  let pos = 2
  while (pos < b.length) {
    assert.equal(b[pos], 0xff)
    const marker = b[pos + 1], length = b.readUInt16BE(pos + 2)
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return {format:'JPEG', height:b.readUInt16BE(pos + 5), width:b.readUInt16BE(pos + 7)}
    }
    pos += 2 + length
  }
  throw new Error('No JPEG start-of-frame size found')
}
const sources = []
const fingerprint = p => {
  const b = read(p)
  const record = { path: p, bytes: b.length, sha256: sha(b) }
  sources.push(record)
  return b
}
const triplets = (s, empty) => {
  const cells = s.split('\n').map(x => x.trim()).filter(Boolean)
  if (cells.join('').replace(/\s/g, '') === empty) return []
  assert.equal(cells.length % 3, 0)
  return Array.from({ length: cells.length / 3 }, (_, i) => ({price: number(cells[i * 3]), quantity: number(cells[i * 3 + 1]), orders: number(cells[i * 3 + 2])}))
}
const samples = []
for (let i = 1; i <= 6; i++) {
  const stem = String(i).padStart(2, '0')
  const x = JSON.parse(fingerprint(`${browserSource}/${stem}.json`))
  const png = fingerprint(`${browserSource}/${stem}.png`)
  const pngSize = imageDimensions(png)
  const chartSvg = x.chart.match(/<svg class="price-chart"[\s\S]*?<\/svg>/)?.[0]
  assert.ok(chartSvg)
  const lineTags = [...chartSvg.matchAll(/<path\b[^>]*>/g)].map(m => attributes(m[0]))
  const priceLine = lineTags.filter(x => x.stroke === '#fa623c' && x.fill === 'none')
  assert.equal(priceLine.length, 1)
  const line = priceLine[0].d
  const coordinates = [...line.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])])
  const bars = [...chartSvg.matchAll(/<rect\b[^>]*>/g)].map(m => attributes(m[0])).filter(x => ['#b1c6ba', '#f5b6a5'].includes(x.fill))
  const barGeometry = bars.map(r => Object.fromEntries(['x','y','width','height'].map(k => [k, Number(r[k])])))
  assert.equal(coordinates.length, 80)
  assert.equal(bars.length, 80)
  assert.ok(barGeometry.every(b => Math.abs(b.y + b.height - 215) < 1e-10 && b.height > 0))
  const bookRaw = x.bodyText.split('호가 보드\n')[1].split('\n03\n')[0]
  const bookContent = bookRaw.replace(/^가격 \(P\)\n잔량 \(시간\)\n주문\n/, '')
  const bm = bookContent.match(/^([\s\S]*?)\n([\d,]+) P\n현재가\n([\s\S]*?)\n매도\n가격을 누르면 주문에 입력됩니다\n매수$/)
  assert.ok(bm)
  const asks = triplets(bm[1], '매도호가대기중')
  const bids = triplets(bm[3], '매수호가대기중')
  const tapeRaw = x.bodyText.split('방금 체결된 거래\n')[1].split('쉬는 시간도,')[0]
  const tape = [...tapeRaw.matchAll(/(\d\d:\d\d:\d\d)\n([\d,]+)\n([\d,]+) h/g)].map(m => ({time_kst: m[1], price: number(m[2]), quantity: number(m[3])}))
  assert.equal(tape.length, 10)
  const sample = {
    index: i, source_json: `${browserSource}/${stem}.json`, source_png: `${browserSource}/${stem}.png`,
    started_at: x.started_at, ended_at: x.ended_at, capture_duration_ms: Date.parse(x.ended_at) - Date.parse(x.started_at),
    viewport: x.viewport, scroll: x.scroll, screenshot_encoding_and_dimensions: pngSize,
    event_seq: number(x.bodyText.match(/EVENT\n#([\d,]+)/)[1]),
    total_volume: number(x.bodyText.match(/누적 거래량\n([\d,]+) 시간/)[1]),
    current_price: number(bm[2]),
    resync_count: number(x.bodyText.match(/재동기화\n([\d,]+)/)[1]),
    bots_connected: number(x.bodyText.match(/(\d+)개 봇 연결 중/)[1]),
    connected_text_present: x.bodyText.includes('시장 연결됨'), engine_ready_text_present: x.bodyText.includes('엔진 정상 운영'),
    asks_display_order: asks, bids_display_order: bids,
    best_ask: asks.length ? asks.reduce((a,b) => a.price < b.price ? a : b) : null,
    best_bid: bids.length ? bids.reduce((a,b) => a.price > b.price ? a : b) : null,
    tape, book_numeric_sha256: sha(JSON.stringify({asks,bids})), tape_numeric_sha256: sha(JSON.stringify(tape.map(({price,quantity}) => ({price,quantity})))),
    tape_with_time_sha256: sha(JSON.stringify(tape)),
    chart: { price_line_d: line, coordinates, price_line_d_sha256: sha(line),
      volume_bar_geometry: barGeometry, volume_bar_geometry_sha256: sha(JSON.stringify(barGeometry)),
      volume_bar_colors: bars.map(b => b.fill),
      geometry_excludes: ['clock and axis text', 'all DOM text', 'transparent pointer hit rectangles', 'volume bar colors'],
      recent_trade_count: coordinates.length,
    },
  }
  samples.push(sample)
}
for (const p of ['capture-metadata.json', 'capture-function.txt', 'console.json']) fingerprint(`${browserSource}/${p}`)
fingerprint('trading/frontend/src/App.tsx')
const comparisons = samples.slice(1).map((b, i) => {
  const a = samples[i]
  return {from: a.index, to: b.index, capture_interval_ms: Date.parse(b.started_at) - Date.parse(a.started_at),
    event_delta: b.event_seq - a.event_seq, volume_delta: b.total_volume - a.total_volume,
    price_line_changed: a.chart.price_line_d !== b.chart.price_line_d,
    volume_bar_geometry_changed: a.chart.volume_bar_geometry_sha256 !== b.chart.volume_bar_geometry_sha256,
    changed_y_coordinates: a.chart.coordinates.filter((v,k) => v[1] !== b.chart.coordinates[k][1]).length,
    changed_volume_heights: a.chart.volume_bar_geometry.filter((v,k) => v.height !== b.chart.volume_bar_geometry[k].height).length,
    book_numeric_changed: a.book_numeric_sha256 !== b.book_numeric_sha256,
    tape_price_quantity_changed: a.tape_numeric_sha256 !== b.tape_numeric_sha256}
})
assert.ok(comparisons.every(x => x.price_line_changed && x.volume_bar_geometry_changed && x.book_numeric_changed && x.tape_price_quantity_changed && x.event_delta > 0 && x.volume_delta > 0))

// Bound the live append-only source once; parse only complete LF-terminated lines.
// All downstream recomputation uses preserved raw bytes, not subsequent live reads.
const observerAbsolute = path.join(project, observerSource)
const fd = fs.openSync(observerAbsolute, 'r')
const stat = fs.fstatSync(fd)
const buffer = Buffer.alloc(stat.size)
let readBytes = 0
while (readBytes < buffer.length) {
  const n = fs.readSync(fd, buffer, readBytes, buffer.length - readBytes, readBytes)
  if (!n) break
  readBytes += n
}
fs.closeSync(fd)
const bounded = buffer.subarray(0, readBytes)
const complete = bounded.subarray(0, bounded.lastIndexOf(10) + 1)
const rows = []
let offset = 0, lineNumber = 0
while (offset < complete.length) {
  const next = complete.indexOf(10, offset) + 1
  const raw = complete.subarray(offset, next)
  lineNumber++
  const value = JSON.parse(raw.toString())
  rows.push({line: lineNumber, byte_offset: offset, byte_length: raw.length, raw_sha256: sha(raw), raw, value})
  offset = next
}
const begin = Date.parse(samples[0].started_at), end = Date.parse(samples.at(-1).started_at)
const overlap = rows.filter(r => Date.parse(r.value.at) >= begin && Date.parse(r.value.at) <= end)
assert.ok(overlap.length > 2)
const before = rows.filter(r => Date.parse(r.value.at) < begin).at(-1)
const after = rows.find(r => Date.parse(r.value.at) > end)
assert.ok(before && after)
const preserved = [before, ...overlap, after]
const overlapRaw = Buffer.concat(overlap.map(r => r.raw))
const bracketRaw = Buffer.concat(preserved.map(r => r.raw))
fs.writeFileSync(path.join(output, 'observer-overlap.raw.jsonl'), overlapRaw)
fs.writeFileSync(path.join(output, 'observer-with-boundaries.raw.jsonl'), bracketRaw)
writeJSON('observer-line-map.json', preserved.map(({raw,value,...r}) => ({...r, at: value.at, event_seq: value.event_seq, volume: value.volume, role: r.line === before.line ? 'boundary_before' : r.line === after.line ? 'boundary_after' : 'overlap'})))
const values = overlap.map(r => r.value), first = values[0], last = values.at(-1)
const deltas = values.slice(1).map((b,i) => ({elapsed_ms: b.elapsed_ms - values[i].elapsed_ms, at_ms: Date.parse(b.at) - Date.parse(values[i].at), event_delta: b.event_seq - values[i].event_seq, volume_delta: b.volume - values[i].volume}))
const correlations = samples.map(s => {
  const t = Date.parse(s.started_at)
  const lo = preserved.filter(r => Date.parse(r.value.at) <= t).at(-1)?.value
  const hi = preserved.find(r => Date.parse(r.value.at) > t)?.value
  assert.ok(lo && hi)
  return {sample: s.index, browser_at: s.started_at, browser_seq: s.event_seq, browser_volume: s.total_volume,
    before: {at: lo.at, event_seq: lo.event_seq, volume: lo.volume}, after: {at: hi.at, event_seq: hi.event_seq, volume: hi.volume},
    seq_within_observer_bracket: lo.event_seq <= s.event_seq && s.event_seq <= hi.event_seq,
    volume_within_observer_bracket: lo.volume <= s.total_volume && s.total_volume <= hi.volume}
})
const observer = {source_path: observerSource, source_bytes_at_open: stat.size, bytes_read: readBytes, complete_prefix_bytes: complete.length,
  bounded_complete_prefix_sha256: sha(complete), discarded_partial_tail_bytes: readBytes - complete.length,
  overlap_copy_sha256: sha(overlapRaw), overlap_copy_bytes: overlapRaw.length,
  boundary_copy_sha256: sha(bracketRaw), boundary_copy_bytes: bracketRaw.length,
  original_lines: [overlap[0].line, overlap.at(-1).line], count: values.length,
  first, last, elapsed_ms: last.elapsed_ms - first.elapsed_ms,
  event_delta: last.event_seq - first.event_seq, volume_delta: last.volume - first.volume,
  distinct_book_hashes: new Set(values.map(x => x.book_hash)).size,
  distinct_last_prices: new Set(values.map(x => x.price)).size,
  max_interval_ms: Math.max(...deltas.map(x => x.elapsed_ms)), min_interval_volume_delta: Math.min(...deltas.map(x => x.volume_delta)),
  min_interval_event_delta: Math.min(...deltas.map(x => x.event_delta)),
  every_sample_engine_ready: values.every(x => x.engine_status === 'ready'),
  every_sample_bots_connected_12: values.every(x => x.bots_connected === 12),
  every_sample_bots_with_orders_and_trades_12: values.every(x => x.bots_with_orders === 12 && x.bots_with_trades === 12),
  all_total_points: [...new Set(values.map(x => x.total_points))], all_total_hours: [...new Set(values.map(x => x.total_hours))],
  gap_counts: [...new Set(values.map(x => x.websocket_gaps))], disconnect_counts: [...new Set(values.map(x => x.websocket_disconnects))],
  websocket_events_delta: last.websocket_events - first.websocket_events,
  intervals: deltas, browser_correlations: correlations,
  scope: 'Pre-existing observer API/WS samples corroborate server changes. They are not additional browser-render samples or a CPU/memory analysis.'}
const result = {created_at: new Date().toISOString(), read_only_review: true,
  scope: 'Six pre-existing DOM and PNG captures over more than five minutes, with matching pre-existing observer samples. No browser/API/service/build/test/source/docs/Git operation.',
  interval_ms: end - begin, browser_event_delta: samples.at(-1).event_seq - samples[0].event_seq,
  browser_volume_delta: samples.at(-1).total_volume - samples[0].total_volume,
  viewport_and_scroll_consistent: samples.every(s => s.viewport.width === 1280 && s.viewport.height === 720 && s.scroll.x === 0 && s.scroll.y === 324),
  console_captured_entries: JSON.parse(read(`${browserSource}/console.json`)).length,
  visually_reviewed_pngs: samples.map(s => s.source_png),
  screenshot_scope: 'Reviewer directly opened all six original PNGs. Chart line, volume bars, numeric order-book rows (or explicit empty bid side), and top tape rows are visible in every PNG. DOM read precedes screenshot; live values may change between them.',
  non_atomic_examples: [
    {sample:3, dom:'Best ask 1025 × 3, no ask at 1023', png:'Additional best ask 1023 × 2 visible'},
    {sample:5, dom:'Current price 979; asks 981 × 5 and 979 × 2', png:'Current price 981; ask 981 × 4'},
    {sample:6, dom:'Best ask 978 × 2', png:'Additional best ask 973 × 2 visible'},
  ],
  limitations: ['Six sampled frames, not a continuous video or proof of every rendered frame between samples.', 'DOM and screenshot acquisition are sequential, not an atomic market snapshot.', 'Event and cumulative volume are extracted from full bodyText even when their top/footer widgets are outside the fixed screenshot viewport.', 'Exact observer equality is not required: independent observation times bracket the browser event and volume.', 'Original .png-named screenshot files contain JPEG/JFIF bytes; original names and bytes remain unchanged.'],
  samples, comparisons, observer, sources}
writeJSON('analysis.json', result)
writeJSON('sources.sha256.json', sources)
console.log(JSON.stringify({output, interval_ms: result.interval_ms, browser_event_delta: result.browser_event_delta, browser_volume_delta: result.browser_volume_delta,
  samples: samples.map(({index,started_at,event_seq,total_volume,current_price,best_ask,best_bid}) => ({index,started_at,event_seq,total_volume,current_price,best_ask,best_bid})),
  comparisons, observer: {count: observer.count, original_lines: observer.original_lines, first: first.at, last: last.at, event_delta: observer.event_delta, volume_delta: observer.volume_delta, distinct_books: observer.distinct_book_hashes, max_interval_ms: observer.max_interval_ms, min_interval_volume_delta: observer.min_interval_volume_delta, bots12: observer.every_sample_bots_connected_12, gaps: observer.gap_counts, disconnects: observer.disconnect_counts, correlations}}, null, 2))
