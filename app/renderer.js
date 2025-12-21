// APIキー管理
const getApiKey = () => localStorage.getItem('gemini_api_key') || "";

// クラスのインスタンス化 (index.htmlで先に読み込まれている前提)
const costManager = new CostManager();
const dolphinUI = new DolphinUI(
    document.getElementById('character'),
    document.getElementById('balloon'),
    window.electronAPI
);

const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const responseArea = document.getElementById('response');
const costArea = document.getElementById('cost-area');
const container = document.getElementById('container');
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySave = document.getElementById('api-key-save');
const apiKeyCancel = document.getElementById('api-key-cancel');

// 初期表示
const costText = document.getElementById('cost-text');
costText.innerHTML = costManager.getFormattedDisplay();
costManager.updateExchangeRate(window.electronAPI).then(() => {
    costText.innerHTML = costManager.getFormattedDisplay();
});

// IPCイベントハンドリング
window.electronAPI.onToggleCostDisplay((visible) => {
    costArea.style.display = visible ? 'block' : 'none';
});

window.electronAPI.onOpenApiKeySetting(() => {
    apiKeyInput.value = getApiKey();
    apiKeyModal.classList.add('active');
    window.electronAPI.setIgnoreMouse(false);
});

window.electronAPI.onFadeIn(() => {
    container.classList.add('ready');
});

window.electronAPI.onFadeOut(() => {
    fadeOutHelper();
});

window.electronAPI.onPositionReset((pos) => {
    localStorage.setItem('window_pos', JSON.stringify(pos));
});

// モーダル操作
apiKeySave.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        apiKeyModal.classList.remove('active');
        responseArea.innerHTML = "魂の錬成が完了しました！いつでも呼んでくださいね。🐬";
    }
});

apiKeyCancel.addEventListener('click', () => {
    apiKeyModal.classList.remove('active');
});

[apiKeyModal, apiKeyInput, apiKeySave, apiKeyCancel].forEach(el => {
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('mouseup', (e) => e.stopPropagation());
});

// 終了処理
async function fadeOutHelper() {
    const pos = await window.electronAPI.getWindowPosition();
    if (pos) {
        localStorage.setItem('window_pos', JSON.stringify(pos));
    }

    container.classList.remove('ready');
    await new Promise(resolve => setTimeout(resolve, 500));
    dolphinUI.closeBalloon();
    window.electronAPI.closeApp();
}

const screenCheck = document.getElementById('screen-mode-check');

// 送信共通処理
async function sendRequest() {
    userInput.focus();
    const question = userInput.value.trim();
    const withScreen = screenCheck.checked;

    if (!question && !withScreen) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        responseArea.innerHTML = "魂（APIキー）がまだ錬成されていないようです...🐬💦<br>トレイメニューから「魂を錬成」してください！";
        return;
    }

    responseArea.innerHTML = "思考中...🐬💭";
    userInput.value = "";
    userInput.style.height = 'auto';

    try {
        let base64Data = null;
        if (withScreen) {
            responseArea.innerHTML = "画面を確認中...🐬💭";
            const screenshot = await window.electronAPI.captureScreen();
            base64Data = screenshot.split(',')[1];
            responseArea.innerHTML = "画像から思考中...🐬🖼️💭";
        }

        const result = await window.electronAPI.generateAIResponse(apiKey, question || "この画面について教えてください", base64Data);

        if (result.error) throw new Error(result.error);

        if (result.usage) {
            await costManager.updateExchangeRate(window.electronAPI);
            const sessionCost = costManager.calculateSessionCost(result.usage);
            costManager.addCost(sessionCost);
            costText.innerHTML = costManager.getFormattedDisplay(sessionCost);
        }

        const displayQuestion = withScreen ? `画面分析: ${question || "説明して"}` : question;
        const questionHtml = `<div class="user-question"><strong>Q:</strong> ${displayQuestion.replace(/\n/g, '<br>')}</div>`;
        const answerHtml = `<div>${result.text.replace(/\n/g, '<br>')}</div>`;
        responseArea.innerHTML = questionHtml + answerHtml;

        // モードリセット
        screenCheck.checked = false;

        responseArea.scrollTop = responseArea.scrollHeight;

    } catch (error) {
        console.error("Renderer Error:", error);
        responseArea.innerHTML = `エラー発生...🐬💦<br><span style="color:red; font-size:11px;">${error.message}</span>`;
    }
}

// 送信ボタン
sendBtn.addEventListener('mousedown', (e) => e.stopPropagation());
sendBtn.addEventListener('mouseup', (e) => e.stopPropagation());
sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sendRequest();
});

// 入力エリア自動調整
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    const newHeight = userInput.scrollHeight;
    userInput.style.height = newHeight + 'px';
    userInput.style.overflowY = newHeight >= 150 ? 'auto' : 'hidden';
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendRequest();
    }
});

userInput.addEventListener('mousedown', (e) => e.stopPropagation());
userInput.addEventListener('mouseup', (e) => e.stopPropagation());

// ショートカット
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fadeOutHelper();
});

// 初期位置復元
setTimeout(async () => {
    const storedPos = localStorage.getItem('window_pos');
    if (storedPos) {
        try {
            const { x, y } = JSON.parse(storedPos);
            window.electronAPI.moveWindow(x, y);
        } catch (e) { }
    }
    container.classList.add('ready');
}, 100);

window.electronAPI.setIgnoreMouse(true);
