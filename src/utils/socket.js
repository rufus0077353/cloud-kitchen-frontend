
// src/utils/socket.js
import { io } from "socket.io-client";

/* ---------- base URL resolution ---------- */
function normalize(u) {
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

// Support Vite (VITE_*) and CRA (REACT_APP_*)
const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_SOCKET_URL) ||
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE) ||
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

// If not provided, try same-origin (useful in local dev with proxy)
const FALLBACK_BASE =
  typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";

const BASE = normalize(RAW_BASE || FALLBACK_BASE);

if (!BASE) {
  console.warn("[socket] No SOCKET URL set (VITE_SOCKET_URL / REACT_APP_SOCKET_URL / API_BASE).");
}

/* ---------- auth ---------- */
const initialToken = (() => {
  try {
    return localStorage.getItem("token") || null;
  } catch {
    return null;
  }
})();

/* ---------- socket ---------- */
/**
 * Key choices:
 * - transports: allow 'polling' on first connect so proxies can upgrade to WS cleanly
 * - rememberUpgrade: after 1st WS success, skip polling on subsequent connects
 * - path MUST match server (index.js uses '/socket.io')
 * - withCredentials to satisfy CORS
 */
export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  rememberUpgrade: true,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
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

/* ---------- helpers for rooms (optional but handy) ---------- */
export function joinVendorRoom(vendorId) {
  if (!vendorId) return;
  if (socket.connected) socket.emit("vendor:join", vendorId);
  else socket.once("connect", () => socket.emit("vendor:join", vendorId));
}
export function joinUserRoom(userId) {
  if (!userId) return;
  if (socket.connected) socket.emit("user:join", userId);
  else socket.once("connect", () => socket.emit("user:join", userId));
}

/* ---------- diagnostics ---------- */
console.log("[socket] base:", BASE);
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));