class DolphinUI {
    constructor(characterEl, balloonEl, electronAPI) {
        this.character = characterEl;
        this.balloon = balloonEl;
        this.electronAPI = electronAPI;
        this.isDragging = false;
        this.longPressTimer = null;
        this.startX = 0;
        this.startY = 0;
        this.isBalloonOpen = false;
        this.isPendingClick = false;

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
        this.startX = e.screenX;
        this.startY = e.screenY;
        this.isPendingClick = true;

        this.longPressTimer = setTimeout(() => {
            this.isDragging = true;
            this.isPendingClick = false;
            this.character.classList.add('long-press');
            this.closeBalloon();
        }, 1000);
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
            this.character.classList.remove('long-press');
            this.electronAPI.setIgnoreMouse(true);
            this.savePosition();
        } else if (this.isPendingClick) {
            // ドラッグに移行せず、かつキャラクターの上でmousedownしていた場合のみ実行
            this.toggleBalloon();
        }

        this.isPendingClick = false;
    }

    async savePosition() {
        const pos = await this.electronAPI.getWindowPosition();
        if (pos) {
            localStorage.setItem('window_pos', JSON.stringify(pos));
        }
    }

    toggleBalloon() {
        this.isBalloonOpen = !this.isBalloonOpen;
        if (this.isBalloonOpen) {
            this.balloon.classList.add('active');
            document.getElementById('user-input').focus();
        } else {
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
        document.getElementById('response').innerHTML = "デスクトップからこんにちは！🐬<br>お困りのことがあればいつでも教えてくださいね。";
    }
}
