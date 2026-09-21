import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'

const out = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(out, '../../..')
const files = [
  'README.md','package.json','package-lock.json','park/README.md','park/ROUTER.md',
  'park/server.mjs','park/server/apps.mjs','park/server/routes.mjs','park/server/trading-proxy.mjs',
  'scripts/build-unified.mjs','map/README.md','map/package.json','map/package-lock.json','map/src/main.js','map/src/mobility/main.js',
  'trading/README.md','trading/docs/ui.md','trading/docs/deployment.md','trading/docs/protocol.md',
  'trading/frontend/src/api.ts','trading/frontend/vite.config.ts','trading/frontend/package.json','trading/frontend/vercel.json',
  'trading/frontend/.env.example','trading/frontend/.env.production.example','trading/frontend/pnpm-workspace.yaml',
  'trading/attraction.json','trading/scripts/park-router-startup.mjs','trading/scripts/park-launcher.mjs','trading/scripts/demo.mjs','trading/scripts/setup.ps1',
]
const source = files.map(file => {
  const b = fs.readFileSync(path.join(root,file))
  const dest = path.join(out,'sources',file)
  fs.mkdirSync(path.dirname(dest),{recursive:true})
  fs.writeFileSync(dest,b,{flag:'wx'})
  return {path:file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),snapshot:'sources/'+file}
})
const lines = (file,start,end) => {
  const all=fs.readFileSync(path.join(out,'sources',file),'utf8').split(/\r?\n/)
  return {file,start,end,lines:all.slice(start-1,end).map((text,i)=>({line:start+i,text}))}
}
const audit = {
  at:new Date().toISOString(),method:'Read-only static document/source comparison; file copies and hashes only.',
  snapshot_timing:'Source snapshots and hashes are after the parent applied the two document fixes. Before-fix excerpts are preserved from the actual earlier tool reads; no complete before-fix file SHA was captured, and none is asserted.',
  scope:[
    'Root README startup, app routes, and command mappings; no audit of unrelated vehicle data/model claims.',
    'Park README startup and ROUTER installation, route, backend, origin and auto-start sections.',
    'Trading README startup/deployment pointers; UI standalone/integration sections; deployment standalone Vercel settings and Park registration paragraph; protocol endpoint/origin scope.',
    'Actual root npm scripts, map font imports and package/lock ownership, Vite middleware base/define, unified build base/output, API URL selection, proxy routes, launch endpoint and existing startup helper.',
    'No service, browser, API, dependency install, build, test, Git operation or operational/shared source/document modification.',
  ],
  findings:[
    {id:'F1',priority:'P2',title:'Park first-run copyable block omits required per-app dependency installation',
      document:'park/README.md',line_start:7,line_end:11,
      status:'resolved_by_parent_document_edit_read_back',
      before_excerpt:{tool_chunk_id:'095a29',text:'저장소 최상위 폴더에서 Node.js 22.12 이상으로 실행합니다.\n\n```sh\nnpm ci\nnpm run park:dev\n```'},
      resolution:'Current park/README.md:7 requires the complete ROUTER installation before launch and states root npm ci does not install nested app dependencies; line13 supplies exact npm --prefix map ci troubleshooting for the two font imports. Read-only re-review confirms the documentation gap is closed; no install/browser run performed.',
      issue:'The first Park startup block installs only root dependencies before park:dev. Root package.json has no workspaces or install hook for map. map/src/main.js and mobility/main.js import @fontsource-variable/dm-sans and @fontsource-variable/noto-sans-kr, declared only in map package/lock, not the root package/lock. Thus a fresh checkout following only this block leaves these imports uninstalled.',
      qualification:'The correct npm --prefix map ci command is already present in park/ROUTER.md:7, and map/README.md:6-8 installs locally. Root README:9 also explicitly points to per-app installs. The problem is the incomplete first Park copy/paste path, not an absent map dependency declaration or total absence of instructions. No fresh-install failure was reproduced in this audit.',
      minimum_fix:'Before the first Park launch command, make ROUTER installation a mandatory prerequisite and include its per-app install block, or replace the incomplete block with a direct prerequisite link and a post-install launch-only block. Keep root and Park quickstarts consistent. State that root npm ci does not install nested app packages.',
      evidence:[lines('park/README.md',5,23),lines('park/ROUTER.md',3,13),lines('README.md',5,12),lines('map/package.json',19,26),lines('map/src/main.js',1,5),lines('map/src/mobility/main.js',1,4)]},
    {id:'F2',priority:'P2',title:'Deployment instruction to replace attraction.json URL no longer changes integrated Park destination',
      document:'trading/docs/deployment.md',line_start:114,line_end:114,
      status:'resolved_by_parent_document_edit_read_back',
      before_excerpt:{tool_chunk_id:'23b972 and initial deployment full read',text:'Wonder Park에는 `trading/attraction.json`으로 로컬 독립 UI 주소를 등록했다. 후속 사용자 요청에 따라 파크 시작과 거래소 입장 API가 `demo.mjs ensure`를 호출해 로컬 UI·엔진·봇을 자동 준비하거나 기존 실행을 재사용한다. 최초 의존성 준비는 별도로 필요하다. 공개 환경에서는 로컬 프로세스 자동 실행 대신 별도 배포를 구성하고 등록 URL도 실제 HTTPS UI 주소로 교체한다. 다른 호스트용 선택적 React 어댑터와 실제 검증 범위는 `ui.md`에 있다.'},
      resolution:'Current deployment.md:114-116 explicitly documents same-origin /trading/ and /trading/backend/, then states attraction.json URL changes do not redirect the current Park entry to Vercel. Standalone HTTPS UI/HTTPS-WSS engine and unvalidated public Park routing are separated. Read-back agrees with server and api.ts.',
      issue:'The public-deployment paragraph tells the operator to replace the registered URL with the actual HTTPS UI. The current POST /api/launch uses appPath(id) and req.headers.host unconditionally after preparation; it never uses attraction.url for the destination. Changing trading/attraction.json.url therefore cannot send the integrated Park button to a standalone Vercel UI.',
      minimum_fix:'Replace this instruction with explicit modes: local Park always uses /trading/ and /trading/backend/; a separately deployed standalone Vercel UI is opened at its own HTTPS origin with VITE_API_URL/VITE_WS_URL. Do not claim attraction.json URL changes the current router destination. If a future external-link mode is wanted, document it only after implementation/validation.',
      evidence:[lines('trading/docs/deployment.md',107,118),lines('park/server.mjs',83,94),lines('park/server/routes.mjs',1,15),lines('trading/docs/ui.md',54,60)]},
  ],
  matched:[
    {area:'Root npm aliases',result:'dev and park:dev -> node park/server.mjs; build and park:build -> scripts/build-unified.mjs; start and park:preview -> park/server.mjs --production. Current README routing description agrees.'},
    {area:'Map dependencies',result:'map/package.json and its lock both declare the two exact variable-font packages; ROUTER has npm --prefix map ci. No missing dependency declaration found.'},
    {area:'Standalone UI',result:'frontend pnpm dev binds127.0.0.1:5175; default API8787 and WS8787/ws; docs match. setup.ps1 installs/builds frontend and release engine; demo.mjs supports all documented start/ensure/status/stop/restart actions.'},
    {area:'Integrated UI',result:'apps.mjs applies /trading/ base and true VITE_ROUTER_MODE; unified build applies --base /trading/. api.ts derives same-origin /trading/backend and /trading/backend/ws, and proxy strips the prefix. UI.md and trading README agree.'},
    {area:'Backend selection and auto-start',result:'TRADING_ENGINE_URL then ENGINE_API_URL then default8787; helper only manages matching local HTTP endpoints, skips external/HTTPS/different port. ROUTER documents this; source shares pending preparation and launch waits for it.'},
    {area:'Standalone Vercel',result:'Root Directory trading/frontend, pnpm build, dist, no unified --base flag and no router define; API uses VITE_API_URL/VITE_WS_URL as documented. Public HTTPS/WSS checks and explicit absence of actual external deployment are correctly scoped.'},
    {area:'Protocol endpoint scope',result:'protocol.md explicitly describes direct standalone engine /api/* and /ws. It lacks an integrated proxy mapping sentence but is not incorrect about engine endpoints. Optional link-only clarification is not elevated into a required finding.'},
    {area:'Origin documentation',result:'Direct engine Origin allowlist in protocol/deployment and same-origin gateway validation then Origin stripping in ROUTER describe different modes consistently.'},
  ],
  limitations:[
    'This audit does not reproduce the user map font error or establish its exact runtime cause; it identifies a concrete fresh-install documentation gap supported by manifests/imports.',
    'No external official documentation was re-queried; existing Vercel service capability claims are outside this static current-repository consistency audit.',
    'No full unified-server startup, routing request, external Vercel deployment or command success was inferred from static source.',
  ],source,
}
fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(audit,null,2)+'\n')
fs.writeFileSync(path.join(out,'source-sha256.json'),JSON.stringify(source,null,2)+'\n')
console.log(JSON.stringify({output:out,source_files:source.length,findings:audit.findings.map(({id,priority,title})=>({id,priority,title})),source_sha256:source.filter(x=>['park/server.mjs','trading/frontend/src/api.ts','trading/docs/deployment.md','park/README.md'].includes(x.path))},null,2))
