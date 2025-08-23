import { useState, useEffect } from 'react';
import { Temporal } from 'temporal-polyfill';
import { reservationsApi } from '../api/client';
import type { TimeSlot } from '../types/api';

interface ReservationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ReservationForm({ onClose, onSuccess }: ReservationFormProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [djName, setDjName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [passcode, setPasscode] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize with today's date
  useEffect(() => {
    const today = Temporal.Now.plainDateISO();
    setSelectedDate(today.toString());
  }, []);

  // Fetch available slots once when component mounts
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        const now = Temporal.Now.instant();
        const startTime = now.toString();
        // endTime will be automatically set to 72 hours from now by the backend
        const slots = await reservationsApi.getAvailableSlots(startTime);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      }
    };
    fetchAvailableSlots();
  }, []);

  // Generate date options for the next 3 days
  const getDateOptions = () => {
    const today = Temporal.Now.plainDateISO();
    const dates = [];
    
    for (let i = 0; i < 3; i++) {
      const date = today.add({ days: i });
      const dateString = date.toString();
      const label = i === 0 ? '今日' : i === 1 ? '明日' : `${date.month}月${date.day}日`;
      
      dates.push({
        value: dateString,
        label: `${label} (${date.month}/${date.day})`
      });
    }
    
    return dates;
  };

  const getAvailableStartTimes = () => {
    if (!selectedDate) return [];
    
    const times: { value: string; label: string; available: boolean }[] = [];
    const selectedPlainDate = Temporal.PlainDate.from(selectedDate);
    const now = Temporal.Now.plainDateTimeISO();
    const today = Temporal.Now.plainDateISO();
    
    // Filter slots for the selected date
    const slotsForDate = availableSlots.filter(slot => {
      const slotInstant = Temporal.Instant.from(slot.startTime);
      const slotDateTime = slotInstant.toZonedDateTimeISO('UTC').toPlainDateTime();
      const slotDate = slotDateTime.toPlainDate();
      return slotDate.equals(selectedPlainDate);
    });
    
    // Generate all possible time slots for the selected date
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        const timeOnDate = selectedPlainDate.toPlainDateTime({ hour, minute });
        
        // Skip past times for today
        if (selectedPlainDate.equals(today) && Temporal.PlainDateTime.compare(timeOnDate, now) <= 0) {
          continue;
        }
        
        // Convert to instant for API compatibility
        const instant = timeOnDate.toZonedDateTime('UTC').toInstant();
        const timeString = instant.toString();
        const slot = slotsForDate.find(s => s.startTime === timeString);
        const available = slot ? slot.available : false;
        
        // Only include slots that were returned by the API (within the 72-hour window)
        if (slot) {
          times.push({
            value: timeString,
            label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
            available
          });
        }
      }
    }
    
    return times;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const startInstant = Temporal.Instant.from(startTime);
      const endInstant = startInstant.add({ minutes: duration });
      const endTime = endInstant.toString();

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
          DURATION_TOO_LONG: '予約は最大1時間までです',
          INVALID_TIME_RANGE: '時間の指定が無効です',
          RANGE_TOO_LARGE: '検索範囲が大きすぎます'
        };
        setError(errorMessages[err.response.data.code] || err.response.data.message);
      } else {
        setError('予約の作成に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const dateOptions = getDateOptions();
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
            <label htmlFor="selectedDate">日付</label>
            <select
              id="selectedDate"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setStartTime(''); // Reset start time when date changes
              }}
              required
            >
              <option value="">日付を選択</option>
              {dateOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startTime">開始時刻</label>
            <select
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              disabled={!selectedDate}
            >
              <option value="">時刻を選択</option>
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