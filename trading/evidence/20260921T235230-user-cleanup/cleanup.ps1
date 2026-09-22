$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath('C:\project\hackton-2026-tbd\trading')
$taskEvidence=Join-Path $taskRoot 'evidence/20260921T235230-user-cleanup'
New-Item -ItemType Directory -Path $taskEvidence -Force | Out-Null
$taskAged=Join-Path $taskRoot 'evidence/2026-09-21T23-46-24-868Z-aged-recovery-c9333dea'
$taskCandidates=@((Join-Path $taskRoot '.tmp'),(Join-Path $taskRoot 'engine/target/debug/incremental'),(Join-Path $taskAged 'from-snapshot'),(Join-Path $taskAged 'from-genesis'))
$taskBusy=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('cargo.exe','rustc.exe','clippy-driver.exe','aged_recovery.exe','core_bench.exe') })
if ($taskBusy.Count) { throw 'Build or recovery process active; abort cleanup' }
$taskManifestBefore=(Get-FileHash (Join-Path $taskRoot 'data/demo-current.json') -Algorithm SHA256).Hash
$taskRecords=@()
foreach ($taskCandidate in $taskCandidates) {
  $taskFull=[IO.Path]::GetFullPath($taskCandidate)
  if (-not $taskFull.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup path escaped trading' }
  if (-not (Test-Path -LiteralPath $taskFull)) { continue }
  $taskResolved=(Resolve-Path -LiteralPath $taskFull).Path
  if ($taskResolved -ne $taskFull) { throw 'Unexpected resolved cleanup path' }
  $taskFiles=@(Get-ChildItem -LiteralPath $taskFull -Recurse -File -Force)
  $taskLinks=@(Get-ChildItem -LiteralPath $taskFull -Recurse -Force -Attributes ReparsePoint)
  $taskRecords += [pscustomobject]@{path=$taskFull;file_count=$taskFiles.Count;bytes=($taskFiles|Measure-Object Length -Sum).Sum;links=@($taskLinks|Select-Object FullName,LinkType,Target)}
}
$taskRecords | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskEvidence 'before.json') -Encoding utf8
foreach ($taskCopyName in @('from-snapshot','from-genesis')) {
  $taskCopy=Join-Path $taskAged $taskCopyName
  foreach($taskCopyFile in Get-ChildItem -LiteralPath $taskCopy -File) {
    if ($taskCopyFile.Name -eq 'writer.lock') { continue }
    $taskRawFile=Join-Path (Join-Path $taskAged 'raw-copy') $taskCopyFile.Name
    if (-not (Test-Path -LiteralPath $taskRawFile)) { throw "Duplicate input missing in raw-copy: $($taskCopyFile.Name)" }
    if ((Get-FileHash -LiteralPath $taskCopyFile.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $taskRawFile -Algorithm SHA256).Hash) { throw 'Duplicate input hash differs' }
  }
}
foreach ($taskRecord in $taskRecords) {
  foreach($taskLink in ($taskRecord.links | Sort-Object {$_.FullName.Length} -Descending)) {
    if (-not $taskLink.FullName.StartsWith($taskRecord.path+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Link escaped cleanup path'}
    $taskItem=Get-Item -LiteralPath $taskLink.FullName -Force
    if ($taskItem.PSIsContainer) { [IO.Directory]::Delete($taskLink.FullName,$false) } else { [IO.File]::Delete($taskLink.FullName) }
  }
  if (@(Get-ChildItem -LiteralPath $taskRecord.path -Recurse -Force -Attributes ReparsePoint).Count) { throw 'Remaining links; abort recursive delete' }
  Remove-Item -LiteralPath $taskRecord.path -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $taskRoot '.tmp') -Force | Out-Null
$taskAfter=[ordered]@{at=(Get-Date).ToUniversalTime().ToString('o');removed_bytes=($taskRecords|Measure-Object bytes -Sum).Sum;removed_files=($taskRecords|Measure-Object file_count -Sum).Sum;manifest_sha256_before=$taskManifestBefore;manifest_sha256_after=(Get-FileHash (Join-Path $taskRoot 'data/demo-current.json') -Algorithm SHA256).Hash;preserved=@('live demo and data/demo','.tools toolchain','source and tracked evidence','aged raw-copy and both FullCore outputs','final recovery report and SHA inventory');retained_raw_copy=(Test-Path (Join-Path $taskAged 'raw-copy'))}
if ($taskAfter.manifest_sha256_before -ne $taskAfter.manifest_sha256_after) { throw 'Demo manifest changed during cleanup' }
$taskAfter|ConvertTo-Json -Depth 5|Tee-Object -FilePath (Join-Path $taskEvidence 'completed.json')
