const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const { WINDOW_WIDTH, WINDOW_HEIGHT } = require('../shared/constants');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.hasShownOnce = false;

        // システムテーマの変更を検知してトレイメニューとレンダラーを更新
        nativeTheme.on('updated', () => {
            this.updateTrayMenu();
            this.updateThemeInRenderer();
        });
    }

    updateThemeInRenderer() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('theme-changed', {
                shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
                themeSource: nativeTheme.themeSource
            });
        }
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
            // 初回作成時はアニメーションで表示
            this.showWindow();
            this.updateThemeInRenderer();
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        this.registerShortcuts();
    }

    registerShortcuts() {
        // Copilotキー (Windows + Shift + F23)
        // 注意: 環境によってはキーコードが異なる場合があります
        const copilotKey = 'Super+Shift+F23';

        // 既存のショートカットがあれば解除
        globalShortcut.unregister(copilotKey);

        const ret = globalShortcut.register(copilotKey, () => {
            this.handleCopilotKey();
        });

        if (!ret) {
            console.log('Copilot key registration failed. Trying fallback (F23 only)...');
            // フォールバック: F23のみ (一部のマクロ設定用)
            globalShortcut.register('F23', () => {
                this.handleCopilotKey();
            });
        }
    }

    handleCopilotKey() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            if (this.mainWindow.isVisible()) {
                // 表示中は隠す（ESCキーと同じ挙動＝アニメーションあり）
                this.hideWindow();
            } else {
                // 非表示なら表示する（アニメーションあり）
                this.showWindow();
            }
        } else {
            // ウィンドウがない場合は作成して表示
            this.showWindow();
        }
    }

    showWindow() {
        if (!this.mainWindow) {
            this.createWindow();
            // createWindow内でready-to-show後にshowWindow()が呼ばれる
        } else {
            // 常に最前面へ
            this.mainWindow.setAlwaysOnTop(true, 'screen-saver');

            // 隠れている場合は表示
            if (!this.mainWindow.isVisible()) {
                this.mainWindow.show();
            }

            // フォーカスも当てる
            this.mainWindow.focus();

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
            this.showWindow(); // 位置リセット時はアニメーションありで表示
            this.mainWindow.webContents.send('position-reset', { x, y });
        }
    }

    updateTrayMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: '🐬頭脳（Gemini-3-Flash）'
            },
            { type: 'separator' },
            {
                label: 'テーマ（システムと同期）',
                type: 'checkbox',
                checked: nativeTheme.themeSource === 'system',
                click: (menuItem) => {
                    nativeTheme.themeSource = menuItem.checked ? 'system' : (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
                    this.updateTrayMenu();
                }
            },
            {
                label: 'ダークモード(手動)',
                type: 'checkbox',
                checked: nativeTheme.shouldUseDarkColors,
                click: (menuItem) => {
                    nativeTheme.themeSource = menuItem.checked ? 'dark' : 'light';
                    this.updateTrayMenu();
                }
            },
            { type: 'separator' },
            {
                label: '相談料を表示',
                type: 'checkbox',
                checked: true, // TODO: 本来は状態を保持すべきだが、今回は簡易化
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

        this.tray.setContextMenu(contextMenu);
    }

    createTray() {
        const iconPath = path.join(__dirname, '../../app/assets/dolphin.png');
        const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

        this.tray = new Tray(trayIcon);
        this.tray.setToolTip('AIアシスタント（ルカ）');
        this.updateTrayMenu();

        this.tray.on('click', () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                if (this.mainWindow.isVisible()) {
                    this.hideWindow(); // トレイクリックはアニメーションありで閉じる（慣例）
                } else {
                    this.showWindow(); // トレイクリックはアニメーションあり
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
