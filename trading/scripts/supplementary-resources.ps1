param(
    [Parameter(Mandatory = $true)][DateTimeOffset]$UntilUtc,
    [ValidateRange(1, 300)][int]$IntervalSeconds = 30
)

$ErrorActionPreference = 'Stop'
$tradingRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifestFile = Join-Path $tradingRoot 'data\demo-current.json'
$startedAt = [DateTimeOffset]::UtcNow
if ($UntilUtc -le $startedAt -or $UntilUtc -gt $startedAt.AddHours(24)) {
    throw 'UntilUtc must be in the next 24 hours.'
}
$runId = $startedAt.ToString('yyyyMMddTHHmmssfffZ') + '-supplementary-resources-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$runDir = Join-Path $tradingRoot ('evidence\' + $runId)
New-Item -ItemType Directory -Path $runDir | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
function Save-Json($name, $value) {
    [IO.File]::WriteAllText((Join-Path $runDir $name), ($value | ConvertTo-Json -Depth 10), $utf8)
}
$initialManifestBytes = [IO.File]::ReadAllBytes($manifestFile)
[IO.File]::WriteAllBytes((Join-Path $runDir 'manifest-at-start.json'), $initialManifestBytes)
$logicalProcessors = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$run = [ordered]@{
    run_id = $runId; status = 'running'; sampler_pid = $PID
    started_at = $startedAt.ToString('o'); until_utc = $UntilUtc.ToUniversalTime().ToString('o')
    interval_seconds = $IntervalSeconds; logical_processors = $logicalProcessors
    manifest_file = $manifestFile; source_sha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash
    purpose = 'Supplementary resource counters; does not fill gaps in the original observer or issue market requests.'
}
Save-Json 'run.json' $run
Write-Output ($run | ConvertTo-Json -Compress)
$watch = [Diagnostics.Stopwatch]::StartNew()
$sampleCount = 0
try {
    while ([DateTimeOffset]::UtcNow -lt $UntilUtc -and -not (Test-Path -LiteralPath (Join-Path $runDir 'stop.request'))) {
        $sample = [ordered]@{ at = [DateTimeOffset]::UtcNow.ToString('o'); elapsed_ms = $watch.Elapsed.TotalMilliseconds }
        try {
            $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
            $entries = @($manifest.processes)
            if ($entries.Count -ne 14 -or @($entries | Select-Object -ExpandProperty pid -Unique).Count -ne 14) {
                throw 'Expected 14 distinct tracked process IDs.'
            }
            $sample.demo_run_id = $manifest.run_id
            $sample.expected_process_count = $entries.Count
            $rows = @(); $missing = @()
            foreach ($entry in $entries) {
                if (($entry.pid -isnot [int] -and $entry.pid -isnot [long]) -or $entry.pid -le 0 -or $entry.pid -gt [int]::MaxValue) { throw 'Invalid tracked process ID.' }
                try {
                    $item = Get-Process -Id $entry.pid -ErrorAction Stop
                    $item.Refresh()
                    $rows += [ordered]@{
                        Id = $item.Id; ProcessName = $item.ProcessName; role = $entry.name
                        StartTimeUtc = $item.StartTime.ToUniversalTime().ToString('o')
                        WorkingSet64 = $item.WorkingSet64; PrivateMemorySize64 = $item.PrivateMemorySize64
                        CPU = $item.TotalProcessorTime.TotalSeconds; Handles = $item.HandleCount
                    }
                } catch { $missing += @{ pid = $entry.pid; role = $entry.name; error = $_.Exception.Message } }
            }
            $sample.resources = $rows
            $sample.missing_processes = $missing
            $sample.complete = $rows.Count -eq $entries.Count
        } catch { $sample.collection_error = $_.Exception.Message; $sample.complete = $false }
        $sample.collection_finished_at = [DateTimeOffset]::UtcNow.ToString('o')
        [IO.File]::AppendAllText((Join-Path $runDir 'samples.jsonl'), (($sample | ConvertTo-Json -Depth 8 -Compress) + "`n"), $utf8)
        $sampleCount++
        if ($sampleCount -eq 1) { Write-Output ('first_sample_complete=' + $sample.complete + ' run=' + $runDir) }
        $remainingMs = ($UntilUtc - [DateTimeOffset]::UtcNow).TotalMilliseconds
        if ($remainingMs -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Min($IntervalSeconds * 1000, $remainingMs)) }
    }
    $run.status = 'completed'
    $run.stop_requested = Test-Path -LiteralPath (Join-Path $runDir 'stop.request')
} catch {
    $run.status = 'failed'; $run.error = $_.Exception.Message
    throw
} finally {
    $run.samples = $sampleCount
    $run.ended_at = [DateTimeOffset]::UtcNow.ToString('o')
    Save-Json 'run.json' $run
    Write-Output ($run | ConvertTo-Json -Compress)
}
