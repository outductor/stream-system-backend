import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useReservations } from '../hooks/useReservations';
import type { Reservation } from '../types/api';
import { CurrentTime } from '../components/CurrentTime';
import { TimeSlotGrid } from '../components/TimeSlotGrid';
import { ReservationForm } from '../components/ReservationForm';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';

type DateSelection = 'any' | 'today' | 'tomorrow' | 'dayAfterTomorrow';

export function Timetable() {
  const [selectedDate, setSelectedDate] = useState<DateSelection>('any');
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationFormDefaultInstant, setReservationFormDefaultInstant] = useState<Temporal.Instant | null>(null);
  const [deleteReservation, setDeleteReservation] = useState<Reservation | null>(null);
  const { reservations, loading, error } = useReservations(selectedDate);

  const formatDateTime = (dateString: Temporal.Instant) => {
    return dateString.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainTime().toString({ smallestUnit: 'minute' });
  };

  const formatDateHeader = (date: Temporal.PlainDate) => {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.dayOfWeek % 7];
    return `${date.month}月${date.day}日(${weekday})`;
  };

  const groupReservationsByDate = (reservationList: Reservation[]) => {
    const grouped = new Map<string /* Temporal.PlainDate */, Reservation[]>();
    
    reservationList.forEach(reservation => {
      const instant = Temporal.Instant.from(reservation.startTime);
      const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
      const dateKey = zonedDateTime.toPlainDate().toString();
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(reservation);
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

  const today = Temporal.Now.plainDateISO('Asia/Tokyo');
  const tomorrow = today.add({ days: 1 });
  const dayAfterTomorrow = today.add({ days: 2 });

  const daysSelected =
    selectedDate === 'any' ? [today, tomorrow, dayAfterTomorrow] :
    selectedDate === 'today' ? [today] :
    selectedDate === 'tomorrow' ? [tomorrow] :
    selectedDate === 'dayAfterTomorrow' ? [dayAfterTomorrow] : [];

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
          <button 
            className={selectedDate === 'today' ? 'active' : ''}
            onClick={() => setSelectedDate('today')}
          >
            {formatDateHeader(today)}
          </button>
          <button 
            className={selectedDate === 'tomorrow' ? 'active' : ''}
            onClick={() => setSelectedDate('tomorrow')}
          >
            {formatDateHeader(tomorrow)}
          </button>
          <button 
            className={selectedDate === 'dayAfterTomorrow' ? 'active' : ''}
            onClick={() => setSelectedDate('dayAfterTomorrow')}
          >
            {formatDateHeader(dayAfterTomorrow)}
          </button>
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

      {groupedReservations.length === 0 ? (
        <div className="no-reservations">
          <p>予約がありません</p>
        </div>
      ) : (
        <div className="reservations-list">
          {groupedReservations.map(([date, dateReservations]) => (
            <div key={date.toString()} className="date-group">
              <h2 className="date-header">{formatDateHeader(date)}</h2>
              <div className="reservation-items">
                {dateReservations
                  .sort((a, b) => Temporal.Instant.compare(a.startTime, b.startTime))
                  .map(reservation => (
                    <div key={reservation.id} className="reservation-item">
                      <div className="reservation-content">
                        <div className="time-slot">
                          {formatDateTime(reservation.startTime)} - {formatDateTime(reservation.endTime)}
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
      )}
      
      <div className="slot-grid-section">
        <h2>空き時間状況</h2>
        {daysSelected.map(date => (
          <div key={date.toString()} className="date-slots">
            <h3>{formatDateHeader(date)}</h3>
            <TimeSlotGrid 
              date={date} 
              reservations={reservations.filter(r =>
                r.startTime.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate().equals(date)
              )}
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