
// src/utils/api.js
import axios from "axios";
import { toast } from "react-toastify";

// Root from env (no trailing slash)
const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
// Our backend is always under /api
const BASE = ROOT ? `${ROOT}/api` : "/api";

// ---- helpers ----
function getValidToken() {
  const raw = (localStorage.getItem("token") || "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  // If you want to strictly validate JWT format, uncomment:
  // if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(raw)) return "";
  return raw;
}

/**
 * normalizeUrl:
 * - leaves absolute URLs (http/https) untouched
 * - ensures leading single slash
 * - strips a leading "/api" to avoid "/api/api/..." when baseURL already includes /api
 */
function normalizeUrl(u = "") {
  const s = String(u || "");
  if (/^https?:\/\//i.test(s)) return s; // absolute -> don't touch

  let path = s.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  // remove any duplicate leading slashes
  path = path.replace(/^\/+/, "/");

  // if caller passed "/api/..." but our baseURL already ends with "/api",
  // strip that first "/api" to avoid double "/api/api"
  if (path.startsWith("/api/")) path = path.slice(4); // remove leading "/api"
  if (!path.startsWith("/")) path = `/${path}`; // ensure leading slash after slice
  return path;
}

// ---- axios instance ----
const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// attach/remove Authorization on each request
api.interceptors.request.use((config) => {
  const token = getValidToken();
  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;

  // normalize only when using relative URLs (axios keeps absolute as-is)
  if (config.url && !/^https?:\/\//i.test(config.url)) {
    config.url = normalizeUrl(config.url);
  }
  return config;
});

// central 401 handling
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

// ---------- convenience wrappers ----------
export const getJSON  = (url, cfg)       => api.get(normalizeUrl(url), cfg).then(r => r.data);
export const postJSON = (url, data, cfg) => api.post(normalizeUrl(url), data, cfg).then(r => r.data);
export const putJSON  = (url, data, cfg) => api.put(normalizeUrl(url), data, cfg).then(r => r.data);
export const delJSON  = (url, cfg)       => api.delete(normalizeUrl(url), cfg).then(r => r.data);

export default api;