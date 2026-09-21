$ErrorActionPreference = 'Stop'
$experimentRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $experimentRoot 'scripts/env.ps1')
$evidencePath = $PSScriptRoot
$inputsPath = Join-Path $evidencePath 'inputs'
$binPath = Join-Path $evidencePath 'bin'
New-Item -ItemType Directory -Path $inputsPath,$binPath | Out-Null
$statesOriginal = Join-Path $experimentRoot 'evidence/2026-09-21T11-01-25-875Z-engine-load-8774ce30/states.json'
$activeOriginal = Join-Path $experimentRoot 'evidence/2026-09-21T11-23-36-419Z-ws-diagnostics-b338163c/verified-state.json'
$statesCopy = Join-Path $inputsPath 'states.json'
$activeCopy = Join-Path $inputsPath 'verified-state.json'
Copy-Item -LiteralPath $statesOriginal -Destination $statesCopy
Copy-Item -LiteralPath $activeOriginal -Destination $activeCopy
$originalBinary = Join-Path $experimentRoot 'engine/target/release/examples/ws_serialization_bench.exe'
$copiedBinary = Join-Path $binPath 'ws_serialization_bench.exe'
Copy-Item -LiteralPath $originalBinary -Destination $copiedBinary
Copy-Item -LiteralPath (Join-Path $experimentRoot 'engine/examples/ws_serialization_bench.rs') -Destination (Join-Path $evidencePath 'ws_serialization_bench.executed.rs')
Copy-Item -LiteralPath (Join-Path $experimentRoot 'engine/src/ws_frame.rs') -Destination (Join-Path $evidencePath 'ws_frame.executed.rs')
function Hash-File([string]$file) {
  [ordered]@{path=$file;bytes=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Protected-State {
  $manifestFile = Join-Path $experimentRoot 'data/demo-current.json'
  $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  $records = @($manifest.processes | ForEach-Object {
    $probe = Get-Process -Id $_.pid -ErrorAction SilentlyContinue
    [ordered]@{name=$_.name;pid=$_.pid;alive=[bool]$probe;start_time=if($probe){$probe.StartTime.ToUniversalTime().ToString('o')}else{$null}}
  })
  $observerProbe = Get-Process -Id 18184 -ErrorAction SilentlyContinue
  [ordered]@{manifest=Hash-File $manifestFile;run_id=$manifest.run_id;processes=$records;observer=[ordered]@{pid=18184;alive=[bool]$observerProbe;start_time=if($observerProbe){$observerProbe.StartTime.ToUniversalTime().ToString('o')}else{$null}}}
}
$before = Protected-State
if (@($before.processes | Where-Object { -not $_.alive }).Count -gt 0 -or -not $before.observer.alive) { throw 'Protected demo/observer not fully alive before experiment' }
if (@($before.processes | Where-Object { $_.name -eq 'engine' -and $_.pid -eq 20540 }).Count -ne 1) { throw 'Protected engine identity differs; stop without controlling it' }
$metadataPath = Join-Path $evidencePath 'metadata.json'
$reportPath = Join-Path $evidencePath 'report.json'
$cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfLogicalProcessors
$metadata = [ordered]@{
  prepared_at=[DateTime]::UtcNow.ToString('o')
  classification='Offline serialization microbenchmark alongside ordinary14-process demo and observer; not quiet service performance'
  limits=[ordered]@{warmup_per_real_state_method=20;iterations_per_real_state_method_pair=100;counting_first=50;timing_only_last=50;real_states=5;pairs=3;pair_order=@('AB','BA','AB');planned_encodes=3212;maximum_encodes=5000;encode_work_seconds=30;external_process_timeout_seconds=40}
  source_inputs=@((Hash-File $statesOriginal),(Hash-File $activeOriginal))
  copied_inputs=@((Hash-File $statesCopy),(Hash-File $activeCopy))
  source=@((Hash-File (Join-Path $experimentRoot 'engine/examples/ws_serialization_bench.rs')),(Hash-File (Join-Path $experimentRoot 'engine/src/ws_frame.rs')),(Hash-File (Join-Path $experimentRoot 'engine/Cargo.lock')))
  binary=Hash-File $copiedBinary
  rustc=@(& rustc --version --verbose)
  cargo=@(& cargo --version)
  build_evidence='evidence/20260921T113605520Z-ws-serialization-example-release-build-e3fcdd6b'
  host=[ordered]@{os=[Environment]::OSVersion.VersionString;logical_processors=[Environment]::ProcessorCount;cpu=$cpu}
  protected_before=$before
  measurement_note='Only uncounted rows compare time. Allocation rows have atomic increment overhead. Both retain allocator bool checks and clock/flag overhead. No networking, matching, fsync, snapshot construction or client parse inside measured boundary.'
}
[IO.File]::WriteAllText($metadataPath,($metadata|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
$started = [DateTime]::UtcNow
$process = Start-Process -FilePath $copiedBinary -ArgumentList @($statesCopy,$activeCopy,$metadataPath,$reportPath) -WorkingDirectory $experimentRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidencePath 'stdout.log') -RedirectStandardError (Join-Path $evidencePath 'stderr.log')
$finished = $process.WaitForExit(40000)
$forced = $false
if (-not $finished) { $forced=$true; $process.Kill(); $process.WaitForExit(3000) | Out-Null }
$process.Refresh()
$ended = [DateTime]::UtcNow
$after = Protected-State
$same = ($before|ConvertTo-Json -Depth 10 -Compress) -eq ($after|ConvertTo-Json -Depth 10 -Compress)
$run = [ordered]@{started_at=$started.ToString('o');ended_at=$ended.ToString('o');elapsed_ms=($ended-$started).TotalMilliseconds;pid=$process.Id;exit_code=$process.ExitCode;forced=$forced;protected_after=$after;protected_identical=$same;report_exists=(Test-Path -LiteralPath $reportPath)}
[IO.File]::WriteAllText((Join-Path $evidencePath 'run.json'),($run|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
Get-Content -LiteralPath (Join-Path $evidencePath 'stdout.log')
Get-Content -LiteralPath (Join-Path $evidencePath 'stderr.log')
$run | ConvertTo-Json -Depth 4
if($forced -or $process.ExitCode -ne 0 -or -not $same){exit 1}
