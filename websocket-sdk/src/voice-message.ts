// SDK 语音消息UI渲染器
import { VoicePlayer } from './voice-player';

export interface VoiceMessageOptions {
  fileUrl: string;
  fileName?: string;
  isOwn?: boolean;
  className?: string;
  onDownload?: () => void;
}

export class VoiceMessageRenderer {
  private player: VoicePlayer;
  private element: HTMLElement;
  private isPlaying = false;
  private duration = 0;
  private currentProgress = 0;

  constructor(private options: VoiceMessageOptions) {
    this.player = new VoicePlayer();
    this.element = this.createElement();
    this.setupEventListeners();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = `voice-message ${this.options.className || ''} ${this.options.isOwn ? 'voice-message--own' : ''}`;
    
    container.innerHTML = `
      <div class="voice-message__content">
        <button class="voice-message__play-btn" type="button">
          <svg class="voice-message__play-icon" viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 5v14l11-7z" fill="currentColor"/>
          </svg>
          <svg class="voice-message__pause-icon" viewBox="0 0 24 24" width="16" height="16" style="display: none;">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
          </svg>
        </button>
        
        <div class="voice-message__progress">
          <div class="voice-message__waveform">
            ${this.generateWaveformBars()}
          </div>
          <div class="voice-message__time">0:00</div>
        </div>
        
        ${this.options.onDownload ? `
          <button class="voice-message__download-btn" type="button" title="下载语音">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;

    // 添加基本样式
    this.addStyles(container);
    
    return container;
  }

  private generateWaveformBars(): string {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      const height = Math.random() * 20 + 5;
      bars.push(`<div class="voice-message__bar" style="height: ${height}px"></div>`);
    }
    return bars.join('');
  }

  private addStyles(container: HTMLElement) {
    // 检查是否已添加样式
    if (document.getElementById('voice-message-styles')) return;

    const style = document.createElement('style');
    style.id = 'voice-message-styles';
    style.textContent = `
      .voice-message {
        display: flex;
        flex-direction: column;
        max-width: 280px;
        padding: 12px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #e9ecef;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .voice-message--own {
        background: #007bff;
        color: white;
        border: none;
      }
      
      .voice-message__content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .voice-message__play-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .voice-message__play-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .voice-message__progress {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .voice-message__waveform {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 20px;
        cursor: pointer;
      }
      
      .voice-message__bar {
        flex: 1;
        background: currentColor;
        border-radius: 1px;
        min-height: 3px;
        opacity: 0.4;
        transition: all 0.2s;
      }
      
      .voice-message__bar--active {
        opacity: 1;
      }
      
      .voice-message__time {
        font-size: 11px;
        opacity: 0.8;
      }
      
      .voice-message__download-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .voice-message__download-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners() {
    const playBtn = this.element.querySelector('.voice-message__play-btn') as HTMLButtonElement;
    const downloadBtn = this.element.querySelector('.voice-message__download-btn') as HTMLButtonElement;
    const waveform = this.element.querySelector('.voice-message__waveform') as HTMLElement;

    playBtn?.addEventListener('click', () => this.togglePlay());
    downloadBtn?.addEventListener('click', () => this.options.onDownload?.());
    waveform?.addEventListener('click', (e) => this.handleSeek(e));

    this.player.setProgressCallback((progress) => this.updateProgress(progress));
    this.player.setEndCallback(() => this.onPlayEnd());
  }

  private async togglePlay() {
    if (this.isPlaying) {
      this.player.pause();
    } else {
      try {
        await this.player.play(this.options.fileUrl);
      } catch (error) {
        console.error('播放语音失败:', error);
        return;
      }
    }
    
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();
  }

  private updatePlayButton() {
    const playIcon = this.element.querySelector('.voice-message__play-icon') as HTMLElement;
    const pauseIcon = this.element.querySelector('.voice-message__pause-icon') as HTMLElement;
    
    if (this.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }

  private updateProgress(progress: number) {
    this.currentProgress = progress;
    
    // 更新波形进度
    const bars = this.element.querySelectorAll('.voice-message__bar');
    bars.forEach((bar, index) => {
      const barProgress = index / bars.length;
      if (barProgress < progress) {
        bar.classList.add('voice-message__bar--active');
      } else {
        bar.classList.remove('voice-message__bar--active');
      }
    });
    
    // 更新时间显示
    const timeEl = this.element.querySelector('.voice-message__time') as HTMLElement;
    const currentTime = this.player.currentTime;
    const duration = this.player.duration;
    
    if (timeEl && duration > 0) {
      timeEl.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    }
  }

  private onPlayEnd() {
    this.isPlaying = false;
    this.updatePlayButton();
    this.currentProgress = 0;
    this.updateProgress(0);
  }

  private handleSeek(event: MouseEvent) {
    const waveform = event.currentTarget as HTMLElement;
    const rect = waveform.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    
    // 这里可以实现音频跳转，需要VoicePlayer支持
    console.log('Seek to:', percent);
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy() {
    this.player.destroy();
    this.element.remove();
  }
}