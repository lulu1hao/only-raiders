# Build the frontend and the portable desktop exe, then copy it to .\release
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = 'C:\Users\翟毅\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }

Push-Location $root
try {
    & $node node_modules\vite\bin\vite.js build
    if ($LASTEXITCODE -ne 0) { throw 'vite build failed' }

    Push-Location "$root\src-tauri"
    try {
        $env:CARGO_NET_OFFLINE = 'true'
        cargo build --release --offline --features custom-protocol
        if ($LASTEXITCODE -ne 0) { throw 'cargo build failed' }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Force -Path "$root\release" | Out-Null
    Copy-Item "$root\src-tauri\target\release\arc-map.exe" "$root\release\only raiders.exe" -Force
    $mb = [math]::Round((Get-Item "$root\release\only raiders.exe").Length / 1MB, 1)
    Write-Host "OK -> release\only raiders.exe ($mb MB)"
} finally {
    Pop-Location
}
