// src/context/CartContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem("cart_items");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("cart_items", JSON.stringify(items));
  }, [items]);

  const add = (item) => {
    // item: { id, name, price, vendorId }
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: (next[idx].qty || 1) + 1 };
        return next;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const setQty = (id, qty) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Number(qty) || 1) } : x)));
  };

  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id));
  const clear = () => setItems([]);

  const vendorId = useMemo(() => (items[0]?.vendorId ?? null), [items]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s, it) => s + Number(it.qty || 1), 0), [items]);

  const value = { items, add, setQty, remove, clear, vendorId, subtotal, totalQty };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);