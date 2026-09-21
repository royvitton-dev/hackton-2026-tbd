import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const runDir = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await fs.readFile(path.join(runDir, 'processes.json'), 'utf8'))
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (item) => item.isDirectory()
    ? files(path.join(directory, item.name))
    : [path.join(directory, item.name)]))).flat()
}
const artifacts = await files(manifest.artifact_dir)
const results = []
for (let index = 0; index < artifacts.length; index += 8) {
  const batch = await Promise.all(artifacts.slice(index, index + 8).map(async (file) => {
    const relative = path.relative(manifest.artifact_dir, file).replaceAll('\\', '/')
    const response = await fetch(`${manifest.ui_url}/${relative}`, { signal: AbortSignal.timeout(5000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    const expected = await fs.readFile(file)
    return { asset: relative, status: response.status, content_type: response.headers.get('content-type'), bytes: bytes.length, sha256: digest(bytes), matches_artifact: digest(bytes) === digest(expected) }
  }))
  results.push(...batch)
}
const html = await fs.readFile(path.join(manifest.artifact_dir, 'index.html'), 'utf8')
const entry = html.match(/<script[^>]+src="([^"]+)"/)?.[1]
const entryText = entry ? await fs.readFile(path.join(manifest.artifact_dir, entry), 'utf8') : ''
const cors = await fetch(`${manifest.api_url}/api/state`, { headers: { Origin: manifest.ui_url }, signal: AbortSignal.timeout(5000) })
const state = await cors.json()
const denied = await fetch(`${manifest.api_url}/api/commands`, {
  method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5175', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-session-token' }, signal: AbortSignal.timeout(5000),
})
const report = {
  run_id: manifest.run_id, checked_at: new Date().toISOString(),
  asset_count: results.length, every_asset_ok_and_hash_matches: results.every((item) => item.status === 200 && item.matches_artifact),
  production_html: !!entry?.startsWith('/assets/') && !html.includes('/@vite/client') && !html.includes('/src/main.tsx'),
  explicit_isolated_api_in_bundle: entryText.includes(manifest.client_env.VITE_API_URL) && entryText.includes(manifest.client_env.VITE_WS_URL),
  api_status: cors.status, allowed_origin: cors.headers.get('access-control-allow-origin'),
  rejected_origin_not_allowlisted: denied.headers.get('access-control-allow-origin') === null,
  state_observation: { engine_status: state.engine_status, command_seq: state.command_seq, event_seq: state.event_seq, orders: state.orders?.length, trades: state.trades?.length },
  limitations: ['HTTP/static artifact verification only; no browser rendering or command submitted.', 'Vite preview does not apply Vercel routing/security-header settings or emulate TLS.', 'No Docker build or external deployment was run.'],
  assets: results,
}
report.passed = report.every_asset_ok_and_hash_matches && report.production_html && report.explicit_isolated_api_in_bundle && report.api_status === 200 && report.allowed_origin === manifest.ui_url && report.rejected_origin_not_allowlisted
await fs.writeFile(path.join(runDir, 'static-verification.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report, assets: `${results.length} entries retained in static-verification.json` }, null, 2))
if (!report.passed) process.exitCode = 1
