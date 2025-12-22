const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourcePath = path.join(__dirname, '../../app/assets/dolphin.png');
const outputDir = path.join(__dirname, '../../build/appx/assets');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// MSIX required icon sizes
const icons = [
    { name: 'Square44x44Logo.png', size: 44 },
    { name: 'Square150x150Logo.png', size: 150 },
    { name: 'StoreLogo.png', size: 50 },
    { name: 'Wide310x150Logo.png', width: 310, height: 150 }
];

async function generateIcons() {
    for (const icon of icons) {
        const outputPath = path.join(outputDir, icon.name);

        if (icon.width && icon.height) {
            // Wide logo - need to resize and pad
            await sharp(sourcePath)
                .resize(icon.height, icon.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .extend({
                    top: 0,
                    bottom: 0,
                    left: Math.floor((icon.width - icon.height) / 2),
                    right: Math.ceil((icon.width - icon.height) / 2),
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .toFile(outputPath);
        } else {
            // Square logo
            await sharp(sourcePath)
                .resize(icon.size, icon.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(outputPath);
        }

        console.log(`Generated: ${icon.name}`);
    }
    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
