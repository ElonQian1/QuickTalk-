// SDK 语音消息播放器
export class VoicePlayer {
  private audio: HTMLAudioElement;
  private progressCallback?: (progress: number) => void;
  private endCallback?: () => void;

  constructor() {
    this.audio = new Audio();
    this.setupEventListeners();
  }

  private setupEventListeners() {
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

  async play(url: string): Promise<void> {
    this.audio.src = url;
    try {
      await this.audio.play();
    } catch (error) {
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

  setProgressCallback(callback: (progress: number) => void) {
    this.progressCallback = callback;
  }

  setEndCallback(callback: () => void) {
    this.endCallback = callback;
  }

  get isPlaying(): boolean {
    return !this.audio.paused;
  }

  get duration(): number {
    return this.audio.duration || 0;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  set volume(value: number) {
    this.audio.volume = Math.max(0, Math.min(1, value));
  }

  destroy() {
    this.audio.pause();
    this.audio.src = '';
    this.progressCallback = undefined;
    this.endCallback = undefined;
  }
}