class DolphinUI {
    constructor(characterEl, balloonEl, electronAPI, onCloseCallback, onHideRequest) {
        this.character = characterEl;
        this.balloon = balloonEl;
        this.electronAPI = electronAPI;
        this.onCloseCallback = onCloseCallback;
        this.onHideRequest = onHideRequest;
        this.isDragging = false;
        this.longPressTimer = null;
        this.startX = 0;
        this.startY = 0;
        this.isBalloonOpen = false;
        this.isPendingClick = false;
        this.isGreetingInProgress = false; // 挨拶メッセージ追加中かどうかのフラグ

        this.setupEvents();
    }

    setupEvents() {
        this.character.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());

        // 吹き出し内でのクリックが背後のwindowに伝わらないようにする
        this.balloon.addEventListener('mousedown', (e) => e.stopPropagation());
        this.balloon.addEventListener('mouseup', (e) => e.stopPropagation());

        // Mouse Ignore Handling
        [this.character, this.balloon].forEach(el => {
            el.addEventListener('mouseenter', () => {
                if (!document.getElementById('api-key-modal').classList.contains('active')) {
                    this.electronAPI.setIgnoreMouse(false);
                }
            });
            el.addEventListener('mouseleave', () => {
                if (!this.isDragging && !document.getElementById('api-key-modal').classList.contains('active')) {
                    this.electronAPI.setIgnoreMouse(true);
                }
            });
        });
    }

    onMouseDown(e) {
        e.preventDefault(); // ブラウザのデフォルトのドラッグ(画像コピーなど)を防止
        this.startX = e.screenX;
        this.startY = e.screenY;
        this.isPendingClick = true;

        this.longPressTimer = setTimeout(() => {
            this.isDragging = true;
            this.isPendingClick = false;
            this.character.classList.add('long-press', 'dragging');
            this.closeBalloon();
        }, 200);
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const dx = e.screenX - this.startX;
            const dy = e.screenY - this.startY;
            this.electronAPI.moveWindow(window.screenX + dx, window.screenY + dy);
            this.startX = e.screenX;
            this.startY = e.screenY;
        }
    }

    async onMouseUp() {
        clearTimeout(this.longPressTimer);

        if (this.isDragging) {
            this.isDragging = false;
            this.character.classList.remove('long-press', 'dragging');
            this.electronAPI.setIgnoreMouse(true);
            this.savePosition();
        } else if (this.isPendingClick) {
            // ドラッグに移行せず、かつキャラクターの上でmousedownしていた場合のみ実行
            // イルカをクリックしたらアプリを隠す（非表示リクエスト）
            if (this.onHideRequest) this.onHideRequest();
        }

        this.isPendingClick = false;
    }

    async savePosition() {
        const pos = await this.electronAPI.getWindowPosition();
        if (pos) {
            localStorage.setItem('window_pos', JSON.stringify(pos));
        }
    }

    async toggleBalloon(forceState) {
        if (forceState !== undefined) {
            this.isBalloonOpen = forceState;
        } else {
            this.isBalloonOpen = !this.isBalloonOpen;
        }

        if (this.isBalloonOpen) {
            // 背景キャプチャ処理 (同期的に待機して、自分が写り込まないようにする)
            try {
                const pos = await this.electronAPI.getWindowPosition();
                if (pos) {
                    const rect = this.balloon.getBoundingClientRect();

                    // 吹き出しの最大高さを計算 (response max-height: 300px + padding + input area等)
                    // CSSで max-height: 300px, padding: 12px*2, input-area約80px = 約420px程度
                    const maxBalloonHeight = 450;
                    const balloonWidth = rect.width;

                    // bottom から bottom: 184px の位置に吹き出しがある
                    // 最大高さ分の領域をキャプチャ（下揃えで適用するため、上方向に拡張）
                    const captureRect = {
                        x: pos.x + rect.left,
                        y: pos.y + rect.bottom - maxBalloonHeight,
                        width: balloonWidth,
                        height: maxBalloonHeight
                    };
                    // キャプチャ取得
                    const bgDataUrl = await this.electronAPI.captureBackground(captureRect);

                    if (bgDataUrl && this.isBalloonOpen) {
                        // 背景画像を設定 (下揃えで適用)
                        this.balloon.style.background = `
                             linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.5)),
                             url(${bgDataUrl})
                         `;
                        this.balloon.style.backgroundPosition = 'bottom center';
                        this.balloon.style.backgroundSize = '100% auto';
                        this.balloon.style.backgroundRepeat = 'no-repeat';
                        this.balloon.style.boxShadow = `0 0px 16px 0 rgba(197, 197, 197, 0.5)`;
                    }
                }
            } catch (e) {
                console.error("Failed to set frosted background:", e);
                // エラー時は何もしない（CSSのデフォルト背景が使われる）
            }

            // キャプチャ完了後に表示クラスを付与
            this.balloon.classList.add('active');
            document.getElementById('user-input').focus();

            // 吹き出しを開く時に初期メッセージをタイプライター風に表示
            const responseArea = document.getElementById('response');
            const initialGreeting = "デスクトップからこんにちは！<br>何について調べますか？";

            // 既に同じメッセージが表示されている、またはメッセージ追加中の場合はスキップ
            if (responseArea.innerHTML.trim() === "" && !this.isGreetingInProgress) {
                this.isGreetingInProgress = true;
                await new Promise(resolve => setTimeout(resolve, 300));

                // 待機中に中身が変わった可能性を再チェック
                if (responseArea.innerHTML.trim() === "" && typeof applyTypewriterEffect === 'function') {
                    await applyTypewriterEffect(responseArea, initialGreeting);
                }
                this.isGreetingInProgress = false;
            }
        } else {
            // 閉じる時に背景関連のスタイルを全てリセット
            this.balloon.style.background = '';
            this.balloon.style.backgroundPosition = '';
            this.balloon.style.backgroundSize = '';
            this.balloon.style.backgroundRepeat = '';
            this.balloon.style.boxShadow = '';
            this.closeBalloon();
        }
    }

    closeBalloon() {
        this.balloon.classList.remove('active');
        this.isBalloonOpen = false;
        document.getElementById('api-key-modal').classList.remove('active');

        const userInput = document.getElementById('user-input');
        userInput.value = "";
        userInput.style.height = 'auto';
        document.getElementById('response').innerHTML = ""; // 空にして次回のアニメーションに備える
        this.isGreetingInProgress = false; // フラグもリセット

        if (this.onCloseCallback) this.onCloseCallback();
    }
}
