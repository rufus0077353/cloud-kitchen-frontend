import axios from "axios";
import { toast } from "react-toastify";

// Normalize base URL and always append /api
const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const BASE = ROOT ? `${ROOT}/api` : "/api";

const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
});

// Attach token on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      toast.error("Session expired. Please log in again.");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
