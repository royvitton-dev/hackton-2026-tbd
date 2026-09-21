$TradingRoot = Split-Path -Parent $PSScriptRoot
$env:RUSTUP_HOME = Join-Path $TradingRoot '.tools\rustup'
$env:CARGO_HOME = Join-Path $TradingRoot '.tools\cargo'
$env:TEMP = Join-Path $TradingRoot '.tmp'
$env:TMP = $env:TEMP
$compilerBin = Join-Path $TradingRoot '.tools\llvm-mingw-20260908-ucrt-x86_64\bin'
$cargoBin = Join-Path $env:CARGO_HOME 'bin'
$env:PATH = "$cargoBin;$compilerBin;$env:PATH"
if (Test-Path -LiteralPath (Join-Path $compilerBin 'clang.exe')) {
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = Join-Path $compilerBin 'clang.exe'
    $env:CC = Join-Path $compilerBin 'clang.exe'
    $env:AR = Join-Path $compilerBin 'llvm-ar.exe'
}
$rustBundledBin = Join-Path $env:RUSTUP_HOME 'toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained'
if (Test-Path -LiteralPath (Join-Path $rustBundledBin 'x86_64-w64-mingw32-gcc.exe')) {
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = Join-Path $rustBundledBin 'x86_64-w64-mingw32-gcc.exe'
    $env:PATH = "$rustBundledBin;$env:PATH"
    $dllTool = Join-Path $compilerBin 'llvm-dlltool.exe'
    $env:RUSTFLAGS = "-C link-self-contained=yes -C dlltool=$dllTool"
}
$env:CARGO_TARGET_DIR = Join-Path $TradingRoot 'engine\target'
