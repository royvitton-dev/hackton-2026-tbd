[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$deadline=[DateTime]::UtcNow.AddSeconds(55)
while([DateTime]::UtcNow -lt $deadline){
$items=@(Get-Process -Id 18112,20716 -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{pid=$_.Id;working_set_bytes=$_.WorkingSet64;private_bytes=$_.PrivateMemorySize64} })
[ordered]@{at=[DateTime]::UtcNow.ToString('o');processes=$items}|ConvertTo-Json -Depth 4 -Compress
Start-Sleep -Milliseconds 500
}
