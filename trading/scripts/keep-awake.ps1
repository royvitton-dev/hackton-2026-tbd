param(
    [Parameter(Mandatory=$true)][int]$OwnerPid,
    [Parameter(Mandatory=$true)][string]$EvidenceDir,
    [int]$MaxSeconds = 86520
)
$ErrorActionPreference = 'Stop'
$workRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$evidencePath = [IO.Path]::GetFullPath($EvidenceDir)
if (-not $evidencePath.StartsWith((Join-Path $workRoot 'evidence') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Keep-awake evidence must stay in trading/evidence' }
if ($MaxSeconds -lt 1 -or $MaxSeconds -gt 86520) { throw 'MaxSeconds must be 1..86520' }
$env:TEMP = Join-Path $workRoot '.tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
$owner = Get-Process -Id $OwnerPid -ErrorAction Stop
$ownerStarted = $owner.StartTime.ToUniversalTime()
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TradingExecutionState {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint flags);
}
'@
$record = @{helper_pid=$PID; owner_pid=$OwnerPid; owner_started_at=$ownerStarted.ToString('o'); started_at=(Get-Date).ToUniversalTime().ToString('o'); mechanism='SetThreadExecutionState ES_CONTINUOUS|ES_SYSTEM_REQUIRED; no display request or persistent power-policy change'; status='starting'; maximum_seconds=$MaxSeconds}
$recordPath = Join-Path $evidencePath 'keep-awake.json'
try {
    $previous = [TradingExecutionState]::SetThreadExecutionState([uint32]2147483649)
    if ($previous -eq 0) { throw 'SetThreadExecutionState failed' }
    $record.status = 'active'
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
    $timer = [Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $MaxSeconds -and -not (Test-Path -LiteralPath (Join-Path $evidencePath 'keep-awake.stop'))) {
        $currentOwner = Get-Process -Id $OwnerPid -ErrorAction SilentlyContinue
        if (-not $currentOwner -or $currentOwner.StartTime.ToUniversalTime() -ne $ownerStarted) { break }
        Start-Sleep -Seconds 2
    }
    $record.status = 'released'
} catch {
    $record.status = 'failed'
    $record.error = $_.Exception.Message
    throw
} finally {
    [void][TradingExecutionState]::SetThreadExecutionState([uint32]2147483648)
    $record.ended_at = (Get-Date).ToUniversalTime().ToString('o')
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8
}
