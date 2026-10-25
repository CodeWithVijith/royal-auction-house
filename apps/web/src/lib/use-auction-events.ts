'use client';
import { useEffect, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
export function useAuctionEvents(
  id: string,
  initialVersion: number,
  refresh: () => Promise<void>,
) {
  const [connected, setConnected] = useState(false);
  const version = useRef(initialVersion);
  useEffect(() => {
    let stopped = false,
      socket: Socket | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function connect() {
      try {
        const response = await fetch('/api/auctions/' + id + '/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!response.ok) throw new Error();
        const auth: { ticket: string; url: string } = await response.json();
        if (stopped) return;
        socket = io(auth.url, {
          transports: ['websocket'],
          auth: { ticket: auth.ticket },
          reconnection: false,
        });
        socket.on('connect', () => {
          setConnected(true);
          void refresh();
        });
        socket.on(
          'auction.changed',
          (event: { auctionId: string; version: number }) => {
            if (event.auctionId !== id || event.version <= version.current)
              return;
            version.current = event.version;
            void refresh();
          },
        );
        socket.on('auction.deleted', () => void refresh());
        const retry = () => {
          setConnected(false);
          if (!stopped) {
            timer = setTimeout(() => void connect(), 2500);
          }
        };
        socket.once('disconnect', retry);
        socket.once('connect_error', () => {
          socket?.close();
          retry();
        });
      } catch {
        if (!stopped) {
          setConnected(false);
          timer = setTimeout(() => void connect(), 4000);
        }
      }
    }
    void connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      socket?.removeAllListeners();
      socket?.close();
    };
  }, [id, refresh]);
  return connected;
}
