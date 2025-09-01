
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Minimal, production-safe cart context.
 * - Persists to localStorage
 * - Exposes addItem, removeItem, setQty, clear
 * - Derived totals (total, count)
 * - Optional drawer state (isOpen) you can use in a CartDrawer later
 */

const LS_KEY = "cart_v1";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // ---- state ----
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Optional UI state for a drawer component
  const [isOpen, setIsOpen] = useState(false);

  // ---- persistence ----
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  // ---- helpers ----
  const addItem = (item, delta = 1) => {
    if (!item || !item.id) return;
    setItems((prev) => {
      const idx = prev.findIndex((p) => String(p.id) === String(item.id));
      if (idx === -1) {
        const qty = Math.max(1, Number(item.qty || delta || 1));
        return [...prev, { ...item, qty }];
      }
      const next = [...prev];
      const nextQty = Math.max(0, Number(next[idx].qty || 0) + Number(delta || 1));
      if (nextQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...next[idx], qty: nextQty };
      return next;
    });
  };

  const setQty = (id, qty) => {
    const q = Math.max(0, Number(qty || 0));
    setItems((prev) => {
      const idx = prev.findIndex((p) => String(p.id) === String(id));
      if (idx === -1) return prev;
      if (q === 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], qty: q };
      return next;
    });
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((p) => String(p.id) !== String(id)));
  };

  const clear = () => setItems([]);

  // ---- derived totals ----
  const { total, count } = useMemo(() => {
    let t = 0;
    let c = 0;
    for (const it of items) {
      const price = Number(it.price || 0);
      const qty = Number(it.qty || 0);
      t += price * qty;
      c += qty;
    }
    return { total: t, count: c };
  }, [items]);

  // ---- drawer controls (optional) ----
  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);
  const toggleDrawer = () => setIsOpen((s) => !s);

  const value = {
    // data
    items,
    total,
    count,

    // cart ops
    addItem,
    setQty,
    removeItem,
    clear,

    // drawer state (useful if you have a CartDrawer)
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}