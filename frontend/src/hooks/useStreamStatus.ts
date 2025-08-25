import { useState, useEffect } from 'react';
import { streamApi } from '../api/client';
import type { StreamStatus } from '../types/api';

export function useStreamStatus(refreshInterval = 10000) {
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await streamApi.getStatus();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch stream status'));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { status, loading, error };
}