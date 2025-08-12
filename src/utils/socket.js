
// src/utils/socket.js
import { io } from "socket.io-client";

const BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

if (!BASE) {
  console.warn("[socket] No REACT_APP_SOCKET_URL / REACT_APP_API_BASE_URL set");
}

export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 6000,
  timeout: 20000,
  autoConnect: true,
});

// Attach/update auth and (optionally) notify server
export function refreshSocketAuth(token) {
  try {
    socket.auth = { token: token || null };
    if (socket.connected) {
      socket.emit("auth:refresh", { token: token || null });
    } else {
      socket.connect();
    }
  } catch (e) {
    console.warn("[socket] refreshSocketAuth failed:", e?.message);
  }
}

// Debug logs
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));