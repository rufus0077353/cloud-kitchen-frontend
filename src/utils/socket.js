// src/utils/socket.js
import { io } from "socket.io-client";

// Prefer a dedicated SOCKET URL; fall back to API base if not set
const BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

if (!BASE) {
  // eslint-disable-next-line no-console
  console.warn("[socket] No REACT_APP_SOCKET_URL / REACT_APP_API_BASE_URL set");
}

// Single shared connection
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

/**
 * Named export required by other modules.
 * Safe to call with/without token. If connected, lets the server know;
 * if not, sets auth for the next handshake and connects.
 */
export function refreshSocketAuth(token) {
  try {
    socket.auth = { token: token || null };
    if (socket.connected) {
      socket.emit("auth:refresh", { token: token || null });
    } else {
      socket.connect();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[socket] refreshSocketAuth failed:", e?.message);
  }
}

// Optional debug logs (comment out if noisy)
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect", (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) =>
  console.log("[socket] connect_error:", e?.message)
);