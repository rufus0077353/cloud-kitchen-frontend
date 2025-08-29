
import { io } from "socket.io-client";

function normalizeBase(u) {
  if (!u) return "";
  // remove trailing slash to avoid double '//' before /socket.io
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

const RAW_BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

const BASE = normalizeBase(RAW_BASE);

if (!BASE) {
  console.warn("[socket] No REACT_APP_SOCKET_URL / REACT_APP_API_BASE_URL set");
}

// Try to include current token immediately on first connect
const initialToken = (() => {
  try { return localStorage.getItem("token") || null; } catch { return null; }
})();

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
  auth: { token: initialToken },
});

/**
 * Update the auth payload used by Socket.IO and (optionally) inform the server.
 * Call this right after login/logout/refresh token.
 */
export function refreshSocketAuth(token) {
  try {
    socket.auth = { token: token || null };
    if (socket.connected) {
      // If your server listens for this, it can re-check auth without a reconnect.
      socket.emit("auth:refresh", { token: token || null });
    } else {
      socket.connect();
    }
  } catch (e) {
    console.warn("[socket] refreshSocketAuth failed:", e?.message);
  }
}

// --- Debug logs (safe to keep; remove in production if noisy)
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));