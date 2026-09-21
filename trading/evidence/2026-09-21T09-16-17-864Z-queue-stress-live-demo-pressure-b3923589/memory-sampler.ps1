[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$sampleDeadline=[DateTime]::UtcNow.AddSeconds(55)
while([DateTime]::UtcNow -lt $sampleDeadline){
  $items=@(Get-Process -Id 20160,20828 -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{pid=$_.Id;name=$_.ProcessName;working_set_bytes=$_.WorkingSet64;private_bytes=$_.PrivateMemorySize64;cpu_seconds=$_.CPU} })
  [ordered]@{at=[DateTime]::UtcNow.ToString('o');processes=$items}|ConvertTo-Json -Depth 4 -Compress
  Start-Sleep -Milliseconds 500
}
