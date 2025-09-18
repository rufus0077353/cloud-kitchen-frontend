
// src/utils/socket.js
import { io } from "socket.io-client";

/* ---------- base URL ---------- */
function normalize(u) {
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_SOCKET_URL) ||
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE) ||
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "";

// Fallback to same-origin (useful when frontend is served by the API or local proxy)
const FALLBACK_BASE =
  typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";

const BASE = normalize(RAW_BASE || FALLBACK_BASE);
if (!BASE) console.warn("[socket] No SOCKET URL set. Using same-origin if available.");

// IMPORTANT: clear any previous rememberUpgrade cache that may force WS only
try { localStorage.removeItem("io"); } catch {}

/* ---------- socket ---------- */
/**
 * - Allow 'polling' so proxies can establish the connection, then upgrade to WS.
 * - DO NOT force websocket-only.
 * - Disable rememberUpgrade for now to avoid getting stuck trying WS on a flaky edge.
 * - Keep path exactly '/socket.io' to match the server.
 */
export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["polling", "websocket"], // start with polling then upgrade
  upgrade: true,
  rememberUpgrade: false,               // <- critical
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 6000,
  timeout: 20000,
  autoConnect: true,
  auth: {
    token: (() => {
      try { return localStorage.getItem("token") || null; } catch { return null; }
    })(),
  },
});

/* ---------- helpers ---------- */
export function refreshSocketAuth(token) {
  try {
    socket.auth = { token: token || null };
    if (socket.connected) socket.emit("auth:refresh", { token: token || null });
    else socket.connect();
  } catch (e) {
    console.warn("[socket] refreshSocketAuth failed:", e?.message);
  }
}

/* ---------- diagnostics ---------- */
console.log("[socket] base:", BASE);
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect",  (n) => console.log("[socket] reconnected:", n));
socket.on("reconnect_attempt", (n) => console.log("[socket] trying…", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));