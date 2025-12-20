const { desktopCapturer, screen } = require('electron');

class ScreenshotService {
    static async capture() {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size
        });
        return sources[0].thumbnail.toDataURL();
    }
}

module.exports = ScreenshotService;
