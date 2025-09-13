// src/utils/api.js
import axios from "axios";
import { toast } from "react-toastify";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
  withCredentials: false,
  timeout: 15000, // 15s timeout safeguard
});

// Attach token on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
let showing401 = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !showing401) {
      showing401 = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      toast.error("Session expired. Please log in again.");
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
      setTimeout(() => (showing401 = false), 2000);
    }
    return Promise.reject(err);
  }
);

export default api;