
// src/utils/api.js
import axios from "axios";
import { toast } from "react-toastify";

// Normalize base URL and always append /api
const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const BASE = ROOT ? `${ROOT}/api` : "/api";

// Simple token validator
function getValidToken() {
  const raw = (localStorage.getItem("token") || "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  // If you want to enforce JWT shape, uncomment:
  // if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(raw)) return "";
  return raw;
}

const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Attach (or remove) Authorization per request
api.interceptors.request.use((config) => {
  const token = getValidToken();
  if (!config.headers) config.headers = {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

// Centralized 401 handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
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

// ---------- Convenience helpers (named exports) ----------
export const getJSON  = (url, cfg)            => api.get(url, cfg).then(r => r.data);
export const postJSON = (url, data, cfg)      => api.post(url, data, cfg).then(r => r.data);
export const putJSON  = (url, data, cfg)      => api.put(url, data, cfg).then(r => r.data);
export const delJSON  = (url, cfg)            => api.delete(url, cfg).then(r => r.data);

// Default export for direct axios-style usage
export default api;