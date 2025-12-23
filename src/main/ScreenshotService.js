const { desktopCapturer, screen } = require('electron');

class ScreenshotService {
    static async capture() {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size
        });
        return sources[0].thumbnail.toDataURL();
    }

    static async captureArea(rect, blurLevel = 15) {
        try {
            const display = screen.getPrimaryDisplay();
            const scaleFactor = display.scaleFactor;
            const size = display.size;

            // 物理解像度に合わせたサイズでキャプチャ
            // 高DPI設定（150%, 175%等）では整数にならない可能性があるため丸める
            const thumbWidth = Math.round(size.width * scaleFactor);
            const thumbHeight = Math.round(size.height * scaleFactor);

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: thumbWidth, height: thumbHeight }
            });

            const source = sources[0];
            if (!source) return null;

            // 実際のサムネイルサイズ（物理解像度）を取得
            const thumbnailSize = source.thumbnail.getSize();
            const realWidth = thumbnailSize.width;
            const realHeight = thumbnailSize.height;

            const buffer = source.thumbnail.toPNG();

            // クロップ領域の計算（物理ピクセル）
            let left = Math.round(rect.x * scaleFactor);
            let top = Math.round(rect.y * scaleFactor);
            let width = Math.round(rect.width * scaleFactor);
            let height = Math.round(rect.height * scaleFactor);

            // 範囲外補正（実際の画像サイズに合わせる）
            left = Math.max(0, Math.min(left, realWidth - 1));
            top = Math.max(0, Math.min(top, realHeight - 1));
            width = Math.max(1, Math.min(width, realWidth - left));
            height = Math.max(1, Math.min(height, realHeight - top));

            // Sharpで加工
            const sharp = require('sharp');
            const outputBuffer = await sharp(buffer)
                .extract({ left, top, width, height })
                .blur(blurLevel)
                .toFormat('png')
                .toBuffer();

            return `data:image/png;base64,${outputBuffer.toString('base64')}`;
        } catch (error) {
            console.error("Screenshot captureArea error:", error);
            return null;
        }
    }
}

module.exports = ScreenshotService;
