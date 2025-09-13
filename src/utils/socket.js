// src/utils/socket.js
import { io } from "socket.io-client";

function normalize(u) {
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

const RAW_BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

const BASE = normalize(RAW_BASE);

if (!BASE) {
  console.warn("[socket] No REACT_APP_SOCKET_URL / REACT_APP_API_BASE_URL set");
}

// capture token once; you can refresh later via refreshSocketAuth()
const initialToken = (() => {
  try {
    return localStorage.getItem("token") || null;
  } catch {
    return null;
  }
})();

/**
 * IMPORTANT:
 *  - Force real websocket (skips long-polling which often 503s behind proxies)
 *  - Path must match backend
 *  - withCredentials so Render CORS accepts it
 */
export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["websocket"],       // 🔸 force WS only
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 6000,
  timeout: 20000,
  autoConnect: true,
  auth: { token: initialToken },
});

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

// helpful logs
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));