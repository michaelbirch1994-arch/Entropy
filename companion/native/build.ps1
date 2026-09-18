param(
    [string]$ZigPath = "$PSScriptRoot\..\..\.tmp\native-tools\zig-x86_64-windows-0.15.2\zig.exe"
)
$ErrorActionPreference = 'Stop'
$compiler = (Resolve-Path -LiteralPath $ZigPath).Path
$outputDir = Join-Path $PSScriptRoot '..\..\.tmp\companion-native'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$outputDir = (Resolve-Path -LiteralPath $outputDir).Path
$testExe = Join-Path $outputDir 'collector-test.exe'
$dll = Join-Path $outputDir 'arcdps_entropy_prototype.dll'
& $compiler cc -std=c11 -Wall -Wextra -Werror -O2 (Join-Path $PSScriptRoot 'collector_test.c') -o $testExe
if ($LASTEXITCODE -ne 0) { throw 'Native test compilation failed.' }
& $compiler cc -std=c11 -Wall -Wextra -Werror -O2 -shared (Join-Path $PSScriptRoot 'collector.c') -o $dll
if ($LASTEXITCODE -ne 0) { throw 'DLL compilation failed.' }
$previousCaptureDir = $env:ENTROPY_CAPTURE_DIR
$testDir = Join-Path $outputDir ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $testDir | Out-Null
try {
    $env:ENTROPY_CAPTURE_DIR = $testDir
    & $testExe $dll
    if ($LASTEXITCODE -ne 0) { throw 'Native tests failed.' }
    $files = @(Get-ChildItem -LiteralPath $testDir -Filter '*.jsonl')
    if ($files.Count -ne 7) { throw 'Expected one normal and six rotated segments.' }
    $normal = @($files | Where-Object { $end = Get-Content -LiteralPath $_.FullName -Tail 1 | ConvertFrom-Json; $end.written -eq 2 -and $end.sessionAttempted -eq 2 })
    if ($normal.Count -ne 1) { throw 'Normal recording missing.' }
    $rows = @(Get-Content -LiteralPath $normal[0].FullName | ForEach-Object { $_ | ConvertFrom-Json })
    if ($rows.Count -ne 4 -or $rows[0].format -ne 'entropy-arc-callbacks') { throw 'Capture header or record count mismatch.' }
    if ($rows[1].rawHex.Length -ne 128 -or $rows[2].rawHex.Length -ne 128) { throw 'Raw event bytes were not preserved.' }
    if ($rows[1].stream -ne 'area' -or $rows[2].stream -ne 'local') { throw 'Streams were not distinguished.' }
    if ($rows[3].type -ne 'end' -or $rows[3].written -ne 2 -or $rows[3].sessionAttempted -ne 2 -or $rows[3].queueDropped -ne 0 -or $rows[3].writeFailed) { throw 'Capture completeness check failed.' }
    if ($rows[0].collectorVersion -ne '0.1.2' -or $rows[3].capacityDropped -ne 0 -or $rows[3].shutdownDropped -ne 0) { throw 'Version or loss counters mismatch.' }
    $rotated = @($files | Where-Object { $_.FullName -ne $normal[0].FullName } | Sort-Object Name | Select-Object -First 3)
    $session = $null; $sequence = @(); $written = 0
    for ($i = 0; $i -lt 3; $i++) {
        $part = @(Get-Content -LiteralPath $rotated[$i].FullName | ForEach-Object { $_ | ConvertFrom-Json })
        if ($i -eq 0) { $session = $part[0].sessionId }
        if ($part[0].sessionId -ne $session -or $part[0].segment -ne ($i + 1)) { throw 'Segment continuity failed.' }
        $events = @($part | Where-Object type -eq 'callback')
        $written += $events.Count; $sequence += @($events.sequence)
        if ($part[-1].written -ne $events.Count -or $part[-1].continued -ne ($i -lt 2)) { throw 'Segment footer mismatch.' }
    }
    if ($written -ne 2 -or @($sequence | Select-Object -Unique).Count -ne 2 -or $part[-1].writerDiscarded -ne 3 -or !$part[-1].sizeLimited -or $part[-1].sessionWritten -ne 2) { throw 'Rotation budget accounting failed.' }
    $complete = @($files | Where-Object { $_.FullName -ne $normal[0].FullName } | Sort-Object Name | Select-Object -Last 3)
    $sequence = @(); $session = $null
    for ($i = 0; $i -lt 3; $i++) {
        $part = @(Get-Content -LiteralPath $complete[$i].FullName | ForEach-Object { $_ | ConvertFrom-Json })
        if ($i -eq 0) { $session = $part[0].sessionId }
        if ($part[0].sessionId -ne $session -or $part[0].segment -ne ($i + 1) -or $part[-1].continued -ne ($i -lt 2)) { throw 'Successful rotation continuity failed.' }
        $sequence += @($part | Where-Object type -eq 'callback' | ForEach-Object sequence)
    }
    if ($sequence.Count -ne 2 -or @($sequence | Select-Object -Unique).Count -ne 2 -or $part[-1].sessionWritten -ne 2 -or $part[-1].writerDiscarded -ne 0 -or $part[-1].sizeLimited -or $part[-1].writeFailed) { throw 'Successful rotation lost data.' }
    Write-Output "DLL built: $dll"
    Write-Output 'Synthetic capture JSON, stream identity, raw bytes and completeness verified.'
} finally {
    $env:ENTROPY_CAPTURE_DIR = $previousCaptureDir
}
