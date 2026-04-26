import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

let _singleton = null;

function getSocket() {
  if (_singleton) return _singleton;
  const url = import.meta.env.VITE_SOCKET_URL || undefined; // same-origin in prod
  _singleton = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  return _singleton;
}

export default function useSocket() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConn = () => setConnected(true);
    const onDis = () => setConnected(false);
    socket.on("connect", onConn);
    socket.on("disconnect", onDis);
    return () => {
      socket.off("connect", onConn);
      socket.off("disconnect", onDis);
    };
  }, [socket]);

  const on = useCallback(
    (event, handler) => {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socket]
  );

  const emit = useCallback(
    (event, payload) => socket.emit(event, payload || {}),
    [socket]
  );

  return { socket, connected, on, emit };
}
