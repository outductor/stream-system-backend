import { useState, useEffect } from "react";
import { streamApi } from "../api/client";
import type { StreamStatus } from "../types/api";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useStreamStatus(refreshInterval = 10000) {
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        let retryCount = 0;
        const maxRetries = 2;

        // we might get false negatives from backend so test a few times
        let data: StreamStatus;
        while (retryCount < maxRetries) {
          data = await streamApi.getStatus();
          if (data.isLive) break;
          retryCount++;
          await delay(300);
        }
        setStatus(data!); // loop has run at least once
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch stream status")
        );
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
