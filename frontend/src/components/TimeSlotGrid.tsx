import { useEffect, useState } from 'react';
import { format, setHours, setMinutes, parseISO, isAfter } from 'date-fns';
import { reservationsApi } from '../api/client';
import type { TimeSlot, Reservation } from '../types/api';

interface TimeSlotGridProps {
  date: string;
  reservations: Reservation[];
  onSlotClick: (date: string) => void;
}

export function TimeSlotGrid({ date, reservations, onSlotClick }: TimeSlotGridProps) {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const slots = await reservationsApi.getAvailableSlots(date);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [date, reservations]);

  const getReservationForSlot = (slot: TimeSlot): Reservation | undefined => {
    return reservations.find(r => {
      const resStart = parseISO(r.startTime);
      const slotStart = parseISO(slot.startTime);
      return resStart.getTime() === slotStart.getTime();
    });
  };

  const generateTimeSlots = () => {
    const slots: React.ReactElement[] = [];
    const now = new Date();

    for (let hour = 0; hour < 24; hour++) {
      const hourSlots: React.ReactElement[] = [];
      
      for (let minute of [0, 15, 30, 45]) {
        const slotTime = setMinutes(setHours(new Date(date), hour), minute);
        const timeString = format(slotTime, "yyyy-MM-dd'T'HH:mm:ss'Z'");
        
        const slot = availableSlots.find(s => s.startTime === timeString);
        const reservation = slot ? getReservationForSlot(slot) : undefined;
        const isPast = !isAfter(slotTime, now);
        const isAvailable = slot?.available && !isPast;

        hourSlots.push(
          <div
            key={`${hour}-${minute}`}
            className={`time-slot ${isAvailable ? 'available' : ''} ${reservation ? 'reserved' : ''} ${isPast ? 'past' : ''}`}
            onClick={() => isAvailable && onSlotClick(date)}
          >
            <div className="slot-time">{format(slotTime, 'HH:mm')}</div>
            {reservation && (
              <div className="slot-dj">{reservation.djName}</div>
            )}
          </div>
        );
      }

      slots.push(
        <div key={hour} className="hour-group">
          <div className="hour-label">{hour}時</div>
          <div className="hour-slots">{hourSlots}</div>
        </div>
      );
    }

    return slots;
  };

  if (loading) {
    return <div className="time-slots-loading">読み込み中...</div>;
  }

  return (
    <div className="time-slot-grid">
      <div className="grid-legend">
        <span className="legend-item available">予約可能</span>
        <span className="legend-item reserved">予約済み</span>
        <span className="legend-item past">過去の時間</span>
      </div>
      <div className="slots-container">
        {generateTimeSlots()}
      </div>
    </div>
  );
}