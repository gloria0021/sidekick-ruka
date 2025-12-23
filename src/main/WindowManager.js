const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const { WINDOW_WIDTH, WINDOW_HEIGHT } = require('../shared/constants');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
    }

    createWindow() {
        if (this.mainWindow) return;

        const { width, height } = screen.getPrimaryDisplay().workAreaSize;

        this.mainWindow = new BrowserWindow({
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT,
            x: width - (WINDOW_WIDTH + 20),
            y: height - (WINDOW_HEIGHT + 20),
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../../preload.js')
            }
        });

        this.mainWindow.loadFile('app/index.html');
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');

        this.mainWindow.once('ready-to-show', () => {
            this.showWindow();
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    showWindow() {
        if (!this.mainWindow) {
            this.createWindow();
            // 新規作成時はready-to-show後にfade-inが送られる
        } else {
            this.mainWindow.show();
            this.mainWindow.webContents.send('fade-in');
        }
    }

    hideWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('fade-out');
        }
    }

    resetWindowPosition() {
        if (!this.mainWindow) {
            this.createWindow();
        } else {
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            const x = Math.round((width - WINDOW_WIDTH) / 2);
            const y = Math.round((height - WINDOW_HEIGHT) / 2);
            this.mainWindow.setPosition(x, y);
            this.showWindow(); // 位置リセットと同時に表示
            this.mainWindow.webContents.send('position-reset', { x, y });
        }
    }

    createTray() {
        const iconPath = path.join(__dirname, '../../app/assets/dolphin.png');
        const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

        this.tray = new Tray(trayIcon);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '🐬頭脳（Gemini-3-Flash）'
            },
            { type: 'separator' },
            {
                label: '相談料を表示',
                type: 'checkbox',
                checked: true,
                click: (menuItem) => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('toggle-cost-display', menuItem.checked);
                    }
                }
            },
            {
                label: '魂を錬成 (Gemini APIキー設定)',
                click: () => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.show();
                        this.mainWindow.webContents.send('open-api-key-setting');
                    }
                }
            },
            { type: 'separator' },
            { label: '位置をリセット', click: () => this.resetWindowPosition() },

            { label: 'さようなら (終了)', click: () => app.quit() }
        ]);

        this.tray.setToolTip('AIイルカ');
        this.tray.setContextMenu(contextMenu);

        this.tray.on('click', () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                if (this.mainWindow.isVisible()) {
                    this.hideWindow();
                } else {
                    this.showWindow();
                }
            } else {
                this.showWindow();
            }
        });
    }

    send(channel, ...args) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, ...args);
        }
    }

    setIgnoreMouseEvents(ignore, options) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.setIgnoreMouseEvents(ignore, options);
        }
    }

    setPosition(x, y) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.setPosition(x, y);
        }
    }

    getPosition() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            return this.mainWindow.getPosition();
        }
        return null;
    }

    hide() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.hide();
        }
    }
}

module.exports = WindowManager;
