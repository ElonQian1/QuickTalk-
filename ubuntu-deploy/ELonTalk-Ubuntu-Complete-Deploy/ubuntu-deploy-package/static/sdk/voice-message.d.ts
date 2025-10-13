export interface VoiceMessageOptions {
    fileUrl: string;
    fileName?: string;
    isOwn?: boolean;
    className?: string;
    onDownload?: () => void;
}
export declare class VoiceMessageRenderer {
    private options;
    private player;
    private element;
    private isPlaying;
    private duration;
    private currentProgress;
    constructor(options: VoiceMessageOptions);
    private createElement;
    private generateWaveformBars;
    private addStyles;
    private setupEventListeners;
    private togglePlay;
    private updatePlayButton;
    private updateProgress;
    private onPlayEnd;
    private handleSeek;
    private formatTime;
    getElement(): HTMLElement;
    destroy(): void;
}
//# sourceMappingURL=voice-message.d.ts.map