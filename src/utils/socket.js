import { io } from "socket.io-client";

// Prefer a dedicated SOCKET URL if your API is on Render & your site is on Netlify.
// Fallback to API base URL (Socket.IO server is attached to the same backend).
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE_URL || "";

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ["websocket"], // prefer WS
});