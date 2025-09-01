import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * CartContext
 * - Single-vendor cart (locks to the first vendor you add)
 * - Persists items + vendorId to localStorage
 * - API exposed to consumers:
 *   items, subtotal, totalQty, vendorId
 *   addItem(item, delta), setQty(id, qty), removeItem(id), clear()
 *   isOpen, openDrawer(), closeDrawer(), toggleDrawer()
 */

const LS_ITEMS = "cart_v1_items";
const LS_VENDOR = "cart_v1_vendor";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // items
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_ITEMS);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // vendor lock
  const [vendorId, setVendorId] = useState(() => {
    try {
      return localStorage.getItem(LS_VENDOR) || "";
    } catch {
      return "";
    }
  });

  // optional UI drawer state
  const [isOpen, setIsOpen] = useState(false);

  // persist
  useEffect(() => {
    try { localStorage.setItem(LS_ITEMS, JSON.stringify(items)); } catch {}
  }, [items]);
  useEffect(() => {
    try {
      if (vendorId) localStorage.setItem(LS_VENDOR, String(vendorId));
      else localStorage.removeItem(LS_VENDOR);
    } catch {}
  }, [vendorId]);

  // derived totals
  const { subtotal, totalQty } = useMemo(() => {
    let t = 0, q = 0;
    for (const it of items) {
      const p = Number(it.price || 0);
      const n = Number(it.qty || 0);
      t += p * n;
      q += n;
    }
    return { subtotal: t, totalQty: q };
  }, [items]);

  // core ops
  const addItem = (item, delta = 1) => {
    if (!item || !item.id) return;

    // enforce single-vendor cart (assumes item.vendorId exists)
    const incomingVendor = item.vendorId ?? vendorId ?? "";
    if (!vendorId && incomingVendor) {
      setVendorId(incomingVendor);
    } else if (vendorId && incomingVendor && String(incomingVendor) !== String(vendorId)) {
      // Different vendor item: reset cart to only this item
      setItems([{ ...item, qty: Math.max(1, Number(item.qty || delta || 1)) }]);
      setVendorId(incomingVendor);
      return;
    }

    setItems((prev) => {
      const idx = prev.findIndex((p) => String(p.id) === String(item.id));
      if (idx === -1) {
        const qty = Math.max(1, Number(item.qty || delta || 1));
        return [...prev, { ...item, qty }];
      }
      const next = [...prev];
      const nextQty = Math.max(0, Number(next[idx].qty || 0) + Number(delta || 1));
      if (nextQty <= 0) { next.splice(idx, 1); return next; }
      next[idx] = { ...next[idx], qty: nextQty };
      return next;
    });
  };

  const setQty = (id, qty) => {
    const q = Math.max(0, Number(qty || 0));
    setItems((prev) => {
      const idx = prev.findIndex((p) => String(p.id) === String(id));
      if (idx === -1) return prev;
      if (q === 0) { const next = [...prev]; next.splice(idx, 1); return next; }
      const next = [...prev];
      next[idx] = { ...next[idx], qty: q };
      return next;
    });
  };

  const removeItem = (id) => setItems((prev) => prev.filter((p) => String(p.id) !== String(id)));

  const clear = () => {
    setItems([]);
    setVendorId("");
  };

  // drawer helpers
  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);
  const toggleDrawer = () => setIsOpen((s) => !s);

  const value = {
    // data
    items,
    subtotal,
    totalQty,
    vendorId,

    // ops
    addItem,
    setQty,
    removeItem,
    // alias (for components that call remove())
    remove: removeItem,
    clear,

    // drawer
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}