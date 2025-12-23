---
description: Copilotキー対応のMSIXパッケージをビルドし、インストールするワークフロー（一括実行版）
---

// turbo-all

Copilotキー対応のパッケージ作成からインストールまでを、確認なしの一括コマンドで実行します。

```powershell
Write-Host "1. クリーンアップ中..."
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

Write-Host "2. アイコン生成とキャッシュ設定..."
node src/tool/generate-icons.js
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\appxAssets"
Copy-Item "build\appx\assets\Square150x150Logo.png" "$cacheDir\SampleAppx.150x150.png" -Force
Copy-Item "build\appx\assets\Square44x44Logo.png" "$cacheDir\SampleAppx.44x44.png" -Force
Copy-Item "build\appx\assets\StoreLogo.png" "$cacheDir\SampleAppx.50x50.png" -Force
Copy-Item "build\appx\assets\Wide310x150Logo.png" "$cacheDir\SampleAppx.310x150.png" -Force

Write-Host "3. Electron Builderによるビルド (一時的なエラーは無視されます)..."
# エラーが出ても続行するように ; を使用して次のコマンドへ
cmd /c "npm run dist" 
if ($LASTEXITCODE -ne 0) { Write-Host "Build finished with expected error (MakeAppx legacy limit). Continuing..." }

Write-Host "4. SDK版MakeAppxでパッケージ作成..."
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe" pack /o /nv /f "dist\__appx-arm64\mapping.txt" /p "dist\sidekick-ruka-copilot.appx"

Write-Host "5. デジタル署名..."
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" sign /f "sidekick-ruka.pfx" /p "password" /fd SHA256 "dist\sidekick-ruka-copilot.appx"

Write-Host "6. 再インストール..."
Remove-AppxPackage -Package (Get-AppxPackage -Name "*SidekickRuka*").PackageFullName -ErrorAction SilentlyContinue
Add-AppxPackage -Path "dist\sidekick-ruka-copilot.appx"

Write-Host "完了しました！"
```
