// src/utils/socket.js
import { io } from "socket.io-client";

// IMPORTANT: set this in Netlify (Frontend) env vars
// REACT_APP_SOCKET_URL=https://your-backend.example.com
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_BASE_URL || // fallback to API base if you share the host
  window.location.origin;

const token = localStorage.getItem("token") || "";

export const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,          // start at 0.5s
  reconnectionDelayMax: 10_000,    // cap at 10s
  timeout: 20_000,
  auth: { token },                 // your backend can read from socket.handshake.auth.token
});

// keep auth fresh if user logs in/out without reload
export function refreshSocketAuth() {
  socket.auth = { token: localStorage.getItem("token") || "" };
  // if you want to actively re-connect after auth change:
  if (!socket.connected) socket.connect();
}