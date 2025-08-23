import { useState, useEffect } from 'react';
import { Temporal } from 'temporal-polyfill';

export function CurrentTime() {
  const [currentTime, setCurrentTime] = useState(Temporal.Now.zonedDateTimeISO('Asia/Tokyo'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Temporal.Now.zonedDateTimeISO('Asia/Tokyo'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (dateTime: Temporal.ZonedDateTime): string => {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateTime.dayOfWeek % 7];
    
    return `${dateTime.year}年${dateTime.month}月${dateTime.day}日(${weekday}) ${dateTime.hour.toString().padStart(2, '0')}:${dateTime.minute.toString().padStart(2, '0')}:${dateTime.second.toString().padStart(2, '0')}`;
  };

  return (
    <div className="current-time">
      <span className="time-label">現在時刻:</span>
      <span className="time-value">
        {formatDateTime(currentTime)}
      </span>
    </div>
  );
}