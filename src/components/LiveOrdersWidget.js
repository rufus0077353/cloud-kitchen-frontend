
// src/components/LiveOrdersWidget.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Paper, Stack, Typography, IconButton, Tooltip, Chip, Box, Button,
  CircularProgress, Divider, Badge, Collapse
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DoneIcon from "@mui/icons-material/Done";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MoneyIcon from "@mui/icons-material/AttachMoney";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { toast } from "react-toastify";
import { socket, connectSocket } from "../utils/socket";

const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const api = (p) => `${ROOT}${p}`;

const STATUS_COLORS = {
  pending: "default",
  accepted: "primary",
  ready: "warning",
  delivered: "success",
  rejected: "error",
};

const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function LiveOrdersWidget({
  limit = 10,             // how many recent orders to show
  pollMs = 30000,         // optional refresh interval (ms)
  enablePolling = true,   // polling fallback
}) {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [vendorId, setVendorId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // orderId while updating
  const [expanded, setExpanded] = useState(new Set());

  // ---- helpers ----
  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getLineItems = (order) => {
    if (Array.isArray(order?.OrderItems) && order.OrderItems.length) {
      return order.OrderItems.map((oi) => ({
        name: oi.MenuItem?.name || "Item",
        price: oi.MenuItem?.price ?? null,
        qty: oi.quantity ?? oi.OrderItem?.quantity ?? 1,
      }));
    }
    if (Array.isArray(order?.MenuItems) && order.MenuItems.length) {
      return order.MenuItems.map((mi) => ({
        name: mi.name,
        price: mi.price ?? null,
        qty: mi.OrderItem?.quantity ?? 1,
      }));
    }
    return [];
  };

  // ---- load vendor + recent orders ----
  const fetchVendorMe = async () => {
    try {
      const r = await fetch(api("/api/vendors/me"), { headers, credentials: "include" });
      const me = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(me?.message || `(${r.status})`);
      if (me?.vendorId) setVendorId(me.vendorId);
    } catch (e) {
      console.warn("LiveOrders: vendors/me failed", e?.message);
    }
  };

  const fetchOrders = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const q = new URLSearchParams({ page: "1", pageSize: String(limit) }).toString();
      const r = await fetch(api(`/api/orders/vendor?${q}`), { headers, credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(data?.message || `Failed to load orders (${r.status})`);
        setOrders([]);
        return;
      }
      const list = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      setOrders(list);
    } catch {
      toast.error("Network error while loading orders");
      setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ---- actions ----
  const patchStatus = async (id, status) => {
    setBusy(id);
    try {
      const r = await fetch(api(`/api/orders/${id}/status`), {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(out?.message || "Failed to update");
        return;
      }
      toast.success("Status updated");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (id) => {
    setBusy(id);
    try {
      const r = await fetch(api(`/api/orders/${id}/payment`), {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ status: "paid" }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(out?.message || "Failed to mark paid");
        return;
      }
      toast.success("Marked as paid");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, paymentStatus: "paid", paidAt: new Date().toISOString() } : o
        )
      );
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  const openInvoice = async (orderId) => {
    try {
      const url = api(`/api/orders/${orderId}/invoice`);
      const r = await fetch(url, { headers, credentials: "include" });
      if (!r.ok) {
        toast.error(`Invoice failed (${r.status})`);
        return;
      }
      const blob = await r.blob();
      const obj = URL.createObjectURL(blob);
      window.open(obj, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(obj), 60000);
    } catch {
      toast.error("Network error while opening invoice");
    }
  };

  // ---- socket + polling ----
  useEffect(() => {
    connectSocket();
    fetchVendorMe().then(fetchOrders);

    const onNew = (order) => {
      // scope to current vendor if possible
      if (vendorId && Number(order?.VendorId) !== Number(vendorId)) return;
      setOrders((prev) => {
        const next = [order, ...prev];
        return next.slice(0, limit);
      });
      toast.info(`🆕 New order #${order?.id ?? ""}`);
    };

    const onStatus = (payload) => {
      setOrders((prev) => prev.map((o) => (o.id === payload.id ? { ...o, status: payload.status } : o)));
    };

    const onPayment = (payload) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === (payload.orderId || payload.id)
            ? { ...o, paymentStatus: payload.paymentStatus, paidAt: payload.paidAt || o.paidAt }
            : o
        )
      );
    };

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("order:payment", onPayment);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("order:payment", onPayment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, limit]);

  useEffect(() => {
    if (!enablePolling) return;
    const id = setInterval(() => fetchOrders({ silent: true }), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enablePolling, pollMs]);

  // ---- render ----
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">Live Orders</Typography>
          <Badge
            color="secondary"
            badgeContent={(orders || []).filter((o) => o.status === "pending").length}
          >
            <Chip size="small" label="Pending" />
          </Badge>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => fetchOrders()} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={22} />
        </Box>
      ) : orders.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No recent orders.
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1}>
          {orders.map((o) => {
            const canMarkPaid =
              o.paymentMethod !== "mock_online" &&
              (o.paymentStatus || "").toLowerCase() !== "paid" &&
              !["rejected", "cancelled", "canceled"].includes((o.status || "").toLowerCase());

            const lines = getLineItems(o);
            const isOpen = expanded.has(o.id);

            return (
              <Box key={o.id} sx={{ py: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <IconButton size="small" onClick={() => toggleExpand(o.id)} aria-label="expand">
                    {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>

                  <Typography variant="subtitle2">#{o.id}</Typography>

                  <Chip
                    size="small"
                    label={(o.status || "-").toUpperCase()}
                    color={STATUS_COLORS[o.status] || "default"}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${o.paymentMethod === "mock_online" ? "Online" : "COD"} · ${o.paymentStatus || "unpaid"}`}
                  />

                  <Box sx={{ ml: "auto" }}>
                    <Typography variant="subtitle2">{inr(o.totalAmount)}</Typography>
                  </Box>
                </Stack>

                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 5, pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {o.User?.name || "-"} · {o.User?.email || ""}
                    </Typography>
                    <Typography variant="body2" sx={{ my: 0.5 }}>
                      {lines.length
                        ? lines.map((it) => `${it.name} x${it.qty}`).join(", ")
                        : "No items"}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                      {/* quick actions per status */}
                      {o.status === "pending" && (
                        <>
                          <Button
                            size="small"
                            startIcon={<DoneIcon />}
                            disabled={busy === o.id}
                            onClick={() => patchStatus(o.id, "accepted")}
                          >
                            Accept
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            disabled={busy === o.id}
                            onClick={() => patchStatus(o.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {o.status === "accepted" && (
                        <Button
                          size="small"
                          startIcon={<AssignmentTurnedInIcon />}
                          disabled={busy === o.id}
                          onClick={() => patchStatus(o.id, "ready")}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {o.status === "ready" && (
                        <Button
                          size="small"
                          startIcon={<LocalShippingIcon />}
                          disabled={busy === o.id}
                          onClick={() => patchStatus(o.id, "delivered")}
                        >
                          Mark Delivered
                        </Button>
                      )}

                      {canMarkPaid && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<MoneyIcon />}
                          disabled={busy === o.id}
                          onClick={() => markPaid(o.id)}
                        >
                          Mark Paid
                        </Button>
                      )}

                      <Button
                        size="small"
                        variant="text"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => openInvoice(o.id)}
                      >
                        Receipt
                      </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Placed: {o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
                      {o.paidAt ? ` · Paid: ${new Date(o.paidAt).toLocaleString()}` : ""}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}