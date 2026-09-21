param([int]$UiPort = 5177, [int]$EnginePort = 8790)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$tradingRoot = Split-Path -Parent $frontendRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$vitePath = Join-Path $frontendRoot 'node_modules/vite/bin/vite.js'
$tscPath = Join-Path $frontendRoot 'node_modules/typescript/bin/tsc'
$releasePath = Join-Path $tradingRoot 'engine/target/release/leave-engine.exe'
foreach ($port in @($UiPort, $EnginePort)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is occupied; existing processes were not changed."
    }
}
foreach ($file in @($vitePath, $tscPath, $releasePath)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing prerequisite: $file" }
}
$runId = 'frontend-production-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + '-' + ([guid]::NewGuid().ToString().Substring(0, 8))
$runDirectory = Join-Path $tradingRoot ('evidence/' + $runId)
$artifactDirectory = Join-Path $runDirectory 'dist'
$dataDirectory = Join-Path $runDirectory 'engine-data'
$binaryDirectory = Join-Path $runDirectory 'bin'
$enginePath = Join-Path $binaryDirectory 'leave-engine.exe'
$manifestPath = Join-Path $runDirectory 'processes.json'
New-Item -ItemType Directory -Path $binaryDirectory, $dataDirectory | Out-Null
Copy-Item -LiteralPath $releasePath -Destination $enginePath
$uiUrl = "http://127.0.0.1:$UiPort"
$apiUrl = "http://127.0.0.1:$EnginePort"
$manifest = [ordered]@{
    kind = 'isolated-production-preview'; run_id = $runId; started_at = (Get-Date).ToString('o')
    run_dir = $runDirectory; ui_url = $uiUrl; api_url = $apiUrl; artifact_dir = $artifactDirectory; data_dir = $dataDirectory
    node = (& $nodePath --version); engine_sha256 = (Get-FileHash -LiteralPath $enginePath -Algorithm SHA256).Hash
    source_app_sha256 = (Get-FileHash -LiteralPath (Join-Path $frontendRoot 'src/App.tsx') -Algorithm SHA256).Hash
    client_env = @{ VITE_API_URL = $apiUrl; VITE_WS_URL = "ws://127.0.0.1:$EnginePort/ws" }
    engine_env = @{ ENGINE_BIND = "127.0.0.1:$EnginePort"; ENGINE_DATA_DIR = $dataDirectory; ALLOWED_ORIGINS = $uiUrl }
    processes = @(); status = 'building'; commands = @()
}
function Save-Manifest { $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath }
function Wait-Http([string]$Url) {
    $deadline = (Get-Date).AddSeconds(25)
    do {
        try { if ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { return } } catch {}
        Start-Sleep -Milliseconds 150
    } while ((Get-Date) -lt $deadline)
    throw "Readiness timeout: $Url"
}
Save-Manifest
$savedEnvironment = @{}
foreach ($name in @('VITE_API_URL', 'VITE_WS_URL', 'ENGINE_BIND', 'ENGINE_DATA_DIR', 'ALLOWED_ORIGINS')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
Push-Location -LiteralPath $frontendRoot
try {
    $env:VITE_API_URL = $manifest.client_env.VITE_API_URL
    $env:VITE_WS_URL = $manifest.client_env.VITE_WS_URL
    $manifest.commands += @(@($nodePath, $tscPath, '-b'), @($nodePath, $vitePath, 'build', '--outDir', $artifactDirectory))
    $ErrorActionPreference = 'Continue'
    & $nodePath $tscPath -b 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $runDirectory 'typecheck.log')
    $typecheckExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($typecheckExit -ne 0) { throw "Typecheck failed: $typecheckExit" }
    $ErrorActionPreference = 'Continue'
    & $nodePath $vitePath build --outDir $artifactDirectory 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $runDirectory 'build.log')
    $buildExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($buildExit -ne 0) { throw "Production build failed: $buildExit" }
    Get-ChildItem -LiteralPath $artifactDirectory -Recurse -File | Get-FileHash -Algorithm SHA256 | Select-Object Path,Hash | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'artifact-sha256.json')
    $env:ENGINE_BIND = $manifest.engine_env.ENGINE_BIND
    $env:ENGINE_DATA_DIR = $manifest.engine_env.ENGINE_DATA_DIR
    $env:ALLOWED_ORIGINS = $manifest.engine_env.ALLOWED_ORIGINS
    $engineProcess = Start-Process -FilePath $enginePath -WorkingDirectory (Join-Path $tradingRoot 'engine') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory 'engine.stdout.log') -RedirectStandardError (Join-Path $runDirectory 'engine.stderr.log')
    $manifest.processes += @{ name = 'engine'; pid = $engineProcess.Id; executable = $enginePath; identity = $enginePath; args = @() }
    Save-Manifest
    Wait-Http "$apiUrl/health"
    $previewArguments = @($vitePath, 'preview', '--host', '127.0.0.1', '--port', [string]$UiPort, '--strictPort', '--outDir', $artifactDirectory)
    $previewProcess = Start-Process -FilePath $nodePath -ArgumentList $previewArguments -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory 'preview.stdout.log') -RedirectStandardError (Join-Path $runDirectory 'preview.stderr.log')
    $manifest.processes += @{ name = 'preview'; pid = $previewProcess.Id; executable = $nodePath; identity = $artifactDirectory; args = $previewArguments }
    Save-Manifest
    Wait-Http $uiUrl
    $manifest.status = 'ready'; $manifest.ready_at = (Get-Date).ToString('o')
    Save-Manifest
    Write-Output "PRODUCTION_PREVIEW_MANIFEST=$manifestPath"
    Write-Output "UI=$uiUrl ENGINE=$apiUrl PREVIEW_PID=$($previewProcess.Id) ENGINE_PID=$($engineProcess.Id)"
} catch {
    $manifest.status = 'failed'; $manifest.error = $_.Exception.Message
    Save-Manifest
    Write-Warning "Tracked fixture may need cleanup: ./scripts/stop-production-preview.ps1 -ManifestPath '$manifestPath'"
    throw
} finally {
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    Pop-Location
}
