// src/utils/push.js
const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

/** Convert a base64 (URL-safe) VAPID key to Uint8Array */
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

/** Get VAPID key, preferring backend endpoint; fallback to FE env if provided */
async function getVapidPublicKey() {
  // Optional FE fallback (only if you really want it)
  const envKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  try {
    const res = await fetch(`${API_BASE}/api/push/public-key`);
    if (res.ok) {
      const { publicKey } = await res.json();
      if (publicKey) return publicKey;
    }
  } catch {}
  if (envKey) return envKey;
  throw new Error("VAPID public key not available");
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  // sw.js must be in /public (root scope)
  return navigator.serviceWorker.register("/sw.js");
}

/**
 * Subscribe to Web Push and send the subscription to backend
 * @param {{as: "user"|"vendor"}} param0
 */
export async function subscribePush({ as = "user" } = {}) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-failed" };

  let publicKey;
  try {
    publicKey = await getVapidPublicKey();
  } catch (e) {
    return { ok: false, reason: "no-key" };
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const token = localStorage.getItem("token") || "";
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription: sub, as }),
  });

  return { ok: true, sub };
}

/** Optional helper to unsubscribe */
export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});

  const token = localStorage.getItem("token") || "";
  await fetch(`${API_BASE}/api/push/unsubscribe`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint }),
  });

  return { ok: true };
}