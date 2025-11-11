// src/api/devEmail.js
const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

export async function sendDevEmail({ to, subject, message }) {
  const res = await fetch(`${API_BASE}/api/dev-email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // no Authorization
    body: JSON.stringify({ to, subject, message }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  if (data?.result?.skipped) {
    throw new Error(`Skipped: ${data.result.reason}. Add ${to} to WHITELIST_EMAILS on backend.`);
  }
  return data;
}