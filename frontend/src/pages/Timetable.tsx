import { useState } from 'react';
import { useReservations } from '../hooks/useReservations';
import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Reservation } from '../types/api';
import { CurrentTime } from '../components/CurrentTime';
import { TimeSlotGrid } from '../components/TimeSlotGrid';
import { ReservationForm } from '../components/ReservationForm';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';

export function Timetable() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showSlotGrid, setShowSlotGrid] = useState(false);
  const [selectedReservationDate, setSelectedReservationDate] = useState<string>('');
  const [deleteReservation, setDeleteReservation] = useState<Reservation | null>(null);
  const { reservations, loading, error } = useReservations(selectedDate);

  const formatDateTime = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'HH:mm', { locale: ja });
  };

  const formatDateHeader = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return '今日';
    } else if (isTomorrow(date)) {
      return '明日';
    }
    return format(date, 'M月d日(E)', { locale: ja });
  };

  const groupReservationsByDate = (reservationList: Reservation[]) => {
    const grouped = new Map<string, Reservation[]>();
    
    reservationList.forEach(reservation => {
      const dateKey = format(parseISO(reservation.startTime), 'yyyy-MM-dd');
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
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const handleReservationSuccess = () => {
    setShowReservationForm(false);
    window.location.reload();
  };

  const handleDeleteSuccess = () => {
    setDeleteReservation(null);
    window.location.reload();
  };

  const handleSlotClick = (date: string) => {
    setSelectedReservationDate(date);
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
              setSelectedReservationDate(selectedDate || today);
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
                reservations={reservations.filter(r => 
                  format(parseISO(r.startTime), 'yyyy-MM-dd') === date
                )}
                onSlotClick={handleSlotClick}
              />
            </div>
          ))}
        </div>
      )}
      
      {showReservationForm && (
        <ReservationForm 
          date={selectedReservationDate}
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