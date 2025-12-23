$certName = "SidekickRuka"
$password = "password" | ConvertTo-SecureString -AsPlainText -Force
$destPath = ".\sidekick-ruka.pfx"

# Create Self-Signed Certificate
$cert = New-SelfSignedCertificate -Type Custom `
    -Subject "CN=$certName" `
    -KeyUsage DigitalSignature `
    -FriendlyName "SidekickRuka Dev Cert" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

# Export to PFX
Export-PfxCertificate -Cert $cert -FilePath $destPath -Password $password

Write-Host "Certificate created at $destPath"
Write-Host "Usage: npm run dist"
