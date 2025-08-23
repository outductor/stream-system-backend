import { useState, useEffect } from 'react';
import { reservationsApi } from '../api/client';
import type { Reservation } from '../types/api';

export function useReservations(date?: string, refreshInterval = 60000) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const data = await reservationsApi.getReservations(date);
        setReservations(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch reservations'));
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
    const interval = setInterval(fetchReservations, refreshInterval);

    return () => clearInterval(interval);
  }, [date, refreshInterval]);

  return { reservations, loading, error };
}