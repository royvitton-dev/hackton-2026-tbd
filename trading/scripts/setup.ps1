$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$TradingRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $TradingRoot
New-Item -ItemType Directory -Force -Path '.tools','.tmp','evidence' | Out-Null
. (Join-Path $PSScriptRoot 'env.ps1')
$rustCompiler = Join-Path $env:RUSTUP_HOME 'toolchains\stable-x86_64-pc-windows-gnu\bin\rustc.exe'
if (-not (Test-Path -LiteralPath $rustCompiler)) {
    Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-gnu/rustup-init.exe' -OutFile '.tools\rustup-init.exe' -TimeoutSec 600
    & '.\.tools\rustup-init.exe' -y --no-modify-path --default-host x86_64-pc-windows-gnu --profile minimal --default-toolchain stable
    if ($LASTEXITCODE -ne 0) { throw 'Rust installation failed. Inspect network availability and retry; caches are retained.' }
}
$llvmBin = Join-Path $TradingRoot '.tools\llvm-mingw-20260908-ucrt-x86_64\bin'
if (-not (Test-Path (Join-Path $llvmBin 'llvm-dlltool.exe'))) {
    Invoke-WebRequest -Uri 'https://github.com/mstorsjo/llvm-mingw/releases/download/20260908/llvm-mingw-20260908-ucrt-x86_64.zip' -OutFile '.tools\llvm-mingw.zip' -TimeoutSec 600
    Expand-Archive -LiteralPath '.tools\llvm-mingw.zip' -DestinationPath '.tools' -Force
}
. (Join-Path $PSScriptRoot 'env.ps1')
rustc --version
cargo build --manifest-path engine/Cargo.toml --release --locked --bin leave-engine
if ($LASTEXITCODE -ne 0) { throw 'Rust release build failed' }
Push-Location frontend
try {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency install failed' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
Write-Output 'Ready. Start the standalone exchange: node scripts/demo.mjs start'
