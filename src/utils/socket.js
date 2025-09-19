// src/utils/socket.js
import { io } from "socket.io-client";

// Use the same origin as your API
const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const SOCKET_URL = ROOT || window.location.origin;

// Singleton socket
export const socket = io(SOCKET_URL, {
  path: "/socket.io",            // ⬅ matches your server
  autoConnect: false,            // ⬅ don't connect before login
  transports: ["websocket", "polling"],
  withCredentials: false,
});

// Connect only when a token exists
export function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;            // not logged in yet
  socket.auth = { token };       // ⬅ server can read from handshake.auth
  if (!socket.connected) socket.connect();
}

// Cleanly disconnect
export function disconnectSocket() {
  try { socket.disconnect(); } catch {}
}

// Call when token changes (login / refresh / logout)
export function refreshSocketAuth() {
  const token = localStorage.getItem("token");
  socket.auth = token ? { token } : {};
  if (socket.connected) {
    // reconnect to send the new auth
    socket.disconnect();
    socket.connect();
  }
}

// Optional: basic logging (handy while debugging)
// socket.on("connect", () => console.log("🔌 socket connected", socket.id));
// socket.on("disconnect", (r) => console.log("🔌 socket disconnected:", r));
export default socket;