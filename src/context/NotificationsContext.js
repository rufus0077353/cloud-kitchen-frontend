
// src/context/NotificationsContext.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../utils/socket";

const LS_KEY = "servezy.notifications.v1";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const save = (arr) => {
    setItems(arr);
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
  };

  const add = useCallback((notif) => {
    const n = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: notif.title || "Notification",
      body: notif.body || "",
      href: notif.href || "",
      tag: notif.tag || "",
      createdAt: new Date().toISOString(),
      read: false,
      kind: notif.kind || "info", // info | success | warning | error
    };
    save([n, ...items].slice(0, 200)); // cap
  }, [items]);

  const markAllRead = useCallback(() => {
    save(items.map(n => ({ ...n, read: true })));
  }, [items]);

  const clearAll = useCallback(() => {
    save([]);
  }, []);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  // Wire socket events -> notifications (users + vendors)
  useEffect(() => {
    const onOrderNew = (order) => {
      add({
        title: `New order #${order?.id ?? ""}`,
        body: order?.Vendor?.name ? `From ${order.Vendor.name}` : "Order placed",
        href: "/orders", // users; vendors see vendor page anyway
        tag: `order-${order?.id ?? ""}`,
        kind: "info",
      });
    };
    const onOrderStatus = (p) => {
      add({
        title: `Order #${p?.id ?? ""} updated`,
        body: `Status: ${p?.status}`,
        href: "/orders",
        tag: `order-${p?.id ?? ""}`,
        kind: p?.status === "delivered" ? "success" : (p?.status === "rejected" ? "error" : "info"),
      });
    };
    const onPayProcessing = (p) => add({ title: "Payment", body: "Processing…", href: "/orders", kind: "info" });
    const onPaySuccess = (p) => add({ title: "Payment", body: "Payment successful ✅", href: "/orders", kind: "success" });
    const onPayFailed = (p) => add({ title: "Payment", body: "Payment failed", href: "/orders", kind: "error" });

    socket.on("order:new", onOrderNew);
    socket.on("order:status", onOrderStatus);
    socket.on("payment:processing", onPayProcessing);
    socket.on("payment:success", onPaySuccess);
    socket.on("payment:failed", onPayFailed);

    return () => {
      socket.off("order:new", onOrderNew);
      socket.off("order:status", onOrderStatus);
      socket.off("payment:processing", onPayProcessing);
      socket.off("payment:success", onPaySuccess);
      socket.off("payment:failed", onPayFailed);
    };
  }, [add]);

  const value = useMemo(() => ({
    items, unreadCount, add, markAllRead, clearAll
  }), [items, unreadCount, add, markAllRead, clearAll]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}