/* global self, registration */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "Servezy";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Example deep-link: open vendor or user orders page
  const url = data.vendorId
    ? "/vendor/orders"
    : data.orderId
      ? `/orders` // or detailed route if you have one
      : "/";
  event.waitUntil(clients.openWindow(url));
});