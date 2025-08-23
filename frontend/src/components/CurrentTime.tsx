import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export function CurrentTime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="current-time">
      <span className="time-label">現在時刻:</span>
      <span className="time-value">
        {format(currentTime, 'yyyy年M月d日(E) HH:mm:ss', { locale: ja })}
      </span>
    </div>
  );
}