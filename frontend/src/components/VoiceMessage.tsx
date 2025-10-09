import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FiPlay, FiPause, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VoiceMessageProps {
  fileUrl: string;
  fileName?: string;
  timestamp: string;
  senderType: 'staff' | 'customer';
  isOwn?: boolean;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({ 
  fileUrl, 
  fileName = '语音消息', 
  timestamp,
  senderType,
  isOwn = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      console.error('语音文件加载失败');
      setIsLoaded(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [fileUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const downloadAudio = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Container $isOwn={isOwn} $senderType={senderType}>
      <audio ref={audioRef} src={fileUrl} preload="metadata" />
      
      <VoiceControls>
        <PlayButton onClick={togglePlay} disabled={!isLoaded}>
          {isPlaying ? <FiPause /> : <FiPlay />}
        </PlayButton>
        
        <VoiceInfo>
          <WaveformContainer onClick={handleSeek}>
            <ProgressBar style={{ width: `${progressPercent}%` }} />
            <WaveformBars>
              {Array.from({ length: 20 }, (_, i) => (
                <WaveBar 
                  key={i} 
                  style={{ 
                    height: `${Math.random() * 20 + 5}px`,
                    opacity: i / 20 < progressPercent / 100 ? 1 : 0.3
                  }} 
                />
              ))}
            </WaveformBars>
          </WaveformContainer>
          
          <TimeInfo>
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </TimeInfo>
        </VoiceInfo>
        
        <DownloadButton onClick={downloadAudio} title="下载语音">
          <FiDownload />
        </DownloadButton>
      </VoiceControls>
      
      <MessageTime>
        {format(new Date(timestamp), 'HH:mm', { locale: zhCN })}
      </MessageTime>
    </Container>
  );
};

const Container = styled.div<{ $isOwn: boolean; $senderType: string }>`
  display: flex;
  flex-direction: column;
  max-width: 300px;
  padding: 12px;
  border-radius: 12px;
  background: ${props => props.$isOwn ? '#007bff' : '#ffffff'};
  color: ${props => props.$isOwn ? 'white' : '#333'};
  border: ${props => props.$isOwn ? 'none' : '1px solid #e9ecef'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const VoiceControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PlayButton = styled.button`
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const VoiceInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const WaveformContainer = styled.div`
  position: relative;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
`;

const ProgressBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  transition: width 0.1s ease;
`;

const WaveformBars = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
`;

const WaveBar = styled.div`
  flex: 1;
  background: currentColor;
  border-radius: 1px;
  min-height: 3px;
  transition: all 0.2s;
`;

const TimeInfo = styled.div`
  font-size: 11px;
  opacity: 0.8;
`;

const DownloadButton = styled.button`
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const MessageTime = styled.div`
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
`;

export default VoiceMessage;