const { app, ipcMain } = require('electron');
const WindowManager = require('./src/main/WindowManager');
const ScreenshotService = require('./src/main/ScreenshotService');
const AIService = require('./src/main/AIService');

const windowManager = new WindowManager();

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 2つ目のインスタンスが起動されたとき、既存のウィンドウを表示・フォーカスする
        windowManager.showWindow();
        const win = windowManager.mainWindow;
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        windowManager.createWindow();
        windowManager.createTray();
    });

    app.on('window-all-closed', () => {
        // 常駐アプリなので何もしない
    });

    // IPCハンドラ
    ipcMain.on('close-app', () => {
        windowManager.hide();
    });

    ipcMain.handle('capture-screen', async () => {
        return await ScreenshotService.capture();
    });

    ipcMain.handle('capture-background', async (event, rect) => {
        return await ScreenshotService.captureArea(rect);
    });

    ipcMain.handle('generate-ai-response', async (event, { apiKey, question, base64Image, history }) => {
        try {
            return await AIService.generateResponse(apiKey, question, base64Image, history);
        } catch (err) {
            return { error: err.message || err.toString() };
        }
    });

    ipcMain.on('set-ignore-mouse', (event, ignore) => {
        windowManager.setIgnoreMouseEvents(ignore, { forward: true });
    });

    ipcMain.on('move-window', (event, { x, y }) => {
        windowManager.setPosition(Math.round(x), Math.round(y));
    });

    ipcMain.handle('get-window-position', () => {
        const pos = windowManager.getPosition();
        if (pos) {
            return { x: pos[0], y: pos[1] };
        }
        return null;
    });

    ipcMain.handle('get-exchange-rate', async () => {
        try {
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await response.json();
            return {
                rate: data.rates.JPY,
                time: new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/-/g, '/')
            };
        } catch (err) {
            console.error("Exchange Rate Error:", err);
            return { rate: 154, time: "レート取得失敗" };
        }
    });

    ipcMain.on('open-external', (event, url) => {
        const { shell } = require('electron');
        shell.openExternal(url);
    });
}
