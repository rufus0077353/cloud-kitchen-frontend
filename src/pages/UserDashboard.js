
// src/pages/UserDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import {
  Container, Typography, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, MenuItem, Box, AppBar, Toolbar,
  Chip, Stack, Tooltip, CircularProgress
} from "@mui/material";
import { socket } from "../utils/socket";
import { subscribePush } from "../utils/push";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

export default function UserDashboard() {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorStatus, setVendorStatus] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([{ MenuItemId: "", quantity: 1 }]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("mock_online");

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ---------------- helpers ----------------
  const safeJson = async (res) => {
    try { return await res.json(); } catch { return null; }
  };

  const parseOrderList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.orders)) return data.orders;
    if (Array.isArray(data?.items))  return data.items;
    // sometimes single object:
    if (data && typeof data === "object" && (data.id || data.order?.id)) {
      return [data.order || data];
    }
    return [];
  };

  // ---------------- loaders ----------------
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/my`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await safeJson(res);
      if (!res.ok) {
        console.warn("orders/my failed:", res.status, data);
        return; // don't clear current list on transient failure
      }
      const list = parseOrderList(data);
      if (Array.isArray(list)) setOrders(list);
    } catch (e) {
      console.error("orders/my error:", e);
      // keep last good list
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vendors`);
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("vendors failed:", res.status, data);
        setVendors([]);
        setVendorStatus({});
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setVendors(list);
      const vs = {};
      for (const v of list) vs[Number(v.id)] = v.isOpen !== false; // default true
      setVendorStatus(vs);
    } catch (e) {
      console.error("vendors error:", e);
      setVendors([]);
      setVendorStatus({});
    }
  };

  const fetchMenuItemsForVendor = async (vId) => {
    if (!vId) return;
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${vId}/menu`);
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("vendor menu failed:", res.status, data);
        setMenuItems([]);
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setMenuItems(list);
      calculateTotal(items, list); // recompute with new prices
    } catch (e) {
      console.error("menu-items error:", e);
      setMenuItems([]);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchVendors();
    try { subscribePush?.(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- sockets ----------------
  useEffect(() => {
    if (!user?.id) return;

    const join = () => {
      try { socket.emit("user:join", user.id); } catch {}
    };

    join(); // initial
    const onConnect = () => { join(); fetchOrders(); };
    const onConnErr = (err) => console.warn("socket connect_error:", err?.message || err);

    const onNew = (fullOrder) => {
      if (Number(fullOrder?.UserId) !== Number(user.id)) return;
      setOrders((prev) => {
        const exists = (prev || []).some((o) => o.id === fullOrder.id);
        if (exists) return (prev || []).map((o) => (o.id === fullOrder.id ? { ...o, ...fullOrder } : o));
        return [fullOrder, ...(prev || [])];
      });
      toast.info(`New order #${fullOrder?.id ?? ""} placed`);
    };

    const onStatus = (payload) => {
      if (Number(payload?.UserId) !== Number(user.id)) return;
      setOrders((prev) => (prev || []).map((o) => (o.id === payload.id ? { ...o, status: payload.status } : o)));
      toast.success(`Order #${payload?.id ?? ""} is now ${payload?.status}`);
    };

    const onVendorStatus = (payload) => {
      if (!payload?.vendorId) return;
      setVendorStatus((prev) => ({ ...prev, [Number(payload.vendorId)]: !!payload.isOpen }));
    };

    // mock payment events from /routes/paymentRoutes.js
    const onPayProcessing = (p) => {
      if (!p?.id) return;
      setOrders((prev) => prev.map((o) => (o.id === p.id ? { ...o, paymentStatus: "processing" } : o)));
      toast.info(`Payment processing for order #${p.id}`);
    };
    const onPaySuccess = (p) => {
      if (!p?.id) return;
      setOrders((prev) => prev.map((o) => (o.id === p.id ? { ...o, paymentStatus: "paid" } : o)));
      toast.success(`Payment succeeded for order #${p.id}`);
    };
    const onPayFailed = (p) => {
      if (!p?.id) return;
      setOrders((prev) => prev.map((o) => (o.id === p.id ? { ...o, paymentStatus: "failed" } : o)));
      toast.error(`Payment failed for order #${p.id}`);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnErr);
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("vendor:status", onVendorStatus);
    socket.on("payment:processing", onPayProcessing);
    socket.on("payment:success", onPaySuccess);
    socket.on("payment:failed", onPayFailed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnErr);
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("vendor:status", onVendorStatus);
      socket.off("payment:processing", onPayProcessing);
      socket.off("payment:success", onPaySuccess);
      socket.off("payment:failed", onPayFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------------- form handlers ----------------
  const handleVendorChange = (e) => {
    const selectedId = e.target.value;
    setVendorId(selectedId);
    fetchMenuItemsForVendor(selectedId);
    setItems([{ MenuItemId: "", quantity: 1 }]);
    setTotalAmount(0);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
    calculateTotal(updated);
  };

  const calculateTotal = (orderItems, sourceMenuItems = menuItems) => {
    let total = 0;
    const list = Array.isArray(sourceMenuItems) ? sourceMenuItems : [];
    (orderItems || []).forEach((item) => {
      const menuItem = list.find((mi) => mi.id === Number(item.MenuItemId));
      if (menuItem) total += Number(menuItem.price) * Number(item.quantity || 0);
    });
    setTotalAmount(total);
  };

  const addItem = () => setItems((prev) => [...prev, { MenuItemId: "", quantity: 1 }]);

  const isSelectedVendorOpen = vendorId ? Boolean(vendorStatus[Number(vendorId)]) : true;

  const handleSubmit = async () => {
    if (!user?.id) { toast.error("Please log in"); return; }
    if (!vendorId) { toast.error("Select a vendor first"); return; }
    if (!isSelectedVendorOpen) { toast.error("This vendor is currently closed."); return; }

    const payload = {
      VendorId: Number(vendorId),
      paymentMethod,
      items: items
        .filter((it) => it.MenuItemId !== "" && Number(it.quantity) > 0)
        .map((it) => ({ MenuItemId: Number(it.MenuItemId), quantity: Number(it.quantity) })),
    };
    if (payload.items.length === 0) { toast.error("Add at least one item"); return; }

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res);
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = data?.message || (typeof data === "string" ? data : "") || "Failed to create order";
        toast.error(msg);
        return;
      }

      // Immediately append new order locally
      const created = data?.order || data;
      if (created && created.id) {
        setOrders((prev) => [created, ...(prev || [])]);
      } else if (created?.order?.id) {
        setOrders((prev) => [created.order, ...(prev || [])]);
      } else {
        // fallback
        await fetchOrders();
      }

      toast.success("Order created successfully!");
      setItems([{ MenuItemId: "", quantity: 1 }]);
      setTotalAmount(0);
    } catch (e) {
      console.error("create order error:", e);
      toast.error("Network error while creating order");
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`, { method: "DELETE", headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        setOrders((prev) => (Array.isArray(prev) ? prev.filter((o) => o.id !== orderId) : []));
      } else {
        const data = await safeJson(res);
        toast.error(data?.message || "Failed to delete");
      }
    } catch (e) {
      console.error("delete order error:", e);
      toast.error("Network error while deleting");
    }
  };

  // ---------------- invoice ----------------
  const openInvoice = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await res.text().catch(() => "")) || "Failed to load invoice";
        toast.error(msg);
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error("Network error while opening invoice");
    }
  };

  // ---------------- mock payments (NEW endpoints) ----------------
  const postJson = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
    });
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  };

  const startMockPayment = async (orderId) => {
    const { ok, data } = await postJson("/api/payments/mock/start", { orderId });
    if (!ok) { toast.error(data?.message || "Failed to start mock payment"); return; }
    toast.info("Payment started");
    // optimistic set
    setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, paymentStatus: "processing" } : o));
  };

  const succeedMockPayment = async (orderId) => {
    const { ok, data } = await postJson("/api/payments/mock/succeed", { orderId });
    if (!ok) { toast.error(data?.message || "Failed to mark success"); return; }
    toast.success("Payment marked as success");
    const updated = data?.order || null;
    setOrders((prev) =>
      prev.map(o => o.id === orderId ? { ...o, ...(updated || {}), paymentStatus: "paid" } : o)
    );
  };

  const failMockPayment = async (orderId) => {
    const { ok, data } = await postJson("/api/payments/mock/fail", { orderId });
    if (!ok) { toast.error(data?.message || "Failed to mark failure"); return; }
    toast.error("Payment marked as failed");
    setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, paymentStatus: "failed" } : o));
  };

  // ---------------- render ----------------
  const ordersSafe = Array.isArray(orders) ? orders : [];
  const hasValidItems = items.some((it) => it.MenuItemId && Number(it.quantity) > 0);
  const disableSubmit = !vendorId || !isSelectedVendorOpen || !hasValidItems;
  const selectedVendor = vendors.find(v => Number(v.id) === Number(vendorId));

  return (
    <Container>
      <AppBar position="static">
        <Toolbar>
          <Navbar role="user" />
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Welcome, {user?.name || "User"}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box mt={4}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" gutterBottom>Place New Order</Typography>
          {selectedVendor && (
            <Chip
              label={isSelectedVendorOpen ? "Open" : "Closed"}
              color={isSelectedVendorOpen ? "success" : "default"}
              variant={isSelectedVendorOpen ? "filled" : "outlined"}
            />
          )}
        </Stack>

        <TextField
          select label="Payment Method" fullWidth value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)} margin="normal"
        >
          <MenuItem value="mock_online">Mock Online Payment</MenuItem>
          <MenuItem value="cod">Cash on Delivery (COD)</MenuItem>
        </TextField>

        <TextField
          select label="Select Vendor" fullWidth value={vendorId}
          onChange={handleVendorChange} margin="normal"
        >
          {(Array.isArray(vendors) ? vendors : []).map((v) => {
            const open = v.isOpen !== false;
            return (
              <MenuItem key={v.id} value={v.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>
                    {v.name} {v.cuisine ? `- ${v.cuisine}` : ""}{!open ? " (Closed)" : ""}
                  </span>
                  <Chip size="small" label={open ? "Open" : "Closed"} color={open ? "success" : "default"} variant={open ? "filled" : "outlined"} />
                </Stack>
              </MenuItem>
            );
          })}
        </TextField>

        {items.map((item, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mt={2}>
            <TextField
              select label="Menu Item" value={item.MenuItemId}
              onChange={(e) => handleItemChange(index, "MenuItemId", e.target.value)}
              style={{ flex: 1 }} disabled={!isSelectedVendorOpen}
            >
              {(Array.isArray(menuItems) ? menuItems : []).map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name} - ₹{m.price}</MenuItem>
              ))}
            </TextField>

            <TextField
              type="number" label="Quantity" value={item.quantity}
              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
              style={{ width: 110 }} inputProps={{ min: 0 }} disabled={!isSelectedVendorOpen}
            />
          </Box>
        ))}

        <Box mt={2} display="flex" alignItems="center" gap={2}>
          <Button variant="outlined" onClick={() => addItem()} disabled={!isSelectedVendorOpen}>
            Add Another Item
          </Button>

          <Typography sx={{ ml: "auto" }}>Total: ₹{totalAmount.toFixed(2)}</Typography>
          <Tooltip
            title={
              !vendorId ? "Choose a vendor"
                : !isSelectedVendorOpen ? "This vendor is closed"
                : !hasValidItems ? "Add at least one item" : ""
            }
          >
            <span>
              <Button variant="contained" color="primary" onClick={handleSubmit} disabled={disableSubmit}>
                Submit Order
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box mt={5}>
        <Typography variant="h5" gutterBottom>Your Orders</Typography>

        {loadingOrders ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {ordersSafe.map((order) => {
                const payMethod = order.paymentMethod || "-";
                const payStatus = order.paymentStatus || "-";
                const isMock = payMethod === "mock_online";
                return (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.Vendor?.name || "-"}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={payMethod} variant="outlined" />
                        <Chip
                          size="small"
                          label={payStatus}
                          color={
                            payStatus === "paid" ? "success" :
                            payStatus === "processing" ? "warning" :
                            payStatus === "failed" ? "error" : "default"
                          }
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>₹{order.totalAmount}</TableCell>
                    <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" size="small" onClick={() => openInvoice(order.id)}>Receipt</Button>
                        <Button color="error" variant="outlined" size="small" onClick={() => deleteOrder(order.id)}>Delete</Button>

                        {/* mock payment controls – using /api/payments/mock/* */}
                        {isMock && (payStatus === "unpaid" || payStatus === "failed") && (
                          <Button variant="contained" onClick={() => startMockPayment(order.id)}>
                            {payStatus === "failed" ? "Retry Payment" : "Pay Now (Mock)"}
                          </Button>
                        )}
                        {isMock && payStatus === "processing" && (
                          <>
                            <Button variant="contained" color="success" onClick={() => succeedMockPayment(order.id)}>Succeed</Button>
                            <Button variant="outlined" color="error" onClick={() => failMockPayment(order.id)}>Fail</Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {ordersSafe.length === 0 && !loadingOrders && (
                <TableRow>
                  <TableCell colSpan={7} align="center">No orders yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Container>
  );
}