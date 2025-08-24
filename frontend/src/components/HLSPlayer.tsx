import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  src: string;
  autoPlay?: boolean;
}

export function HLSPlayer({ src, autoPlay = true }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const setupHls = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          
          // Buffer configuration for low latency
          maxBufferLength: 3,              // 3秒のバッファ（was 10）
          maxMaxBufferLength: 10,          // 最大10秒（was 30）
          maxBufferSize: 10 * 1000 * 1000, // 10MB max buffer size
          maxBufferHole: 0.5,              // 0.5秒の穴まで許容
          
          // Low latency optimizations
          liveSyncDurationCount: 2,        // 2セグメント分のライブ同期（デフォルト3）
          liveMaxLatencyDurationCount: 5,  // 最大5セグメント分の遅延
          liveDurationInfinity: false,
          
          // Aggressive settings for reducing latency
          highBufferWatchdogPeriod: 1,     // 1秒ごとにバッファチェック
          nudgeMaxRetry: 5,
          
          // Fragment loading settings
          fragLoadingTimeOut: 10000,
          fragLoadingMaxRetry: 3,
          fragLoadingRetryDelay: 500,
          
          // Level loading settings  
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 3,
          levelLoadingRetryDelay: 500,
        });

        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            video.play().catch((error) => {
              console.log('Autoplay blocked:', error);
              setShowPlayButton(true);
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error encountered, trying to recover');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error encountered, trying to recover');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, destroying HLS instance');
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        if (autoPlay) {
          video.play().catch((error) => {
            console.log('Autoplay blocked:', error);
            setShowPlayButton(true);
          });
        }
      }
    };

    setupHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setShowPlayButton(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <video
        ref={videoRef}
        controls
        muted={autoPlay}
        className="hls-player"
        style={{ width: '100%', maxWidth: '100%' }}
      />
      {showPlayButton && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={handlePlayClick}
        >
          <div 
            style={{
              width: 0,
              height: 0,
              borderLeft: '30px solid white',
              borderTop: '20px solid transparent',
              borderBottom: '20px solid transparent',
              marginLeft: '8px',
            }}
          />
        </div>
      )}
    </div>
  );
}