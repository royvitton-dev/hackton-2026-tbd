[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while (-not (Test-Path -LiteralPath 'C:\project\hackton-2026-tbd\trading\evidence\2026-09-21T08-46-52-567Z-network-bench-baseline-fixed-harness-a05b756b\B\memory.stop')) {
  $sampleRows = @(Get-Process -Id 18860,9332 -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ pid = $_.Id; process_name = $_.ProcessName; working_set_bytes = $_.WorkingSet64; private_bytes = $_.PrivateMemorySize64; cpu_seconds = $_.CPU }
  })
  [ordered]@{ at = [DateTime]::UtcNow.ToString('o'); processes = $sampleRows } | ConvertTo-Json -Compress -Depth 4
  Start-Sleep -Milliseconds 500
}
