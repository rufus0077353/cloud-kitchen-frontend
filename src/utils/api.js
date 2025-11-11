
// src/api.js
import axios from "axios";
import { toast } from "react-toastify";

// Normalize base URL and always append /api
const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const BASE = ROOT ? `${ROOT}/api` : "/api";

// Simple token validator (non-empty and "jwt-like" a.b.c)
function getValidToken() {
  const raw = (localStorage.getItem("token") || "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  // Accept any non-empty by default; tighten if you want only JWTs:
  // if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(raw)) return "";
  return raw;
}

const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
  timeout: 15000, // 15s
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach (or remove) Authorization per request
api.interceptors.request.use((config) => {
  const token = getValidToken();

  // Ensure we don't leak a stale header
  if (!config.headers) config.headers = {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Explicitly remove if present
    delete config.headers.Authorization;
  }

  return config;
});

// Centralized 401 handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      // Clear local auth and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        toast.error("Session expired. Please log in again.");
        window.location.replace("/login");
      }
    }

    return Promise.reject(err);
  }
);

export default api;

/* Optional helpers (use if you like)
export const get = (url, cfg) => api.get(url, cfg).then(r => r.data);
export const post = (url, data, cfg) => api.post(url, data, cfg).then(r => r.data);
export const put = (url, data, cfg) => api.put(url, data, cfg).then(r => r.data);
export const del = (url, cfg) => api.delete(url, cfg).then(r => r.data);
*/