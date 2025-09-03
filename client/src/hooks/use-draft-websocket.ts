import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/endpoints";

type Callbacks = {
  onDraftState?(state: any): void;
  onTimerUpdate?(t: { display: number }): void;
};

export function useDraftWebSocket(
  draftId: string | null | undefined,
  userId: string | null | undefined,
  callbacks?: Callbacks
) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [reconnectTick, setReconnectTick] = useState(0);

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (msg?.type === "draft_state") callbacks?.onDraftState?.(msg.payload);
        else if (msg?.type === "timer_update") callbacks?.onTimerUpdate?.(msg.payload);
      } catch {
        // tolerate non-JSON like "connected"
      }
    },
    [callbacks]
  );

  useEffect(() => {
    if (!draftId || !userId) return;
    if (socketRef.current) return;

    const url = wsUrl("/draft-ws", { draftId, userId });
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      clearReconnect();
      console.log("[WS] Connected to draft:", draftId);
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      console.log("[WS] Connection error");
    };

    ws.onclose = (e) => {
      console.log("[WS] Connection closed:", e.code);
      socketRef.current = null;
      if (e.code !== 1000 && !reconnectTimerRef.current) {
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          setReconnectTick((t) => t + 1); // re-run effect to reconnect
        }, 1000);
      }
    };

    return () => {
      clearReconnect();
      try {
        ws.close(1000, "cleanup");
      } catch {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, userId, handleMessage, reconnectTick]);
}