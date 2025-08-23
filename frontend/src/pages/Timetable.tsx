import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useReservations } from '../hooks/useReservations';
import type { Reservation } from '../types/api';
import { CurrentTime } from '../components/CurrentTime';
import { TimeSlotGrid } from '../components/TimeSlotGrid';
import { ReservationForm } from '../components/ReservationForm';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';

export function Timetable() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showSlotGrid, setShowSlotGrid] = useState(false);
  const [deleteReservation, setDeleteReservation] = useState<Reservation | null>(null);
  const { reservations, loading, error } = useReservations(selectedDate);

  const formatDateTime = (dateString: string) => {
    const instant = Temporal.Instant.from(dateString);
    const zonedDateTime = instant.toZonedDateTimeISO('Asia/Tokyo');
    return zonedDateTime.toPlainTime().toString({ smallestUnit: 'minute' });
  };

  const formatDateHeader = (dateString: string) => {
    const instant = Temporal.Instant.from(dateString + "T00:00:00Z");
    const zonedDateTime = instant.toZonedDateTimeISO('Asia/Tokyo');
    const date = zonedDateTime.toPlainDate();
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
    const grouped = new Map<string, Reservation[]>();
    
    reservationList.forEach(reservation => {
      const instant = Temporal.Instant.from(reservation.startTime);
      const zonedDateTime = instant.toZonedDateTimeISO('Asia/Tokyo');
      const dateKey = zonedDateTime.toPlainDate().toString();
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(reservation);
    });

    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
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
  const today = Temporal.Now.plainDateISO('Asia/Tokyo').toString();
  const tomorrow = Temporal.Now.plainDateISO('Asia/Tokyo').add({ days: 1 }).toString();

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
            className={selectedDate === '' ? 'active' : ''}
            onClick={() => setSelectedDate('')}
          >
            今日・明日
          </button>
          <button 
            className={selectedDate === today ? 'active' : ''}
            onClick={() => setSelectedDate(today)}
          >
            今日のみ
          </button>
          <button 
            className={selectedDate === tomorrow ? 'active' : ''}
            onClick={() => setSelectedDate(tomorrow)}
          >
            明日のみ
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
            <div key={date} className="date-group">
              <h2 className="date-header">{formatDateHeader(date)}</h2>
              <div className="reservation-items">
                {dateReservations
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
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
          {(selectedDate === '' ? [today, tomorrow] : [selectedDate]).map(date => (
            <div key={date} className="date-slots">
              <h3>{formatDateHeader(date)}</h3>
              <TimeSlotGrid 
                date={date} 
                reservations={reservations.filter(r => {
                  const instant = Temporal.Instant.from(r.startTime);
                  const zonedDateTime = instant.toZonedDateTimeISO('Asia/Tokyo');
                  const dateKey = zonedDateTime.toPlainDate().toString();
                  return dateKey === date;
                })}
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