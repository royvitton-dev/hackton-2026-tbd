[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$clock=[Diagnostics.Stopwatch]::StartNew()
while($clock.Elapsed.TotalSeconds -lt 88){
 $rows=@(Get-Process -Id 22032,10036 -ErrorAction SilentlyContinue | ForEach-Object {
  $loadProc=$_
  try { [ordered]@{pid=$loadProc.Id;name=$loadProc.ProcessName;cpu_seconds=$loadProc.TotalProcessorTime.TotalSeconds;working_set_bytes=$loadProc.WorkingSet64;private_bytes=$loadProc.PrivateMemorySize64} }
  catch { [ordered]@{pid=$loadProc.Id;error=$_.Exception.Message} }
 })
 [ordered]@{at=[DateTime]::UtcNow.ToString('o');elapsed_ms=$clock.Elapsed.TotalMilliseconds;processes=$rows}|ConvertTo-Json -Depth 4 -Compress
 Start-Sleep -Milliseconds 500
}
