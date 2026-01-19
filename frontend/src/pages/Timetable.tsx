import { useState, useEffect } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useReservations } from '../hooks/useReservations';
import { useEventTimezone } from '../hooks/useEventTimezone';
import type { Reservation, EventConfig } from '../types/api';
import { CurrentTime } from '../components/CurrentTime';
import { TimeSlotGrid } from '../components/TimeSlotGrid';
import { ReservationForm } from '../components/ReservationForm';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { configApi } from '../api/client';

type DateSelection = 'any' | string; // 'any' or ISO date string like '2025-08-29'

export function Timetable() {
  const timezone = useEventTimezone();
  const [selectedDate, setSelectedDate] = useState<DateSelection>('any');
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationFormDefaultInstant, setReservationFormDefaultInstant] = useState<Temporal.Instant | null>(null);
  const [deleteReservation, setDeleteReservation] = useState<Reservation | null>(null);
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const { reservations, loading, error } = useReservations(selectedDate);

  useEffect(() => {
    configApi.getEventConfig().then(setEventConfig).catch(console.error);
  }, []);

  const formatDateTimeWithCrossDay = (reservation: Reservation, currentDate: Temporal.PlainDate) => {
    const startZoned = reservation.startTime.toZonedDateTimeISO(timezone);
    const endZoned = reservation.endTime.toZonedDateTimeISO(timezone);
    const startDate = startZoned.toPlainDate();
    const endDate = endZoned.toPlainDate();
    
    const formatTimeWithOver24 = (time: Temporal.PlainTime, isNextDay: boolean) => {
      const hour = isNextDay ? time.hour + 24 : time.hour;
      const minute = time.minute.toString().padStart(2, '0');
      return `${hour}:${minute}`;
    };
    
    const startTimeStr = formatTimeWithOver24(startZoned.toPlainTime(), false);
    const endTimeStr = formatTimeWithOver24(
      endZoned.toPlainTime(), 
      currentDate.equals(startDate) && !startDate.equals(endDate)
    );
    
    // If reservation spans multiple days
    if (!startDate.equals(endDate)) {
      if (currentDate.equals(startDate)) {
        // On start date, show end time as 24+ hours (e.g., 25:00 for 1:00 AM next day)
        return `${startTimeStr} - ${endTimeStr}`;
      } else if (currentDate.equals(endDate)) {
        // On end date, show that it started from previous day
        const normalEndTimeStr = endZoned.toPlainTime().toString({ smallestUnit: 'minute' });
        return `前日${startZoned.toPlainTime().toString({ smallestUnit: 'minute' })} - ${normalEndTimeStr}`;
      }
    }
    
    // Same day reservation
    return `${startTimeStr} - ${endZoned.toPlainTime().toString({ smallestUnit: 'minute' })}`;
  };

  const formatDateHeader = (date: Temporal.PlainDate) => {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.dayOfWeek % 7];
    return `${date.month}月${date.day}日(${weekday})`;
  };

  const groupReservationsByDate = (reservationList: Reservation[]) => {
    const grouped = new Map<string /* Temporal.PlainDate */, Reservation[]>();
    
    reservationList.forEach(reservation => {
      const startInstant = Temporal.Instant.from(reservation.startTime);
      const endInstant = Temporal.Instant.from(reservation.endTime);
      const startZonedDateTime = startInstant.toZonedDateTimeISO(timezone);
      const endZonedDateTime = endInstant.toZonedDateTimeISO(timezone);
      const startDate = startZonedDateTime.toPlainDate();
      const endDate = endZonedDateTime.toPlainDate();
      
      // Add reservation to start date
      const startDateKey = startDate.toString();
      if (!grouped.has(startDateKey)) {
        grouped.set(startDateKey, []);
      }
      grouped.get(startDateKey)!.push(reservation);
      
      // If reservation spans multiple days, also add to end date
      if (!startDate.equals(endDate)) {
        const endDateKey = endDate.toString();
        if (!grouped.has(endDateKey)) {
          grouped.set(endDateKey, []);
        }
        // Avoid duplicate if already added
        const existingInEndDate = grouped.get(endDateKey)!;
        if (!existingInEndDate.some(r => r.id === reservation.id)) {
          grouped.get(endDateKey)!.push(reservation);
        }
      }
    });

    return (
      Array.from(grouped.entries())
        .map(([date, res]) => [Temporal.PlainDate.from(date), res] as const)
        .sort(([a], [b]) => Temporal.PlainDate.compare(a, b))
    );
  };

  if (loading) {
    return (
      <div className="timetable">
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timetable">
        <div className="error">エラーが発生しました: {error.message}</div>
      </div>
    );
  }

  const groupedReservations = groupReservationsByDate(reservations);

  // イベント期間から日付リストを生成
  const generateEventDays = (): Temporal.PlainDate[] => {
    if (!eventConfig?.eventStartTime || !eventConfig?.eventEndTime) {
      // フォールバック: 今日から3日間
      const today = Temporal.Now.zonedDateTimeISO(timezone).toPlainDate();
      return [today, today.add({ days: 1 }), today.add({ days: 2 })];
    }

    const startDate = eventConfig.eventStartTime.toZonedDateTimeISO(timezone).toPlainDate();
    const endDate = eventConfig.eventEndTime.toZonedDateTimeISO(timezone).toPlainDate();
    
    const days: Temporal.PlainDate[] = [];
    let currentDate = startDate;
    
    while (Temporal.PlainDate.compare(currentDate, endDate) <= 0) {
      days.push(currentDate);
      currentDate = currentDate.add({ days: 1 });
    }
    
    return days;
  };

  const eventDays = generateEventDays();

  const daysSelected =
    selectedDate === 'any' 
      ? eventDays 
      : eventDays.filter(d => d.toString() === selectedDate);

  const handleReservationSuccess = () => {
    setShowReservationForm(false);
    window.location.reload();
  };

  const handleDeleteSuccess = () => {
    setDeleteReservation(null);
    window.location.reload();
  };

  const handleSlotClick = (slotInstant: Temporal.Instant) => {
    setReservationFormDefaultInstant(slotInstant);
    setShowReservationForm(true);
  };

  return (
    <div className="timetable">
      <div className="timetable-header">
        <h1>DSR2025 DJブース タイムテーブル</h1>
        <CurrentTime />
      </div>
      
      <div className="controls-section">
        <div className="date-filters">
          <button 
            className={selectedDate === 'any' ? 'active' : ''}
            onClick={() => setSelectedDate('any')}
          >
            すべて
          </button>
          {eventDays.map((date) => (
            <button
              key={date.toString()}
              className={selectedDate === date.toString() ? 'active' : ''}
              onClick={() => setSelectedDate(date.toString())}
            >
              {formatDateHeader(date)}
            </button>
          ))}
        </div>
        
        <div className="action-buttons">
          <button 
            className="add-reservation-button"
            onClick={() => {
              setReservationFormDefaultInstant(null);
              setShowReservationForm(true);
            }}
          >
            予約を追加
          </button>
        </div>
      </div>

      {(() => {
        const filteredReservations = groupedReservations.filter(([date]) => 
          daysSelected.some(selectedDay => selectedDay.equals(date))
        );
        
        if (filteredReservations.length === 0) {
          return (
            <div className="no-reservations">
              <p>選択された日付に予約がありません</p>
            </div>
          );
        }
        
        return (
          <div className="reservations-list">
            {filteredReservations.map(([date, dateReservations]) => (
            <div key={date.toString()} className="date-group">
              <h2 className="date-header">{formatDateHeader(date)}</h2>
              <div className="reservation-items">
                {dateReservations
                  .sort((a, b) => Temporal.Instant.compare(a.startTime, b.startTime))
                  .map(reservation => (
                    <div key={reservation.id} className="reservation-item">
                      <div className="reservation-content">
                        <div className="time-slot">
                          {formatDateTimeWithCrossDay(reservation, date)}
                        </div>
                        <div className="dj-name">{reservation.djName}</div>
                      </div>
                      <button 
                        className="delete-button"
                        onClick={() => setDeleteReservation(reservation)}
                      >
                        予約取消
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          </div>
        );
      })()}
      
      <div className="slot-grid-section">
        <h2>空き時間状況</h2>
        {daysSelected.map(date => (
          <div key={date.toString()} className="date-slots">
            <h3>{formatDateHeader(date)}</h3>
            <TimeSlotGrid
              date={date}
              reservations={reservations.filter(r => {
                const startDate = r.startTime.toZonedDateTimeISO(timezone).toPlainDate();
                // Start of this date as Instant for exclusive end comparison
                const dayStart = date.toZonedDateTime(timezone).toInstant();
                // Include if: startDate <= date AND endTime > dayStart (exclusive end)
                return Temporal.PlainDate.compare(startDate, date) <= 0 &&
                       Temporal.Instant.compare(r.endTime, dayStart) > 0;
              })}
              onSlotClick={handleSlotClick}
            />
          </div>
        ))}
      </div>
      
      {showReservationForm && (
        <ReservationForm 
          onClose={() => setShowReservationForm(false)}
          onSuccess={handleReservationSuccess}
          defaultStartInstant={reservationFormDefaultInstant}
        />
      )}
      
      {deleteReservation && (
        <DeleteConfirmDialog 
          reservation={deleteReservation}
          onClose={() => setDeleteReservation(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}