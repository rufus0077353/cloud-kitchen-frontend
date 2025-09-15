
// src/utils/socket.js
import { io } from "socket.io-client";

function normalize(u){ if(!u) return ""; return u.endsWith("/") ? u.slice(0,-1) : u; }

const RAW_BASE =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL || "";

const BASE = normalize(RAW_BASE);

export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["websocket"],       // force WS (skips long-polling issues)
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 6000,
  timeout: 20000,
  autoConnect: true,
  auth: { token: localStorage.getItem("token") || null },
});

export function refreshSocketAuth(token) {
  socket.auth = { token: token || null };
  if (socket.connected) {
    socket.emit("auth:refresh", { token: token || null });
  } else {
    socket.connect();
  }
}

// optional logs
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));
socket.on("reconnect", (n) => console.log("[socket] reconnected", n));
socket.on("connect_error", (e) => console.log("[socket] connect_error:", e?.message));