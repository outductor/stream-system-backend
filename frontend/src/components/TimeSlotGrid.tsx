import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { reservationsApi } from '../api/client';
import type { TimeSlot, Reservation } from '../types/api';

interface TimeSlotGridProps {
  date: string;
  reservations: Reservation[];
  onSlotClick: () => void;
}

export function TimeSlotGrid({ date, reservations, onSlotClick }: TimeSlotGridProps) {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        // Create start time from the beginning of the specified date
        const plainDate = Temporal.PlainDate.from(date);
        const startOfDate = plainDate.toPlainDateTime({ hour: 0, minute: 0 });
        const startTime = startOfDate.toZonedDateTime('Asia/Tokyo').toInstant();
        
        // Create end time for the end of the specified date
        const endOfDate = plainDate.toPlainDateTime({ hour: 23, minute: 59, second: 59, millisecond: 999 });
        const endTime = endOfDate.toZonedDateTime('Asia/Tokyo').toInstant();

        const slots = await reservationsApi.getAvailableSlots(startTime, endTime);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [date, reservations]);

  const findReservationForSlot =
    (slot: TimeSlot): Reservation | undefined =>
      reservations.find(r => r.startTime.equals(slot.startTime));

  const generateTimeSlots = () => {
    const slots: React.ReactElement[] = [];
    const now = Temporal.Now.instant();
    const plainDate = Temporal.PlainDate.from(date);

    for (let hour = 0; hour < 24; hour++) {
      const hourSlots: React.ReactElement[] = [];
      
      for (const minute of [0, 15, 30, 45]) {
        const slotTime = plainDate.toPlainDateTime({ hour, minute });
        const slotInstant = slotTime.toZonedDateTime('Asia/Tokyo').toInstant();
        
        const slot = availableSlots.find(s => s.startTime.equals(slotInstant));
        const reservation = slot ? findReservationForSlot(slot) : undefined;
        const isPast = Temporal.Instant.compare(slotInstant, now) <= 0;
        const isAvailable = slot?.available && !isPast;

        hourSlots.push(
          <div
            key={`${hour}-${minute}`}
            className={`time-slot ${isAvailable ? 'available' : ''} ${reservation ? 'reserved' : ''} ${isPast ? 'past' : ''}`}
            onClick={() => isAvailable && onSlotClick()}
          >
            <div className="slot-time">{hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')}</div>
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