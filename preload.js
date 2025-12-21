const { contextBridge, ipcRenderer } = require('electron');
// @google/genai はESMのみの可能性があるため、ここでのrequireが失敗するなら
// レンダラーでのダイナミックインポート戦略を変えずに、パス解決をヒントとして与える必要がありますが、
// まずはシンプルにメインプロセス側で処理を完結させるのが安全です。

contextBridge.exposeInMainWorld('electronAPI', {
    captureScreen: () => ipcRenderer.invoke('capture-screen'),
    closeApp: () => ipcRenderer.send('close-app'),
    generateAIResponse: (apiKey, question, base64Image, history) => ipcRenderer.invoke('generate-ai-response', { apiKey, question, base64Image, history }),
    moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
    setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    getExchangeRate: () => ipcRenderer.invoke('get-exchange-rate'),
    getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
    onToggleCostDisplay: (callback) => ipcRenderer.on('toggle-cost-display', (event, visible) => callback(visible)),
    onFadeIn: (callback) => ipcRenderer.on('fade-in', () => callback()),
    onFadeOut: (callback) => ipcRenderer.on('fade-out', () => callback()),
    onPositionReset: (callback) => ipcRenderer.on('position-reset', (event, pos) => callback(pos)),
    onOpenApiKeySetting: (callback) => ipcRenderer.on('open-api-key-setting', () => callback())
});
