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
        this.currentBgDataUrl = null; // 現在の背景キャプチャ画像を保持

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
            // 移動が終わったら吹き出しを出す
            this.toggleBalloon(true);
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
            // 背景が必要な場合は仕込む（もし事前に setupBackground されていなければここで実行）
            if (!this.currentBgDataUrl) {
                await this.setupBackground();
            }

            // 表示クラスを付与 (アニメーション開始)
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
            this.currentBgDataUrl = null;
            this.balloon.style.background = '';
            this.balloon.style.backgroundPosition = '';
            this.balloon.style.backgroundSize = '';
            this.balloon.style.backgroundRepeat = '';
            this.balloon.style.boxShadow = '';
            this.closeBalloon();
        }
    }

    async setupBackground() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dolphin-blue' || theme === 'classic') {
            this.updateBalloonBackground(null);
            return;
        }

        try {
            const pos = await this.electronAPI.getWindowPosition();
            if (pos) {
                const balloonWidth = 340;
                const rightOffset = 20;
                const maxBalloonHeight = 680;
                const balloonBottomY = 1005;

                const captureRect = {
                    x: pos.x + (400 - balloonWidth - rightOffset),
                    y: pos.y + balloonBottomY - maxBalloonHeight,
                    width: balloonWidth,
                    height: maxBalloonHeight
                };

                const bgDataUrl = await this.electronAPI.captureBackground(captureRect);
                if (bgDataUrl) {
                    this.currentBgDataUrl = bgDataUrl;
                    this.updateBalloonBackground(bgDataUrl);
                }
            }
        } catch (e) {
            console.error("Failed to setup background:", e);
        }
    }

    updateBalloonBackground(bgDataUrl) {
        const theme = document.documentElement.getAttribute('data-theme');

        if (theme === 'dolphin-blue' || theme === 'classic' || !bgDataUrl) {
            // 軽量テーマ、または画像がない場合はCSSの背景グラデーションのみを使用
            this.balloon.style.background = 'var(--balloon-bg)';
            this.balloon.style.backgroundPosition = '';
            this.balloon.style.backgroundSize = '';
            this.balloon.style.backgroundRepeat = '';
            return;
        }

        // 背景画像を設定 (下揃えで適用)
        // グラデーションはCSS変数 (--glass-overlay) を使うことでテーマ変更時に自動追従させる
        this.balloon.style.background = `
             var(--glass-overlay),
             url(${bgDataUrl})
         `;
        this.balloon.style.backgroundPosition = 'bottom center';
        this.balloon.style.backgroundSize = '100% auto';
        this.balloon.style.backgroundRepeat = 'no-repeat';
    }

    closeBalloon() {
        this.balloon.classList.remove('active');
        this.isBalloonOpen = false;
        document.getElementById('api-key-modal').classList.remove('active');

        const userInput = document.getElementById('user-input');
        userInput.value = "";
        userInput.style.height = 'auto';
        // 550pxまではスクロールバーを出さずに吹き出しを伸ばす
        userInput.style.overflowY = 'hidden'; // Reset to hidden when closing
        document.getElementById('response').innerHTML = ""; // 空にして次回のアニメーションに備える
        this.isGreetingInProgress = false; // フラグもリセット

        if (this.onCloseCallback) this.onCloseCallback();
    }
}
