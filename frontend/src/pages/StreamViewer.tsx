import { HLSPlayer } from '../components/HLSPlayer';
import { useStreamStatus } from '../hooks/useStreamStatus';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const HLS_ENDPOINT = import.meta.env.VITE_HLS_ENDPOINT || 'http://localhost:8888/hls/stream';

export function StreamViewer() {
  const { status, loading, error } = useStreamStatus();

  if (loading) {
    return (
      <div className="stream-viewer">
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stream-viewer">
        <div className="error">エラーが発生しました: {error.message}</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="stream-viewer">
        <div className="error">配信情報を取得できませんでした</div>
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm', { locale: ja });
  };

  return (
    <div className="stream-viewer">
      <h1>DJ Event 2024 ライブ配信</h1>
      
      <div className="stream-info">
        <div className={`live-indicator ${status.isLive ? 'live' : 'offline'}`}>
          {status.isLive ? '● LIVE' : '● OFFLINE'}
        </div>
        
        {status.currentDj && (
          <div className="current-dj">
            <h2>現在のDJ: {status.currentDj}</h2>
            {status.currentStartTime && status.currentEndTime && (
              <p className="time-info">
                {formatTime(status.currentStartTime)} - {formatTime(status.currentEndTime)}
              </p>
            )}
          </div>
        )}
        
        {status.nextDj && status.nextStartTime && (
          <div className="next-dj">
            <h3>次のDJ: {status.nextDj}</h3>
            <p className="time-info">開始時刻: {formatTime(status.nextStartTime)}</p>
          </div>
        )}
      </div>

      <div className="player-container">
        {status.isLive ? (
          <HLSPlayer src={HLS_ENDPOINT} />
        ) : (
          <div className="offline-message">
            <p>現在配信はオフラインです</p>
            {status.nextDj && status.nextStartTime && (
              <p>次の配信は {formatTime(status.nextStartTime)} から始まります</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}