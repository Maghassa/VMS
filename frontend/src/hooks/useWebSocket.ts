"use client";
import { useEffect, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";

type Handler = (data: unknown) => void;

export function useWebSocket(handlers: Record<string, Handler>) {
  const ws = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const socket = new WebSocket(`${WS_URL}?token=${token}`);
    ws.current = socket;

    socket.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        handlersRef.current[event]?.(data);
      } catch {}
    };

    socket.onclose = () => {
      setTimeout(() => {
        // Reconnect handled by re-mount or manual refresh
      }, 5000);
    };

    return () => socket.close();
  }, []);

  return ws;
}
