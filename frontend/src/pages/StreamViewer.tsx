import { Temporal } from 'temporal-polyfill';
import { HLSPlayer } from '../components/HLSPlayer';
import { useStreamStatus } from '../hooks/useStreamStatus';
import { useViewerCount } from '../hooks/useViewerCount';
import { useEventTimezone } from '../hooks/useEventTimezone';

const HLS_ENDPOINT = import.meta.env.VITE_HLS_ENDPOINT || 'http://localhost:8888/hls/stream';

export function StreamViewer() {
  const timezone = useEventTimezone();
  const { status, loading, error } = useStreamStatus();
  const { viewerCount } = useViewerCount();

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
    return dateString.toZonedDateTimeISO(timezone).toPlainTime().toString({ smallestUnit: 'minute' });
  };

  const formatDateTimeWithCheck = (dateString: Temporal.Instant) => {
    const zdt = dateString.toZonedDateTimeISO(timezone);
    const now = Temporal.Now.zonedDateTimeISO(timezone);
    const date = zdt.toPlainDate();
    const time = zdt.toPlainTime();

    // 同じ日の場合は時刻のみ、異なる日の場合は日付も表示
    if (Temporal.PlainDate.compare(date, now.toPlainDate()) === 0) {
      return time.toString({ smallestUnit: 'minute' });
    } else {
      return `${date.month}/${date.day} ${time.toString({ smallestUnit: 'minute' })}`;
    }
  };

  return (
    <div className="stream-viewer">
      <h1>DSR2026 DJブース ライブ配信</h1>
      
      <div className="stream-info">
        <div className={`live-indicator ${status.isLive ? 'live' : 'offline'}`}>
          {status.isLive ? '● LIVE' : '● OFFLINE'}
          {status.isLive && viewerCount !== null && (
            <span className="viewer-count"> - {viewerCount} 人が視聴中</span>
          )}
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
              const zdt = status.nextStartTime.toZonedDateTimeISO(timezone);
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
              <p>次の配信は {formatDateTimeWithCheck(status.nextStartTime)} から始まります</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}