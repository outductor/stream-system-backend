import { useState, useEffect } from 'react';
import { Temporal } from 'temporal-polyfill';
import { reservationsApi } from '../api/client';
import type { TimeSlot } from '../types/api';

interface ReservationFormProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultStartInstant: Temporal.Instant | null;
}

export function ReservationForm({ onClose, onSuccess, defaultStartInstant }: ReservationFormProps) {
  const [selectedDate, setSelectedDate] = useState(defaultStartInstant?.toZonedDateTimeISO('Asia/Tokyo')?.toPlainDate());
  const [selectedStartTime, setSelectedStartTime] = useState(defaultStartInstant?.toZonedDateTimeISO('Asia/Tokyo')?.toPlainTime());

  const [djName, setDjName] = useState('');
  const [duration, setDuration] = useState(60);
  const [passcode, setPasscode] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize with today's date
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(Temporal.Now.plainDateISO('Asia/Tokyo'));
    }
  }, [selectedDate]);

  // Fetch available slots once when component mounts
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        // endTime will be automatically set to 72 hours from now by the backend
        const slots = await reservationsApi.getAvailableSlots(Temporal.Now.instant());
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
      const label = i === 0 ? '今日' : i === 1 ? '明日' : `明後日`;
      
      dates.push({
        value: date,
        label: `${label} (${date.month}/${date.day})`
      });
    }
    
    return dates;
  };

  const getAvailableStartTimes = () => {
    if (!selectedDate) return [];
    
    const times: { value: Temporal.PlainTime; label: string; available: boolean }[] = [];
    const selectedPlainDate = Temporal.PlainDate.from(selectedDate);
    const now = Temporal.Now.plainDateTimeISO('Asia/Tokyo');
    const today = Temporal.Now.plainDateISO('Asia/Tokyo');
    
    // Filter slots for the selected date
    const slotsForDate = availableSlots.filter(slot => {
      const slotDate = slot.startTime.toZonedDateTimeISO('Asia/Tokyo').toPlainDate();
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
        const instant = timeOnDate.toZonedDateTime('Asia/Tokyo').toInstant();
        const slot = slotsForDate.find(s => s.startTime.equals(instant));
        const available = slot ? slot.available : false;
        
        // Only include slots that were returned by the API (within the 72-hour window)
        if (slot) {
          times.push({
            value: timeOnDate.toPlainTime(),
            label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
            available
          });
        }
      }
    }
    
    return times;
  };

  const getAvailableDurations = () => {
    if (!selectedDate || !selectedStartTime) return [15, 30, 45, 60];
    
    const selectedDateTime = selectedDate.toPlainDateTime(selectedStartTime);
    const startInstant = selectedDateTime.toZonedDateTime('Asia/Tokyo').toInstant();
    
    const durations = [15, 30, 45, 60];
    const availableDurations: number[] = [];
    
    for (const duration of durations) {
      let canSelect = true;
      
      // Check each 15-minute slot needed for this duration
      for (let minutes = 0; minutes < duration; minutes += 15) {
        const slotInstant = startInstant.add({ minutes });
        const slot = availableSlots.find(s => s.startTime.equals(slotInstant));
        
        if (!slot || !slot.available) {
          canSelect = false;
          break;
        }
      }
      
      if (canSelect) {
        availableDurations.push(duration);
      }
    }
    
    return availableDurations;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!selectedDate || !selectedStartTime) {
        setError('開始時刻を選択してください');
        return
      }

      const startInstant = selectedDate
        .toPlainDateTime(selectedStartTime)
        .toZonedDateTime('Asia/Tokyo').toInstant(); 
      await reservationsApi.createReservation({
        djName,
        startTime: startInstant,
        endTime: startInstant.add({ minutes: duration }),
        passcode
      });

      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { code?: string; message?: string } } };
      if (error.response?.data?.code) {
        const errorMessages: Record<string, string> = {
          TIME_CONFLICT: '指定された時間帯は既に予約されています',
          PAST_TIME: '過去の時間は予約できません',
          INVALID_TIME_INTERVAL: '時間は15分刻みで指定してください',
          DURATION_TOO_LONG: '予約は最大1時間までです',
          INVALID_TIME_RANGE: '時間の指定が無効です',
          RANGE_TOO_LARGE: '検索範囲が大きすぎます'
        };
        setError(errorMessages[error.response.data.code] || error.response.data.message || 'エラーが発生しました');
      } else {
        setError('予約の作成に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const dateOptions = getDateOptions();
  const startTimes = getAvailableStartTimes();
  const availableDurations = getAvailableDurations();

  // Auto-adjust duration if current selection becomes unavailable
  useEffect(() => {
    if (selectedStartTime && availableDurations.length > 0 && !availableDurations.includes(duration)) {
      setDuration(availableDurations[0]);
    }
  }, [selectedStartTime, availableDurations, duration]);

  console.log(selectedStartTime)

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
              value={selectedDate?.toString() || ''}
              onChange={(e) => {
                setSelectedDate(Temporal.PlainDate.from(e.target.value));
                setSelectedStartTime(undefined); // Reset start time when date changes
              }}
              required
            >
              <option value="">日付を選択</option>
              {dateOptions.map(({ value, label }) => (
                <option key={value.toString()} value={value.toString()}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startTime">開始時刻</label>
            <select
              id="startTime"
              value={selectedStartTime?.toString()}
              onChange={(e) => {
                setSelectedStartTime(Temporal.PlainTime.from(e.target.value))
              }}
              required
              disabled={!selectedDate}
            >
              <option value="">時刻を選択</option>
              {startTimes.map(({ value, label, available }) => (
                <option key={value.toString()} value={value.toString()} disabled={!available}>
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
              <option value={15} disabled={!availableDurations.includes(15)}>15分</option>
              <option value={30} disabled={!availableDurations.includes(30)}>30分</option>
              <option value={45} disabled={!availableDurations.includes(45)}>45分</option>
              <option value={60} disabled={!availableDurations.includes(60)}>60分</option>
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
            <button type="submit" disabled={loading || !djName || !selectedStartTime || !selectedDate || passcode.length !== 4}>
              {loading ? '登録中...' : '予約する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}