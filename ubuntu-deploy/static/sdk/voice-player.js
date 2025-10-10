"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicePlayer = void 0;
// SDK 语音消息播放器
class VoicePlayer {
    constructor() {
        this.audio = new Audio();
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration > 0 && this.progressCallback) {
                const progress = this.audio.currentTime / this.audio.duration;
                this.progressCallback(progress);
            }
        });
        this.audio.addEventListener('ended', () => {
            if (this.endCallback) {
                this.endCallback();
            }
        });
    }
    async play(url) {
        this.audio.src = url;
        try {
            await this.audio.play();
        }
        catch (error) {
            console.error('播放语音失败:', error);
            throw error;
        }
    }
    pause() {
        this.audio.pause();
    }
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    setEndCallback(callback) {
        this.endCallback = callback;
    }
    get isPlaying() {
        return !this.audio.paused;
    }
    get duration() {
        return this.audio.duration || 0;
    }
    get currentTime() {
        return this.audio.currentTime;
    }
    set volume(value) {
        this.audio.volume = Math.max(0, Math.min(1, value));
    }
    destroy() {
        this.audio.pause();
        this.audio.src = '';
        this.progressCallback = undefined;
        this.endCallback = undefined;
    }
}
exports.VoicePlayer = VoicePlayer;
//# sourceMappingURL=voice-player.js.map