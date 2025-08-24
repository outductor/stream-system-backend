import { useEffect, useState, useRef } from 'react';

export function useViewerCount() {
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const connect = () => {
      try {
        // Use wss:// for https:// and ws:// for http://
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/ws/viewer`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'viewer_count') {
              setViewerCount(data.count);
            } else if (data.type === 'ping') {
              // Send pong response
              ws.send(JSON.stringify({ type: 'pong' }));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = null;
          
          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { viewerCount, isConnected };
}