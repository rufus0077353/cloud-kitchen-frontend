
// src/utils/socket.js
import { io } from "socket.io-client";

// Prefer explicit socket URL, otherwise fall back to the API base
const BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  window.location.origin;

// Small helper so trailing slashes don’t break path resolution
const trim = (s = "") => s.replace(/\/+$/, "");

// Singleton socket instance
let socket = null;

/**
 * Create (or return) a connected Socket.IO client.
 * It will send the JWT in `auth` so your backend can authorize the connection.
 */
export function connectSocket(token) {
  const authToken = token || localStorage.getItem("token") || "";

  if (socket && socket.connected) return socket;

  // If an old instance exists, clean it up before creating a new one
  if (socket) {
    try { socket.disconnect(); } catch (_) {}
    socket = null;
  }

  socket = io(trim(BASE), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: authToken ? { token: authToken } : {},
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  // Optional logging (harmless in production)
  socket.on("connect", () => console.log("[socket] connected:", socket.id));
  socket.on("disconnect", (reason) => console.log("[socket] disconnected:", reason));
  socket.on("connect_error", (err) => console.warn("[socket] connect_error:", err?.message || err));

  return socket;
}

/**
 * Update the JWT used by the socket and reconnect.
 * Call this right after login/logout or token refresh.
 */
export function refreshSocketAuth(newToken) {
  const token = newToken || localStorage.getItem("token") || "";

  if (!socket) {
    // No instance yet — just create one with the token
    return connectSocket(token);
  }

  // Update auth payload and reconnect
  socket.auth = token ? { token } : {};
  try { socket.disconnect(); } catch (_) {}
  socket.connect();
  return socket;
}

/** Expose the instance for components already importing { socket } */
export { socket };
export default socket;