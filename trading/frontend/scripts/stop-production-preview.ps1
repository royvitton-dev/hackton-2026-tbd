param([Parameter(Mandatory = $true)][string]$ManifestPath)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($manifest.kind -ne 'isolated-production-preview') { throw 'Unexpected manifest type.' }
function Owned-Process($item) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$item.pid)"
    if (-not $process) { return $false }
    if (-not $process.CommandLine -or -not $process.CommandLine.Contains($item.executable) -or -not $process.CommandLine.Contains($item.identity)) {
        throw "PID identity changed: $($item.pid). No signal sent."
    }
    return $true
}
$engine = $manifest.processes | Where-Object name -eq 'engine'
if ($engine -and (Owned-Process $engine)) {
    Invoke-RestMethod -Method Post -Uri ($manifest.api_url + '/api/admin/shutdown') -Headers @{ 'x-session-token' = 'demo-user-01' } -TimeoutSec 15 | Out-Null
    Wait-Process -Id $engine.pid -Timeout 30 -ErrorAction SilentlyContinue
    if (Get-Process -Id $engine.pid -ErrorAction SilentlyContinue) { throw 'Engine did not shut down normally; preserved for inspection.' }
}
$preview = $manifest.processes | Where-Object name -eq 'preview'
if ($preview -and (Owned-Process $preview)) { Stop-Process -Id $preview.pid; Wait-Process -Id $preview.pid -Timeout 10 -ErrorAction SilentlyContinue }
$manifest.status = 'stopped'
$manifest | Add-Member -NotePropertyName stopped_at -NotePropertyValue (Get-Date).ToString('o') -Force
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath
Write-Output "Preview stopped. All fixture data and evidence retained: $($manifest.run_dir)"
