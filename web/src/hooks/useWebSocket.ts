/**
 * React Hook for WebSocket Connection
 * Handles connection lifecycle and event subscriptions
 */

import { useEffect, useCallback, useState } from 'react';
import { wsClient, WebSocketMessage, WebSocketEventHandler } from '@/lib/websocket';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect on mount
    wsClient.connect()
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
      });

    // Disconnect on unmount
    return () => {
      wsClient.disconnect();
      setIsConnected(false);
    };
  }, []);

  const subscribe = useCallback((eventType: string, handler: WebSocketEventHandler) => {
    wsClient.on(eventType, handler);
    return () => wsClient.off(eventType, handler);
  }, []);

  const subscribeToBatch = useCallback((sessionId: string) => {
    wsClient.subscribeToBatch(sessionId);
  }, []);

  const unsubscribeFromBatch = useCallback((sessionId: string) => {
    wsClient.unsubscribeFromBatch(sessionId);
  }, []);

  return {
    isConnected,
    subscribe,
    subscribeToBatch,
    unsubscribeFromBatch,
  };
}

/**
 * Hook for Batch Progress Updates
 */
export function useBatchProgress(sessionId: string | null) {
  const { subscribe, subscribeToBatch, unsubscribeFromBatch } = useWebSocket();
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to batch updates
    subscribeToBatch(sessionId);

    const handleProgress = (message: WebSocketMessage) => {
      if (message.sessionId === sessionId && message.type === 'batch_progress') {
        setProgress(message.data);
      }
    };

    const unsubscribe = subscribe('batch_progress', handleProgress);

    return () => {
      unsubscribe();
      unsubscribeFromBatch(sessionId);
    };
  }, [sessionId, subscribe, subscribeToBatch, unsubscribeFromBatch]);

  return progress;
}
