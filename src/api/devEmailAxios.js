// src/api/devEmailAxios.js
import axios from 'axios';

const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, ''),
});

// Ensure auth interceptor does NOT add Authorization for this route
api.interceptors.request.use((config) => {
  if (config.url?.startsWith('/api/dev-email/')) {
    delete config.headers.Authorization;
  }
  return config;
});

export async function sendDevEmail({ to, subject, message }) {
  const { data } = await api.post('/api/dev-email/send', { to, subject, message });
  if (data?.result?.skipped) {
    throw new Error(`Skipped: ${data.result.reason}`);
  }
  return data;
}