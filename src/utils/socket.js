
// src/utils/socket.js
import { io } from "socket.io-client";

// Prefer a dedicated SOCKET URL; fall back to API base if not set
const BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

if (!BASE) {
  // You can still import this module safely in dev; it just logs
  // (the rest of the app should continue to work via HTTP)
  // eslint-disable-next-line no-console
  console.warn("[socket] No REACT_APP_SOCKET_URL / REACT_APP_API_BASE_URL set");
}

// Create a single shared connection for the whole app
export const socket = io(BASE, {
  path: "/socket.io",            // default, but explicit helps on proxies/CDNs
  transports: ["websocket", "polling"], // websocket first; polling as fallback
  withCredentials: true,         // so CORS with credentials works
  reconnection: true,
  reconnectionAttempts: 10,      // try 10 times before giving up
  reconnectionDelay: 1500,       // 1.5s -> 3s -> 4.5s ...
  reconnectionDelayMax: 6000,
  timeout: 20000,                // connect timeout 20s
  autoConnect: true,
});

// Optional: small helpers you can use in pages
export function waitForConnect() {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const onConnect = () => {
      cleanup(); resolve();
    };
    const onError = (err) => {
      cleanup(); reject(err);
    };
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      socket.off("error", onError);
    };
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.on("error", onError);
  });
}

// (Optional) debug logs – comment out in prod if noisy
socket.on("connect",    () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected attempt:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));