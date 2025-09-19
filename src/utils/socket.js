// src/utils/socket.js
import { io } from "socket.io-client";

/**
 * We point the socket at the same origin as your API base.
 * If REACT_APP_API_BASE_URL is empty we fall back to window.location.origin
 * so it works in local dev and in production behind the same domain.
 */
const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const SOCKET_URL = API || window.location.origin;

/**
 * Send the JWT in the Socket.IO auth payload on every (re)connect.
 * Your server should read it from `socket.handshake.auth.token`
 * (or from `socket.handshake.query.token` if you prefer query).
 */
const buildAuth = () => {
  const token = localStorage.getItem("token");
  return token ? { token } : {};
};

export const socket = io(SOCKET_URL, {
  path: "/socket.io",                 // default on most servers
  transports: ["websocket", "polling"],
  withCredentials: false,             // CORS: we don’t need cookies
  autoConnect: false,                 // we call connect() after setting auth
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  auth: buildAuth(),                  // include token at first connect
});

// If token changes (login/logout), call this before socket.connect()
export const refreshSocketAuth = () => {
  socket.auth = buildAuth();
};

// helpful logs (optional)
socket.on("connect", () => console.debug("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.debug("[socket] disconnected:", r));
socket.on("connect_error", (err) => console.error("[socket] connect_error:", err?.message));