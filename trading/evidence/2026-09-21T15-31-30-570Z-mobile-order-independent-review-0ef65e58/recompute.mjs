import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../../..')
const source='trading/evidence/2026-09-21T15-20-59-766Z-mobile-order-cancel-f43f0001'
const sourceDir=path.join(root,source),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const hashFiles=[]
const read=name=>{
  const b=fs.readFileSync(path.join(sourceDir,name))
  if(!hashFiles.some(x=>x.path===source+'/'+name))hashFiles.push({path:source+'/'+name,bytes:b.length,sha256:sha(b)})
  return b
}
const json=name=>JSON.parse(read(name))
const num=s=>Number(s.replaceAll(',',''))
const write=(name,x)=>fs.writeFileSync(path.join(out,name),JSON.stringify(x,null,2)+'\n')
const readBalance=text=>{
  const wallet=text.split('내 보관함\n모의 자산\n')[1].split('\nPARK CREW')[0]
  return {
    points_available:num(wallet.match(/사용 가능 포인트\n([\d,]+) P/)[1]),
    points_reserved:num(wallet.match(/매수 예약\n([\d,]+) P/)[1]),
    points_total:num(wallet.match(/포인트 총 보유\n([\d,]+) P/)[1]),
    hours_available:num(wallet.match(/사용 가능한 휴가\n([\d,]+)시간/)[1]),
    hours_reserved:num(wallet.match(/매도 예약\n([\d,]+) h/)[1]),
    hours_total:num(wallet.match(/휴가 총 보유\n([\d,]+) h/)[1]),
  }
}
const domNames=['before-dom.json','placed-dom.json','filled-dom.json','cancelled-dom.json','cancel-confirmed-dom.json','reload-dom.json','reload-confirmed-dom.json','reload-requests-dom.json']
const dom=domNames.map(name=>{
  const d=json(name),b=readBalance(d.text)
  assert.equal(b.points_available+b.points_reserved,b.points_total)
  assert.equal(b.hours_available+b.hours_reserved,b.hours_total)
  const axe=read(name.replace('.json','.txt')).toString()
  return {source:name,at:d.at,balance:b,viewport:d.viewport??null,
    recorded_width_within_viewport:d.viewport?d.viewport.documentWidth<=d.viewport.width:null,
    codes:d.codes??[],unique_codes:[...new Set(d.codes??[])],
    event_seq:num(d.text.match(/EVENT\n#([\d,]+)/)[1]),
    resync_count:num(d.text.match(/재동기화\n([\d,]+)/)[1]),
    request_tab_pressed:/button "요청 결과"[^\n]*\[pressed\]/.test(axe),
    open_tab_pressed:/button "미체결 \d+"[^\n]*\[pressed\]/.test(axe),
    cancel_confirmed:d.text.includes('취소가 확정되었습니다'),
  }
})
const secondText=read('second-placed-dom.txt').toString()
const secondWallet=secondText.split('heading "내 보관함"')[1].split('paragraph: PARK CREW')[0]
const axNumber=label=>num(secondWallet.match(new RegExp('generic: '+label+'\\r?\\n\\s*- (?:generic|strong): ([\\d,]+)'))[1])
const second={source:'second-placed-dom.txt',at:null,at_note:'This AX text has no capture timestamp; no file mtime or inferred agent time used.',
  points_available:axNumber('사용 가능 포인트'),points_reserved:axNumber('매수 예약'),points_total:axNumber('포인트 총 보유'),
  hours_available:axNumber('사용 가능한 휴가'),hours_reserved:axNumber('매도 예약'),hours_total:axNumber('휴가 총 보유'),
  resting_row_present:secondText.includes('row "매수 #116413 1P 0 / 1 h 미체결 주문 116413 취소"'),
  cancel_button_present:secondText.includes('button "주문 116413 취소"'),
  durable_command_text_present:secondText.includes('저장 완료 · 명령 #133569'),
}
assert.equal(second.points_available+second.points_reserved,second.points_total)
assert.equal(second.hours_available+second.hours_reserved,second.hours_total)
assert.ok(second.resting_row_present&&second.cancel_button_present&&second.durable_command_text_present)
const states=['before-state.json','placed-state.json','final-state.json'].map(name=>{
  const s=json(name),user=s.accounts.find(a=>a.id==='user-03')
  return {source:name,at:null,capture_at_note:'Raw API snapshot contains no capture timestamp; retain event_seq instead.',
    event_seq:s.event_seq,engine_status:s.engine_status,user,
    total_points:s.accounts.reduce((n,a)=>n+a.points_available+a.points_reserved,0),total_hours:s.accounts.reduce((n,a)=>n+a.hours_available+a.hours_reserved,0),
    user_orders:s.orders.filter(o=>o.account_id==='user-03'),user_trades:s.trades.filter(t=>t.buyer_id==='user-03'||t.seller_id==='user-03')}
})
const trade=states[1].user_trades.find(t=>t.maker_order_id===115979),firstOrder=states[1].user_orders.find(o=>o.id===115979)
assert.ok(trade&&firstOrder)
assert.deepEqual([trade.buyer_id,trade.seller_id,trade.price,trade.quantity],['user-03','bot-05',1,1])
assert.deepEqual([firstOrder.filled,firstOrder.remaining,firstOrder.status],[1,0,'filled'])
const ids=json('request-ids.json'),lookups=ids.map(id=>json('lookup-'+id+'.json'))
assert.equal(new Set(ids).size,3)
assert.ok(lookups.every(x=>x.account_id==='user-03'&&x.durable===true&&x.status==='accepted'&&ids.includes(x.request_id)))
const expectedMap={
  '58d34c2f-b20f-4d59-9b17-5824e9e46443':{action:'first buy',command_seq:133026,order_id:115979},
  '8856a37f-c621-494d-aef9-03f5b2280a71':{action:'second buy',command_seq:133569,order_id:116413},
  '37ba3596-827e-4a8e-a6ea-fff344185d1f':{action:'second-order cancel',command_seq:133574,order_id:116413},
}
for(const x of lookups){assert.equal(x.command_seq,expectedMap[x.request_id].command_seq);assert.equal(x.order_id,expectedMap[x.request_id].order_id)}
assert.deepEqual(new Set(dom.at(-1).unique_codes),new Set(ids))
assert.ok(dom.at(-1).request_tab_pressed)
const before=states[0].user,filled=states[1].user,final=states[2].user
assert.equal(filled.points_available+filled.points_reserved,before.points_available+before.points_reserved-trade.price*trade.quantity)
assert.equal(filled.hours_available+filled.hours_reserved,before.hours_available+before.hours_reserved+trade.quantity)
assert.equal(second.points_available,filled.points_available-1)
assert.equal(second.points_reserved,1)
assert.equal(final.points_available,second.points_available+second.points_reserved)
assert.equal(final.points_reserved,0)
assert.equal(final.hours_available,filled.hours_available)
assert.equal(final.trades_count,1)
assert.equal(final.orders_count,2)
assert.ok(states.every(s=>s.total_points===15000000&&s.total_hours===15000))
const imageDimensions=b=>{
  assert.equal(b.readUInt16BE(0),0xffd8)
  for(let p=2;p<b.length;){const marker=b[p+1],len=b.readUInt16BE(p+2);if([0xc0,0xc1,0xc2].includes(marker))return {format:'JPEG',height:b.readUInt16BE(p+5),width:b.readUInt16BE(p+7)};p+=2+len}
  throw Error('JPEG frame missing')
}
const images=['placed.jpg','cancel-confirmed.jpg','reload.jpg','reload-requests.jpg'].map(name=>({source:name,...imageDimensions(read(name)),directly_viewed:true}))
const consoleEntries=json('console.json'),reloadConsoleEntries=json('reload-console.json'),cleanup=json('browser-cleanup.json')
read('requests-dom.txt')
const sourceHashes=['trading/frontend/src/App.tsx','trading/frontend/src/useExchange.ts','trading/bots/bot.mjs'].map(file=>{const b=fs.readFileSync(path.join(root,file));return {path:file,bytes:b.length,sha256:sha(b)}})
const result={review_created_at:new Date().toISOString(),scope:'Offline raw JSON/AX/screenshot review and arithmetic only; no browser, process, build, order, API, service, Git or operational-source modification.',
  action_window_from_recorded_dom_at:{first:dom[0].at,last:dom.at(-1).at},cleanup_recorded_at:cleanup.at,
  dom,second_order_resting:second,states,trade,first_order:firstOrder,
  first_order_created_at:new Date(firstOrder.timestamp_ms).toISOString(),first_trade_at:new Date(trade.timestamp_ms).toISOString(),rested_before_fill_ms:trade.timestamp_ms-firstOrder.timestamp_ms,
  request_ids:ids,lookups,action_mapping_from_dom:expectedMap,
  checks:{first_fill_arithmetic:true,second_reserve_and_cancel_release:true,three_durable_lookup_records:true,three_unique_request_ids_restored_after_reload:true,
    all_three_api_snapshots_conserve_global_points_and_hours:true,
    measured_viewport_records:dom.filter(d=>d.viewport).length,all_recorded_widths_within_viewport:dom.filter(d=>d.viewport).every(d=>d.recorded_width_within_viewport),
    observed_resync_counts:[...new Set(dom.map(d=>d.resync_count))],captured_console_entries:consoleEntries.length,reload_console_entries:reloadConsoleEntries.length},
  images,cleanup,
  limitations:[
    'The first buy was intended to remain resting for cancellation but actually filled after 8.387 seconds; it was not cancelled. A separate second buy was cancelled.',
    'reload-dom and reload-confirmed-dom still show the open tab and only the latest cancel request code. Only reload-requests-dom proves the request tab and three restored unique UUIDs. The first attempted post-reload tab change was not evidenced as successful; exact cause is not established.',
    'App orderTab defaults to open and is component state; request records are independently restored from localStorage. No trace establishes whether the initial click failed, preceded a reload/remount, or was another automation timing issue.',
    'The returned command receipt preserves the original accepted resting result; an empty trades array in that receipt does not negate the later maker trade.',
    'The final public state no longer contains either historical order in its bounded recent terminal-order window. Do not use this absence alone to infer cancellation or lost history.',
    'Screenshot images show sampled visible portions. Request code DOM extraction proves UUID recovery; the screenshot alone does not expose all collapsed UUID details.',
    'No API-response capture timestamps are supplied for the three state JSON files or lookups. Use recorded event/command sequence and actual embedded order/trade timestamps; no inferred collection timestamp.',
    'Cleanup is supported by the original browser-cleanup record; no independent browser inventory or process check was performed in this review.',
  ],raw_hashes:hashFiles,source_hashes:sourceHashes}
write('review.json',result)
write('raw-and-source-sha256.json',[...hashFiles,...sourceHashes])
write('balance-and-trade-extract.json',{dom:dom.map(({source,at,balance})=>({source,at,balance})),second,states,trade,firstOrder,lookups})
console.log(JSON.stringify({checks:result.checks,first_order_created_at:result.first_order_created_at,first_trade_at:result.first_trade_at,rested_before_fill_ms:result.rested_before_fill_ms,action_window:result.action_window_from_recorded_dom_at,cleanup_at:cleanup.at,raw_files_hashed:hashFiles.length,images,second},null,2))
