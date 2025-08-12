/* ===== Servezy Service Worker (public/sw.js) =====
   Scope: root (must be in /public to control the whole app)
   Features: Push notifications, click handling, light lifecycle hooks
=================================================== */

// Make the newly installed SW take control ASAP
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Handle incoming Web Push
 * Expected payload (JSON):
 * {
 *   "title": "New order",
 *   "body": "Order #123 is pending",
 *   "url": "/vendor/orders",        // where to go on click (optional)
 *   "tag": "order-123",             // notification tag (optional)
 *   "icon": "/icon-192.png",        // custom icon path (optional)
 *   "badge": "/icon-192.png"        // custom badge path (optional)
 * }
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // Fallback: sometimes payload can be text
    try { data = JSON.parse(event.data.text()); } catch {}
  }

  const title = data.title || "Servezy";
  const options = {
    body: data.body || "You have a new update",
    // Use provided assets or fallbacks
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "servezy-notification",
    // Keep a reference so we can navigate when clicked
    data: {
      url: data.url || "/",   // relative or absolute
      ...data,
    },
    // Replaces notifications with the same tag instead of stacking
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Focus an existing tab or open a new one on click
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (() => {
    const raw = event.notification?.data?.url;
    if (!raw) return "/";
    try {
      // If raw is absolute, use as-is; if relative, resolve against SW origin
      return new URL(raw, self.location.origin).href;
    } catch {
      return "/";
    }
  })();

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    // If a tab is already open to our origin, try to reuse it
    for (const client of allClients) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin) {
        try {
          await client.focus();
          // If it's a different path, ask it to navigate
          if (client.url !== targetUrl && "navigate" in client) {
            await client.navigate(targetUrl);
          } else {
            // Or post a message so the page can handle routing itself
            client.postMessage({ type: "OPEN_URL", url: targetUrl });
          }
          return;
        } catch {}
      }
    }

    // Otherwise, open a new tab
    await self.clients.openWindow(targetUrl);
  })());
});

/**
 * Subscription rotated (rare). Ask open pages to re‑subscribe.
 * Your app can listen to navigator.serviceWorker.onmessage
 * and call subscribePush() again.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of pages) {
      c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGE" });
    }
  })());
});