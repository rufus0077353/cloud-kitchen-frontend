// src/utils/socket.js
import { io } from "socket.io-client";

/**
 * We accept either:
 * - REACT_APP_API_BASE_URL = https://api.example.com/api    (with /api)
 * - REACT_APP_API_BASE_URL = https://api.example.com         (without /api)
 * We normalize to the ORIGIN for sockets, and keep /socket.io path.
 */
function getApiBase() {
  const raw = process.env.REACT_APP_API_BASE_URL || "";
  if (!raw) return window.location.origin;     // fallback to same origin
  return raw.replace(/\/+$/, "");
}

const API_BASE = getApiBase();
// strip trailing /api for sockets -> https://api.example.com
const SOCKET_ORIGIN = API_BASE.replace(/\/api$/i, "");

export const socket = io(SOCKET_ORIGIN, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000,
  autoConnect: false,
});

export function connectSocket() {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  try { socket.disconnect(); } catch {}
}

// (Optional) helpful logs during debug
socket.on("connect_error", (e) => console.warn("socket connect_error:", e?.message || e));
socket.on("reconnect_error", (e) => console.warn("socket reconnect_error:", e?.message || e));
socket.on("connect", () => console.log("socket connected:", socket.id));
socket.on("disconnect", (r) => console.log("socket disconnected:", r));