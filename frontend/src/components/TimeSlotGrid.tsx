import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { reservationsApi } from '../api/client';
import { useEventTimezone } from '../hooks/useEventTimezone';
import type { TimeSlot, Reservation } from '../types/api';

interface TimeSlotGridProps {
  date: Temporal.PlainDate;
  now: Temporal.Instant;
  reservations: Reservation[];
  onSlotClick: (dateTime: Temporal.Instant) => void;
}

export function TimeSlotGrid({ date, now, reservations, onSlotClick }: TimeSlotGridProps) {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const timezone = useEventTimezone();

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        // Create start time from the beginning of the specified date
        const startOfDate = date.toPlainDateTime({ hour: 0, minute: 0 });
        const startTime = startOfDate.toZonedDateTime(timezone).toInstant();

        // Create end time for the end of the specified date
        const endOfDate = date.toPlainDateTime({ hour: 23, minute: 59, second: 59, millisecond: 999 });
        const endTime = endOfDate.toZonedDateTime(timezone).toInstant();

        const slots = await reservationsApi.getAvailableSlots(startTime, endTime);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [date, reservations, timezone]);

  const findReservationForSlot =
    (slotInstant: Temporal.Instant): Reservation | undefined =>
      reservations.find(r =>
        Temporal.Instant.compare(slotInstant, r.startTime) >= 0 &&
        Temporal.Instant.compare(slotInstant, r.endTime) < 0
      );

  const generateTimeSlots = () => {
    const slots: React.ReactElement[] = [];
    const plainDate = Temporal.PlainDate.from(date);

    for (let hour = 0; hour < 24; hour++) {
      const hourSlots: React.ReactElement[] = [];
      
      for (const minute of [0, 15, 30, 45]) {
        const slotTime = plainDate.toPlainDateTime({ hour, minute });
        const slotInstant = slotTime.toZonedDateTime(timezone).toInstant();
        
        const slot = availableSlots.find(s => s.startTime.equals(slotInstant));
        const reservation = findReservationForSlot(slotInstant);
        const reservationIsPast = reservation
          ? Temporal.Instant.compare(reservation.endTime, now) <= 0
          : false;
        const isPast = reservationIsPast || (!reservation && Temporal.Instant.compare(slotInstant, now) <= 0);
        const isCurrent = reservation
          ? Temporal.Instant.compare(reservation.startTime, now) <= 0 &&
            Temporal.Instant.compare(now, reservation.endTime) < 0
          : false;
        const isCurrentTimeSlot = isCurrent &&
          Temporal.Instant.compare(slotInstant, now) <= 0 &&
          Temporal.Instant.compare(now, slotInstant.add({ minutes: 15 })) < 0;
        const isAvailable = slot?.available && !isPast;

        const previousReservation = hour === 0 && minute === 0
          ? undefined
          : findReservationForSlot(slotInstant.subtract({ minutes: 15 }));
        const nextReservation = hour === 23 && minute === 45
          ? undefined
          : findReservationForSlot(slotInstant.add({ minutes: 15 }));
        const continuesFromPrevious = Boolean(
          reservation && previousReservation && reservation.id === previousReservation.id
        );
        const continuesToNext = Boolean(
          reservation && nextReservation && reservation.id === nextReservation.id
        );

        const slotClasses = [
          'time-slot',
          isAvailable ? 'available' : '',
          reservation ? 'reserved' : '',
          isPast ? 'past' : '',
          isCurrent ? 'current' : '',
          isCurrentTimeSlot ? 'current-position' : '',
          continuesFromPrevious ? 'reservation-continuation' : '',
          continuesToNext ? 'reservation-continues' : '',
          continuesFromPrevious && minute === 30 ? 'reservation-mobile-row-start' : '',
        ].filter(Boolean).join(' ');

        const currentProgress = isCurrentTimeSlot
          ? Math.min(
              100,
              Math.max(
                0,
                Number(now.epochNanoseconds - slotInstant.epochNanoseconds) / 9_000_000_000
              )
            )
          : undefined;

        hourSlots.push(
          <div
            key={`${hour}-${minute}`}
            className={slotClasses}
            style={currentProgress === undefined
              ? undefined
              : { '--current-position': `${currentProgress}%` } as React.CSSProperties}
            onClick={() => isAvailable && onSlotClick(slotInstant)}
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
        <span className="legend-item current">進行中</span>
        <span className="legend-item past">過去の時間</span>
      </div>
      <div className="slots-container">
        {generateTimeSlots()}
      </div>
    </div>
  );
}
