param(
    [Parameter(Mandatory=$true)][string]$Label,
    [Parameter(Mandatory=$true)][string]$Command,
    [string[]]$CommandArgs = @(),
    [string]$Subdirectory = 'engine'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + '-' + $Label + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$evidence = Join-Path $TradingRoot "evidence\$runId"
New-Item -ItemType Directory -Path $evidence | Out-Null
$working = [IO.Path]::GetFullPath((Join-Path $TradingRoot $Subdirectory))
if (-not $working.StartsWith($TradingRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and $working -ne $TradingRoot) { throw 'Evidence command must run inside trading' }
$started = (Get-Date).ToUniversalTime().ToString('o')
$manifest = @{run_id=$runId; started_at=$started; cwd=$working; command=$Command; args=$CommandArgs; status='running'}
$manifest | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'run.json') -Encoding utf8
Push-Location $working
try {
    & $Command @CommandArgs 2>&1 | Tee-Object -FilePath (Join-Path $evidence 'output.log')
    $resultCode = $LASTEXITCODE
} finally { Pop-Location }
$manifest.ended_at = (Get-Date).ToUniversalTime().ToString('o')
$manifest.exit_code = $resultCode
$manifest.status = if ($resultCode -eq 0) {'passed'} else {'failed'}
$manifest | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'run.json') -Encoding utf8
Write-Output "Evidence: $evidence"
exit $resultCode
