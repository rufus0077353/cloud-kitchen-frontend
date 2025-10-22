
// src/utils/socket.js
import { io } from "socket.io-client";

// ---- Base URL ----------------------------------------------------
const RAW_BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  window.location.origin;

const BASE = (RAW_BASE || "").replace(/\/+$/, "");

// ---- Auth helper -------------------------------------------------
function authFromStorage() {
  const token = localStorage.getItem("token") || "";
  return token ? { token } : {};
}

// ---- Singleton socket (never null) -------------------------------
// Use polling first to avoid noisy "websocket closed before connect" logs.
export const socket = io(BASE || window.location.origin, {
  path: "/socket.io",
  transports: [ "websocket", "polling" ],
  withCredentials: false,
  autoConnect: false,            // we'll call connectSocket() ourselves
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  timeout: 10000,
  auth: authFromStorage(),
});

// Optional lightweight logs (helpful during dev)
if (process.env.NODE_ENV !== "production") {
  socket.on("connect", () => console.log("[socket] connected:", socket.id));
  socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
  socket.on("connect_error", (e) =>
    console.warn("[socket] connect_error:", e?.message || e)
  );
}

// Call this once on app start (e.g., in App) or right after login.
export function connectSocket() {
  if (socket.connected || socket.active) return socket;
  socket.auth = authFromStorage();
  socket.connect();
  return socket;
}

// Call this whenever the JWT changes (login/logout/refresh) or on Retry.
export function refreshSocketAuth(newToken) {
  const token = newToken ?? localStorage.getItem("token") ?? "";
  socket.auth = token ? { token } : {};
  try {
    if (socket.connected) socket.disconnect();
  } catch {}
  socket.connect();
  return socket;
}

export default socket;