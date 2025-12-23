$localAppData = $env:LOCALAPPDATA
$baseDir = Join-Path $localAppData "electron-builder\Cache\winCodeSign"

if (-not (Test-Path $baseDir)) {
    Write-Host "Error: electron-builder cache directory not found at $baseDir" -ForegroundColor Red
    return
}

# Find build tools folders (e.g. winCodeSign-2.6.0)
$dirs = Get-ChildItem -Path $baseDir -Directory | Where-Object { $_.Name -like "winCodeSign-*" }

if ($dirs.Count -eq 0) {
    Write-Host "Error: No winCodeSign versions found in cache." -ForegroundColor Red
    return
}

foreach ($dir in $dirs) {
    $x64Path = Join-Path $dir.FullName "windows-10\x64\signtool.exe"
    $arm64Dir = Join-Path $dir.FullName "windows-10\arm64"
    $arm64Path = Join-Path $arm64Dir "signtool.exe"

    if (Test-Path $x64Path) {
        if (-not (Test-Path $arm64Dir)) {
            New-Item -ItemType Directory -Path $arm64Dir | Out-Null
            Write-Host "Created arm64 directory: $arm64Dir"
        }

        if (-not (Test-Path $arm64Path)) {
            Copy-Item -Path $x64Path -Destination $arm64Path
            Write-Host "Fixed: Copied signtool.exe to $arm64Path" -ForegroundColor Green
        }
        else {
            Write-Host "signtool.exe already exists at $arm64Path" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "Warning: x64 signtool not found in $($dir.Name)" -ForegroundColor Yellow
    }
}

Write-Host "Fix attempt complete. Please try running 'npm run dist' again." -ForegroundColor Cyan
