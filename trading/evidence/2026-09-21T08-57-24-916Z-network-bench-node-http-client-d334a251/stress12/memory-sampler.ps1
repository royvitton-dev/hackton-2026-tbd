[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while (-not (Test-Path -LiteralPath 'C:\project\hackton-2026-tbd\trading\evidence\2026-09-21T08-57-24-916Z-network-bench-node-http-client-d334a251\stress12\memory.stop')) {
  $sampleRows = @(Get-Process -Id 6428,17568 -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ pid = $_.Id; process_name = $_.ProcessName; working_set_bytes = $_.WorkingSet64; private_bytes = $_.PrivateMemorySize64; cpu_seconds = $_.CPU }
  })
  [ordered]@{ at = [DateTime]::UtcNow.ToString('o'); processes = $sampleRows } | ConvertTo-Json -Compress -Depth 4
  Start-Sleep -Milliseconds 500
}
