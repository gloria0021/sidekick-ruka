Write-Host '1. Cleaning up...'
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

Write-Host '2. Icon setup...'
node src/tool/generate-icons.js
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\appxAssets"

Copy-Item 'build\appx\assets\Square150x150Logo.png' "$cacheDir\SampleAppx.150x150.png" -Force
Copy-Item 'build\appx\assets\Square44x44Logo.png' "$cacheDir\SampleAppx.44x44.png" -Force
Copy-Item 'build\appx\assets\StoreLogo.png' "$cacheDir\SampleAppx.50x50.png" -Force
Copy-Item 'build\appx\assets\Wide310x150Logo.png' "$cacheDir\SampleAppx.310x150.png" -Force

Write-Host '3. Electron Builder Build...'
cmd /c "npm run dist"
if ($LASTEXITCODE -ne 0) { Write-Host 'Build finished with expected error. Continuing...' }

Write-Host '4. MakeAppx Packaging...'
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe" pack /o /nv /f "dist\__appx-arm64\mapping.txt" /p "dist\sidekick-ruka-copilot.appx"

Write-Host '5. Signing...'
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" sign /f "sidekick-ruka.pfx" /p "password" /fd SHA256 "dist\sidekick-ruka-copilot.appx"

Write-Host '6. Reinstalling...'
$pkg = Get-AppxPackage -Name "*SidekickRuka*"
if ($pkg) { 
    Write-Host "Removing old package..."
    Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction SilentlyContinue 
}
Add-AppxPackage -Path "dist\sidekick-ruka-copilot.appx"

Write-Host 'Done!'
