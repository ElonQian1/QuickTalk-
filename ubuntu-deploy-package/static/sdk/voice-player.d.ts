export declare class VoicePlayer {
    private audio;
    private progressCallback?;
    private endCallback?;
    constructor();
    private setupEventListeners;
    play(url: string): Promise<void>;
    pause(): void;
    stop(): void;
    setProgressCallback(callback: (progress: number) => void): void;
    setEndCallback(callback: () => void): void;
    get isPlaying(): boolean;
    get duration(): number;
    get currentTime(): number;
    set volume(value: number);
    destroy(): void;
}
//# sourceMappingURL=voice-player.d.ts.map