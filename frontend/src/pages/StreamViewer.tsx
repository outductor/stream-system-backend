import { Temporal } from 'temporal-polyfill';
import { HLSPlayer } from '../components/HLSPlayer';
import { useStreamStatus } from '../hooks/useStreamStatus';

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

  const formatTime = (dateString: Temporal.Instant) => {
    return dateString.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainTime().toString({ smallestUnit: 'minute' });
  };

  return (
    <div className="stream-viewer">
      <h1>DSR2025 DJブース ライブ配信</h1>
      
      <div className="stream-info">
        <div className={`live-indicator ${status.isLive ? 'live' : 'offline'}`}>
          {status.isLive ? '● LIVE' : '● OFFLINE'}
        </div>
        
        {/* Case 1: 配信枠あり＆配信中 */}
        {status.currentDj && status.isLive && (
          <div className="current-dj">
            <h2>現在のDJ: {status.currentDj}</h2>
            {status.currentStartTime && status.currentEndTime && (
              <p className="time-info">
                {formatTime(status.currentStartTime)} - {formatTime(status.currentEndTime)}
              </p>
            )}
          </div>
        )}
        
        {/* Case 2: 配信枠なし＆配信中（ゲリラ配信） */}
        {!status.currentDj && status.isLive && (
          <div className="guerrilla-stream">
            <h2>配信枠が登録されていません</h2>
            <p className="guerrilla-note">ゲリラ配信中かも？</p>
          </div>
        )}
        
        {/* Case 3: 配信枠あり＆配信なし */}
        {status.currentDj && !status.isLive && (
          <>
            <div className="current-dj offline">
              <h2>現在の配信枠: {status.currentDj}</h2>
              {status.currentStartTime && status.currentEndTime && (
                <p className="time-info">
                  {formatTime(status.currentStartTime)} - {formatTime(status.currentEndTime)}
                </p>
              )}
            </div>
            <div className="offline-notice">
              <p>⚠️ ただいまオフライン中です</p>
            </div>
          </>
        )}
        
        {/* Case 4: 配信枠なし＆配信なし */}
        {!status.currentDj && !status.isLive && (
          <div className="no-stream">
            <p>ただいまオフライン中です</p>
            <p className="chance-message">🎯 配信枠獲得のチャンス！</p>
          </div>
        )}
        
        {/* 次の配信予定 */}
        {status.nextDj && status.nextStartTime && (
          <div className="next-dj">
            <h3>次のDJ: {status.nextDj}</h3>
            <p className="time-info">開始時刻: {(() => {
              const zdt = status.nextStartTime.toZonedDateTimeISO(Temporal.Now.timeZoneId());
              const date = zdt.toPlainDate();
              const time = zdt.toPlainTime();
              return `${date.month}/${date.day} ${time.toString({ smallestUnit: 'minute' })}`;
            })()}</p>
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