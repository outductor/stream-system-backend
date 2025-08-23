import { useState, useEffect } from 'react';
import { format, setMinutes, setHours, addMinutes, parseISO } from 'date-fns';
import { reservationsApi } from '../api/client';
import type { TimeSlot } from '../types/api';

interface ReservationFormProps {
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReservationForm({ date, onClose, onSuccess }: ReservationFormProps) {
  const [djName, setDjName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [passcode, setPasscode] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        const slots = await reservationsApi.getAvailableSlots(date);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      }
    };
    fetchAvailableSlots();
  }, [date]);

  const getAvailableStartTimes = () => {
    const now = new Date();
    const times: { value: string; label: string; available: boolean }[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        const time = setMinutes(setHours(new Date(date), hour), minute);
        const timeString = format(time, "yyyy-MM-dd'T'HH:mm:ss'Z'");
        
        // Check if this time is in the past
        if (time <= now && date === format(now, 'yyyy-MM-dd')) {
          continue;
        }
        
        // Check if this slot is available
        const slot = availableSlots.find(s => s.startTime === timeString);
        const available = slot ? slot.available : false;
        
        times.push({
          value: timeString,
          label: format(time, 'HH:mm'),
          available
        });
      }
    }
    
    return times;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endTime = format(
        addMinutes(parseISO(startTime), duration),
        "yyyy-MM-dd'T'HH:mm:ss'Z'"
      );

      await reservationsApi.createReservation({
        djName,
        startTime,
        endTime,
        passcode
      });

      onSuccess();
    } catch (err: any) {
      if (err.response?.data?.code) {
        const errorMessages: Record<string, string> = {
          TIME_CONFLICT: '指定された時間帯は既に予約されています',
          PAST_TIME: '過去の時間は予約できません',
          INVALID_TIME_INTERVAL: '時間は15分刻みで指定してください',
          DURATION_TOO_LONG: '予約は最大1時間までです'
        };
        setError(errorMessages[err.response.data.code] || err.response.data.message);
      } else {
        setError('予約の作成に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const startTimes = getAvailableStartTimes();

  return (
    <div className="reservation-form-overlay" onClick={onClose}>
      <div className="reservation-form" onClick={(e) => e.stopPropagation()}>
        <h2>予約登録</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="djName">DJ名</label>
            <input
              id="djName"
              type="text"
              value={djName}
              onChange={(e) => setDjName(e.target.value)}
              maxLength={100}
              required
              placeholder="DJ名を入力（絵文字使用可）"
            />
          </div>

          <div className="form-group">
            <label htmlFor="startTime">開始時刻</label>
            <select
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {startTimes.map(({ value, label, available }) => (
                <option key={value} value={value} disabled={!available}>
                  {label} {!available && '(予約済み)'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="duration">配信時間</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={15}>15分</option>
              <option value={30}>30分</option>
              <option value={45}>45分</option>
              <option value={60}>60分</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="passcode">暗証番号（4桁）</label>
            <input
              id="passcode"
              type="text"
              value={passcode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPasscode(value);
              }}
              pattern="[0-9]{4}"
              maxLength={4}
              required
              placeholder="削除時に必要な4桁の数字"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              キャンセル
            </button>
            <button type="submit" disabled={loading || !djName || !startTime || passcode.length !== 4}>
              {loading ? '登録中...' : '予約する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}