---
description: Copilotキー対応のMSIXパッケージをビルドし、インストールするワークフロー
---

// turbo-all

このワークフローは、electron-builderの通常のビルドプロセスでは解決できない「Copilotキープロバイダー名の長さ制限（39文字）」を回避するための特殊な手順です。

## 前提条件
- Windows 11 SDK (10.0.26100.0) がインストールされていること
- プロジェクトルートに `sidekick-ruka.pfx` (パスワード: password) が存在すること

## ビルド手順

### 1. イルカアイコンの生成とキャッシュ設定
```powershell
node src/tool/generate-icons.js
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\appxAssets"
Copy-Item "build\appx\assets\Square150x150Logo.png" "$cacheDir\SampleAppx.150x150.png" -Force
Copy-Item "build\appx\assets\Square44x44Logo.png" "$cacheDir\SampleAppx.44x44.png" -Force
Copy-Item "build\appx\assets\StoreLogo.png" "$cacheDir\SampleAppx.50x50.png" -Force
Copy-Item "build\appx\assets\Wide310x150Logo.png" "$cacheDir\SampleAppx.310x150.png" -Force
```

### 2. electron-builderでベースビルド（ターミナルで実行）
```powershell
npm run dist
```
※ MakeAppxでエラーが出ますが、`dist/__appx-arm64` フォルダが生成されていればOKです。

### 3. SDK版MakeAppxで手動パッケージ作成
```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe" pack /o /nv /f "dist\__appx-arm64\mapping.txt" /p "dist\sidekick-ruka-copilot.appx"
```

### 4. デジタル署名
```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" sign /f "sidekick-ruka.pfx" /p "password" /fd SHA256 "dist\sidekick-ruka-copilot.appx"
```

### 5. インストール
```powershell
Remove-AppxPackage -Package (Get-AppxPackage -Name "*SidekickRuka*").PackageFullName -ErrorAction SilentlyContinue
Add-AppxPackage -Path "dist\sidekick-ruka-copilot.appx"
```

## なぜこの手順が必要か
- `com.microsoft.windows.copilotkeyprovider` は41文字だが、古いMakeAppxは39文字制限
- Windows SDK 10.0.26100.0の新しいMakeAppxは `/nv` オプションでこの制限を回避可能
- electron-builderが使用するMakeAppxは古いため、手動でSDK版を使用する必要がある
