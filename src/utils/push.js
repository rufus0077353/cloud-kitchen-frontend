// src/utils/push.js
const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribePush({ as = "user" } = {}) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-failed" };

  // fetch VAPID public key from backend (expose via /api/push/public-key or inline .env build)
  const resKey = await fetch(`${API_BASE}/api/push/public-key`).catch(()=>null);
  if (!resKey || !resKey.ok) return { ok: false, reason: "no-key" };
  const { publicKey } = await resKey.json();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const token = localStorage.getItem("token");
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    },
    body: JSON.stringify({ subscription: sub, as }),
  });

  return { ok: true, sub };
}