const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { WINDOW_WIDTH, WINDOW_HEIGHT, DEFAULT_SYSTEM_PROMPT, DEBUG_FLG } = require('../shared/constants');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.settingsWindow = null;
        this.tray = null;
        this.hasShownOnce = false;
        this.currentFontSize = 'medium'; // デフォルト: 中
        this.selectedTheme = 'classic'; // デフォルト: クラシック
        this.copilotKeyMode = false; // デフォルト: OFF
        this.showCostDisplay = true; // デフォルト: ON
        this.systemInstruction = DEFAULT_SYSTEM_PROMPT;
        this.thinkingLevel = 'LOW';
        this.googleSearch = true;
        this.windowPosition = null; // 位置情報
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json');

        this.loadSettings();

        // システムテーマの変更を検知してトレイメニューとレンダラーを更新
        nativeTheme.on('updated', () => {
            this.updateTrayMenu();
            this.updateThemeInRenderer();
        });
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                if (settings.theme) this.selectedTheme = settings.theme;
                if (settings.fontSize) this.currentFontSize = settings.fontSize;
                if (settings.hasOwnProperty('copilotKeyMode')) this.copilotKeyMode = settings.copilotKeyMode;
                if (settings.hasOwnProperty('showCostDisplay')) this.showCostDisplay = settings.showCostDisplay;
                if (settings.systemInstruction) this.systemInstruction = settings.systemInstruction;
                if (settings.thinkingLevel) this.thinkingLevel = settings.thinkingLevel;
                if (settings.hasOwnProperty('googleSearch')) this.googleSearch = settings.googleSearch;
                if (settings.windowPosition) this.windowPosition = settings.windowPosition;

            }

            // 選ばれたテーマに応じてテーマソースを設定
            if (this.selectedTheme === 'dark' || this.selectedTheme === 'dolphin-blue') {
                nativeTheme.themeSource = 'dark';
            } else if (this.selectedTheme === 'light' || this.selectedTheme === 'classic') {
                nativeTheme.themeSource = 'light';
            } else {
                nativeTheme.themeSource = 'system';
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    saveSettings() {
        try {
            const settings = {
                theme: this.selectedTheme,
                fontSize: this.currentFontSize,
                copilotKeyMode: this.copilotKeyMode,
                showCostDisplay: this.showCostDisplay,
                systemInstruction: this.systemInstruction,
                thinkingLevel: this.thinkingLevel,
                googleSearch: this.googleSearch,
                windowPosition: this.windowPosition
            };
            fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }

    setFontSize(size) {
        this.currentFontSize = size;
        this.saveSettings();
        this.updateTrayMenu();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('font-size-changed', size);
        }
    }

    updateThemeInRenderer() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            let theme = this.selectedTheme;
            if (theme === 'system') {
                theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
            }
            this.mainWindow.webContents.send('theme-changed', {
                theme: theme,
                shouldUseDarkColors: nativeTheme.shouldUseDarkColors
            });
        }
    }

    createWindow() {
        if (this.mainWindow) return;

        const { width, height } = screen.getPrimaryDisplay().workAreaSize;

        // 保存された位置がある場合はそれを使用、なければ右下
        let x = width - (WINDOW_WIDTH + 20);
        let y = height - (WINDOW_HEIGHT + 20);

        if (this.windowPosition) {
            // 画面外に行かないように簡易チェック（必要に応じて強化可能）
            // ここでは保存された値をそのまま採用しますが、本来はDisplayBounds内かチェック推奨
            x = this.windowPosition.x;
            y = this.windowPosition.y;
        }

        this.mainWindow = new BrowserWindow({
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT,
            x: x,
            y: y,
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
            this.updateCostDisplayInRenderer();
            this.mainWindow.webContents.send('font-size-changed', this.currentFontSize);
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        this.registerShortcuts();
    }

    createSettingsWindow() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
            return;
        }

        this.settingsWindow = new BrowserWindow({
            width: 600,
            height: 700,
            title: 'ルカの脳内設定',
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../../preload.js')
            }
        });

        this.settingsWindow.loadFile('app/settings.html');

        this.settingsWindow.once('ready-to-show', () => {
            this.settingsWindow.show();
            this.settingsWindow.webContents.send('open-prompt-setting', {
                prompt: this.systemInstruction,
                thinkingLevel: this.thinkingLevel,
                googleSearch: this.googleSearch
            });
        });

        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
        });
    }

    showSettingsWindow() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
        } else {
            this.createSettingsWindow();
        }
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
            if (DEBUG_FLG) {
                console.log('Copilot key registration failed. Trying fallback (F23 only)...');
            }
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
                label: '🐬脳内設定（システムプロンプト）',
                click: () => {
                    this.showSettingsWindow();
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
            {
                label: '相談料を表示',
                type: 'checkbox',
                checked: this.showCostDisplay,
                click: (menuItem) => {
                    this.showCostDisplay = menuItem.checked;
                    this.saveSettings();
                    this.updateCostDisplayInRenderer();
                }
            },
            { type: 'separator' },
            {
                label: '表示設定',
                submenu: [
                    {
                        label: 'テーマ設定',
                        submenu: [
                            {
                                label: 'クラシック',
                                type: 'radio',
                                checked: this.selectedTheme === 'classic',
                                click: () => {
                                    this.selectedTheme = 'classic';
                                    nativeTheme.themeSource = 'light';
                                    this.saveSettings();
                                    this.updateTrayMenu();
                                    this.updateThemeInRenderer();
                                }
                            },
                            {
                                label: 'モダン',
                                type: 'radio',
                                checked: this.selectedTheme === 'dolphin-blue',
                                click: () => {
                                    this.selectedTheme = 'dolphin-blue';
                                    // イルカブルーはベースを系統としてはダーク寄りにする（文字色白など）
                                    nativeTheme.themeSource = 'dark';
                                    this.saveSettings();
                                    this.updateTrayMenu();
                                    this.updateThemeInRenderer();
                                }
                            },
                            {
                                label: '自動（システム設定）',
                                type: 'radio',
                                checked: this.selectedTheme === 'system',
                                click: () => {
                                    this.selectedTheme = 'system';
                                    nativeTheme.themeSource = 'system';
                                    this.saveSettings();
                                    this.updateTrayMenu();
                                    this.updateThemeInRenderer();
                                }
                            },
                            {
                                label: 'ライト',
                                type: 'radio',
                                checked: this.selectedTheme === 'light',
                                click: () => {
                                    this.selectedTheme = 'light';
                                    nativeTheme.themeSource = 'light';
                                    this.saveSettings();
                                    this.updateTrayMenu();
                                    this.updateThemeInRenderer();
                                }
                            },
                            {
                                label: 'ダーク',
                                type: 'radio',
                                checked: this.selectedTheme === 'dark',
                                click: () => {
                                    this.selectedTheme = 'dark';
                                    nativeTheme.themeSource = 'dark';
                                    this.saveSettings();
                                    this.updateTrayMenu();
                                    this.updateThemeInRenderer();
                                }
                            }
                        ]
                    },
                    {
                        label: 'フォントサイズ',
                        submenu: [
                            {
                                label: '大 (標準)',
                                type: 'radio',
                                checked: this.currentFontSize === 'large',
                                click: () => this.setFontSize('large')
                            },
                            {
                                label: '中',
                                type: 'radio',
                                checked: this.currentFontSize === 'medium',
                                click: () => this.setFontSize('medium')
                            },
                            {
                                label: '小',
                                type: 'radio',
                                checked: this.currentFontSize === 'small',
                                click: () => this.setFontSize('small')
                            }
                        ]
                    }
                ]
            },
            {
                label: 'Copilotキーモード',
                type: 'checkbox',
                checked: this.copilotKeyMode,
                click: (menuItem) => {
                    this.copilotKeyMode = menuItem.checked;
                    this.saveSettings();
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

    updateCostDisplayInRenderer() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('toggle-cost-display', this.showCostDisplay);
        }
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

    saveWindowPosition() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const pos = this.mainWindow.getPosition();
            this.windowPosition = { x: pos[0], y: pos[1] };
        }
    }

    hide() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            if (this.copilotKeyMode) {
                // アプリ終了前に位置を保存
                this.saveWindowPosition();
                this.saveSettings();
                app.quit();
            } else {
                this.mainWindow.hide();
            }
        }
    }
}

module.exports = WindowManager;
