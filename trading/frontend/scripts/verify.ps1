param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$tradingRoot = Split-Path -Parent $frontendRoot
$verificationRunId = 'frontend-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$verificationDirectory = Join-Path $tradingRoot ('evidence/' + $verificationRunId)
New-Item -ItemType Directory -Path $verificationDirectory | Out-Null
Push-Location -LiteralPath $frontendRoot
try {
    Get-Command node, pnpm -ErrorAction Stop | Out-Null
    @("run_id=$verificationRunId", "started_at=$((Get-Date).ToString('o'))", "cwd=$frontendRoot", "node=$(node --version)", "scope=format check, protocol tests and local production build; not browser E2E") | Set-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
    # Native tools may print progress to stderr even when successful. Capture it
    # and use the process exit code rather than PowerShell's NativeCommandError.
    $ErrorActionPreference = 'Continue'
    pnpm format:check 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $verificationDirectory 'format.log')
    $formatExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    "format_exit=$formatExit" | Add-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
    if ($formatExit -ne 0) { throw "Frontend formatting check failed with exit code $formatExit" }
    $ErrorActionPreference = 'Continue'
    node --experimental-strip-types --test src/protocol.test.ts 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $verificationDirectory 'protocol.log')
    $protocolExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    "protocol_exit=$protocolExit" | Add-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
    if ($protocolExit -ne 0) { throw "Protocol tests failed with exit code $protocolExit" }
    if (-not $SkipBuild) {
        $ErrorActionPreference = 'Continue'
        pnpm build 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $verificationDirectory 'build.log')
        $buildExit = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        "build_exit=$buildExit" | Add-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
        if ($buildExit -ne 0) { throw "Frontend build failed with exit code $buildExit" }
    }
    "completed_at=$((Get-Date).ToString('o'))" | Add-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
    Write-Output "Frontend evidence: $verificationDirectory"
}
catch {
    "failed_at=$((Get-Date).ToString('o'))`nerror=$($_.Exception.Message)" | Add-Content -LiteralPath (Join-Path $verificationDirectory 'environment.txt')
    throw
}
finally { Pop-Location }
