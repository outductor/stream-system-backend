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
  const [showSlotGrid, setShowSlotGrid] = useState(false);
  const [deleteReservation, setDeleteReservation] = useState<Reservation | null>(null);
  const { reservations, loading, error } = useReservations(selectedDate);

  const formatDateTime = (dateString: Temporal.Instant) => {
    return dateString.toZonedDateTimeISO('Asia/Tokyo').toPlainTime().toString({ smallestUnit: 'minute' });
  };

  const formatDateHeader = (date: Temporal.PlainDate) => {
    const today = Temporal.Now.plainDateISO('Asia/Tokyo');
    const tomorrow = today.add({ days: 1 });
    
    if (date.equals(today)) {
      return '今日';
    } else if (date.equals(tomorrow)) {
      return '明日';
    }
    
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.dayOfWeek % 7];
    return `${date.month}月${date.day}日(${weekday})`;
  };

  const groupReservationsByDate = (reservationList: Reservation[]) => {
    const grouped = new Map<string /* Temporal.PlainDate */, Reservation[]>();
    
    reservationList.forEach(reservation => {
      const instant = Temporal.Instant.from(reservation.startTime);
      const zonedDateTime = instant.toZonedDateTimeISO('Asia/Tokyo');
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

  const handleSlotClick = () => {
    setShowReservationForm(true);
  };

  return (
    <div className="timetable">
      <div className="timetable-header">
        <h1>DJ Event 2024 タイムテーブル</h1>
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
            今日のみ
          </button>
          <button 
            className={selectedDate === 'tomorrow' ? 'active' : ''}
            onClick={() => setSelectedDate('tomorrow')}
          >
            明日のみ
          </button>
          <button 
            className={selectedDate === 'dayAfterTomorrow' ? 'active' : ''}
            onClick={() => setSelectedDate('dayAfterTomorrow')}
          >
            明後日のみ
          </button>
        </div>
        
        <div className="action-buttons">
          <button 
            className="toggle-grid-button"
            onClick={() => setShowSlotGrid(!showSlotGrid)}
          >
            {showSlotGrid ? '一覧表示' : '空き時間を見る'}
          </button>
          <button 
            className="add-reservation-button"
            onClick={() => {
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
                        削除
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showSlotGrid && (
        <div className="slot-grid-section">
          <h2>空き時間状況</h2>
          {daysSelected.map(date => (
            <div key={date.toString()} className="date-slots">
              <h3>{formatDateHeader(date)}</h3>
              <TimeSlotGrid 
                date={date} 
                reservations={reservations.filter(r =>
                  r.startTime.toZonedDateTimeISO('Asia/Tokyo').toPlainDate().equals(date)
                )}
                onSlotClick={handleSlotClick}
              />
            </div>
          ))}
        </div>
      )}
      
      {showReservationForm && (
        <ReservationForm 
          onClose={() => setShowReservationForm(false)}
          onSuccess={handleReservationSuccess}
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