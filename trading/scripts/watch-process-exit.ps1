param(
    [Parameter(Mandatory=$true)][int]$TargetPid,
    [Parameter(Mandatory=$true)][string]$ExpectedExecutable,
    [Parameter(Mandatory=$true)][string]$EvidenceDir,
    [int]$WaitSeconds = 120
)
$ErrorActionPreference = 'Stop'
$workRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = [IO.Path]::GetFullPath($EvidenceDir)
if (-not $output.StartsWith((Join-Path $workRoot 'evidence') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Exit evidence must remain in trading/evidence' }
if ($WaitSeconds -lt 1 -or $WaitSeconds -gt 300) { throw 'WaitSeconds must be 1..300' }
$recordFile = Join-Path $output 'process-exit.json'
if (Test-Path -LiteralPath $recordFile) { throw 'An exit record already exists; choose a fresh evidence directory' }
$record = @{observed_at=(Get-Date).ToUniversalTime().ToString('o');target_pid=$TargetPid;expected_executable=$ExpectedExecutable;status='starting';exit_code=$null;scope='Read-only process-handle observation; no signal or termination is sent'}
try {
    $watched = Get-Process -Id $TargetPid -ErrorAction Stop
    # Open and hold the original process handle before shutdown; PID polling alone
    # cannot establish exit status and can confuse a subsequently reused PID.
    $null = $watched.Handle
    if (-not [string]::Equals($watched.Path, [IO.Path]::GetFullPath($ExpectedExecutable), [StringComparison]::OrdinalIgnoreCase)) { throw 'Executable identity mismatch' }
    $record.process_started_at = $watched.StartTime.ToUniversalTime().ToString('o')
    $record.status = 'watching'
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordFile -Encoding utf8
    if (-not $watched.WaitForExit($WaitSeconds * 1000)) { throw 'Process did not exit within the observation window' }
    if ($null -eq $watched.ExitCode) { throw 'Process exit code unavailable' }
    $record.exit_code = $watched.ExitCode
    $record.status = 'exited'
} catch {
    $record.status = 'observation_failed'
    $record.error = $_.Exception.Message
} finally {
    $record.ended_at = (Get-Date).ToUniversalTime().ToString('o')
    $record | ConvertTo-Json | Set-Content -LiteralPath $recordFile -Encoding utf8
    if ($watched) { $watched.Dispose() }
}
$record | ConvertTo-Json
if ($record.status -ne 'exited') { exit 1 }
