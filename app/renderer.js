// APIキー管理
const getApiKey = () => localStorage.getItem('gemini_api_key') || "";

// クラスのインスタンス化 (index.htmlで先に読み込まれている前提)
const costManager = new CostManager();
let conversationHistory = [];

const dolphinUI = new DolphinUI(
    document.getElementById('character'),
    document.getElementById('balloon'),
    window.electronAPI,
    () => { conversationHistory = []; }, // 閉じられた時に履歴をリセット
    () => { fadeOutHelper(); } // イルカをクリックした時に非表示にする
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
const apiKeyLink = document.getElementById('api-key-link');

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

window.electronAPI.onThemeChanged((data) => {
    const theme = data.shouldUseDarkColors ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    // すりガラスエフェクトのリアルタイム更新
    if (dolphinUI && dolphinUI.isBalloonOpen && dolphinUI.currentBgDataUrl) {
        dolphinUI.updateBalloonBackground(dolphinUI.currentBgDataUrl);
    }
});

window.electronAPI.onFontSizeChanged((size) => {
    document.documentElement.setAttribute('data-font-size', size);
});

window.electronAPI.onFadeIn(() => {
    // 表示開始時にまず状態をリセット（吹き出しが出たままになる現象を防止）
    dolphinUI.closeBalloon();

    // 少し待ってからフェードイン開始
    requestAnimationFrame(() => {
        container.classList.add('ready');

        // フェードインに合わせて吹き出しを開く
        setTimeout(() => {
            if (dolphinUI && typeof dolphinUI.toggleBalloon === 'function') {
                dolphinUI.toggleBalloon(true);
            }
        }, 100);
    });
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

apiKeyLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://aistudio.google.com/api-keys');
});

[apiKeyModal, apiKeyInput, apiKeySave, apiKeyCancel, apiKeyLink].forEach(el => {
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('mouseup', (e) => e.stopPropagation());
});

// 終了処理
async function fadeOutHelper() {
    const pos = await window.electronAPI.getWindowPosition();
    if (pos) {
        localStorage.setItem('window_pos', JSON.stringify(pos));
    }
    dolphinUI.closeBalloon();
    container.classList.remove('ready');
    await new Promise(resolve => setTimeout(resolve, 500));
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

    let animationInterval = null;
    const startAnimation = (baseText) => {
        let count = 0;
        responseArea.innerHTML = `${baseText}${"💭".repeat(count)}`;
        animationInterval = setInterval(() => {
            count = (count + 1) % 4;
            responseArea.innerHTML = `${baseText}${"💭".repeat(count)}`;
        }, 1000);
    };

    try {
        let base64Data = null;
        if (withScreen) {
            startAnimation("画像から思考中.....🐬");
            const screenshot = await window.electronAPI.captureScreen();
            base64Data = screenshot.split(',')[1];
        } else {
            startAnimation("思考中...🐬");
        }

        const result = await window.electronAPI.generateAIResponse(
            apiKey,
            question || "この画面について教えてください",
            base64Data,
            conversationHistory
        );

        if (animationInterval) clearInterval(animationInterval);

        if (result.error) throw new Error(result.error);

        // 履歴の更新 (画像を履歴に残すと肥大化するため、テキストのみを保持)
        conversationHistory.push({
            role: 'user',
            parts: [{ text: (withScreen ? "[画面分析依頼] " : "") + (question || "説明して") }]
        });
        conversationHistory.push({
            role: 'model',
            parts: [{ text: result.text }]
        });

        if (result.usage) {
            await costManager.updateExchangeRate(window.electronAPI);
            const sessionCost = costManager.calculateSessionCost(result.usage);
            costManager.addCost(sessionCost);
            costText.innerHTML = costManager.getFormattedDisplay(sessionCost);
        }

        const displayQuestion = withScreen ? `画面分析: ${question || "説明して"}` : question;
        const questionHtml = `<div class="user-question"><strong>Q:</strong> ${displayQuestion.replace(/\n/g, '<br>')}</div>`;
        responseArea.innerHTML = questionHtml;

        // タイプライターエフェクトの適用
        const answerHtml = result.text.replace(/\n/g, '<br>');
        await applyTypewriterEffect(responseArea, answerHtml);

        // モードリセット
        screenCheck.checked = false;

    } catch (error) {
        if (animationInterval) clearInterval(animationInterval);
        console.error("Renderer Error:", error);
        responseArea.innerHTML = `エラー発生...🐬💦<br><span style="color:red; font-size:11px;">${error.message}</span>`;
    }
}

// タイプライター風アニメーション
async function applyTypewriterEffect(container, html, speed = 30) {
    const answerDiv = document.createElement('div');
    container.appendChild(answerDiv);

    // タグまたは一文字ずつに分解
    const tokens = html.match(/<[^>]+>|[^<]/g) || [];
    let currentHtml = "";

    for (const token of tokens) {
        currentHtml += token;
        answerDiv.innerHTML = currentHtml;

        // HTMLタグ以外の場合のみ待機
        if (!token.startsWith('<')) {
            await new Promise(resolve => setTimeout(resolve, speed));
        }

        // 常に最下部へスクロール
        container.scrollTop = container.scrollHeight;
    }
}

// 送信ボタン
sendBtn.addEventListener('mousedown', (e) => e.stopPropagation());
sendBtn.addEventListener('mouseup', (e) => e.stopPropagation());
sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sendRequest();
});

// リセットボタン
const resetBtn = document.getElementById('reset-btn');
resetBtn.addEventListener('mousedown', (e) => e.stopPropagation());
resetBtn.addEventListener('mouseup', (e) => e.stopPropagation());
resetBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    conversationHistory = [];
    userInput.value = "";
    userInput.style.height = 'auto';

    // 特殊な演出
    responseArea.innerHTML = "";
    await applyTypewriterEffect(responseArea, "うっ・・・頭が・・・（記憶消去中）");

    await new Promise(resolve => setTimeout(resolve, 2000));

    responseArea.innerHTML = ""; // 一旦クリア
    await applyTypewriterEffect(responseArea, "デスクトップからこんにちは！<br>何について調べますか？");
    userInput.focus();
});

// 入力エリア自動調整
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    const newHeight = userInput.scrollHeight;
    userInput.style.height = newHeight + 'px';
    // 450pxまではスクロールバーを出さずに吹き出しを伸ばす
    userInput.style.overflowY = newHeight >= 450 ? 'auto' : 'hidden';
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
