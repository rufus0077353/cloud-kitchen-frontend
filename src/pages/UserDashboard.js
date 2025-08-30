
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import {
  Container, Typography, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, MenuItem, Box, AppBar, Toolbar,
  Chip, Stack, Tooltip
} from "@mui/material";
import { socket } from "../utils/socket";
import { subscribePush } from "../utils/push";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const UserDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorStatus, setVendorStatus] = useState({}); // id -> isOpen
  const [menuItems, setMenuItems] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([{ MenuItemId: "", quantity: 1 }]);
  const [totalAmount, setTotalAmount] = useState(0);

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const safeJson = async (res) => {
    try { return await res.json(); } catch { return null; }
  };

  // ---------- LOADERS ----------
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/my`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await safeJson(res);
        console.error("orders/my failed:", res.status, data);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data?.orders || []);
    } catch (e) {
      console.error("orders/my error:", e);
      setOrders([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vendors`);
      if (!res.ok) {
        const data = await safeJson(res);
        console.error("vendors failed:", res.status, data);
        setVendors([]);
        setVendorStatus({});
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setVendors(list);
      // build quick lookup map: id -> isOpen (default true if missing)
      const vs = {};
      for (const v of list) vs[Number(v.id)] = v.isOpen !== false; // treat undefined as true
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
      // only available items
      const res = await fetch(`${API_BASE}/api/vendors/${vId}/menu`);
      if (!res.ok) {
        const data = await safeJson(res);
        console.error("vendor menu failed:", res.status, data);
        setMenuItems([]);
        return;
      }
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
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

  // ---------- SOCKET ----------
  useEffect(() => {
    if (!user?.id) return;

    const join = () => socket.emit("user:join", user.id);
    join();

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
      // payload: { vendorId, isOpen }
      if (!payload?.vendorId) return;
      setVendorStatus((prev) => ({ ...prev, [Number(payload.vendorId)]: !!payload.isOpen }));
    };

    const onReconnect = () => join();

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("vendor:status", onVendorStatus);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("vendor:status", onVendorStatus);
      socket.off("connect", onReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- FORM HANDLERS ----------
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

  const calculateTotal = (orderItems) => {
    let total = 0;
    const list = Array.isArray(menuItems) ? menuItems : [];
    orderItems.forEach((item) => {
      const menuItem = list.find((mi) => mi.id === Number(item.MenuItemId));
      if (menuItem) total += Number(menuItem.price) * Number(item.quantity || 0);
    });
    setTotalAmount(total);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { MenuItemId: "", quantity: 1 }]);
  };

  // ---- Open/Closed helpers
  const isSelectedVendorOpen = vendorId ? Boolean(vendorStatus[Number(vendorId)]) : true;

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("Please log in");
      return;
    }
    if (!vendorId) {
      toast.error("Select a vendor first");
      return;
    }
    if (!isSelectedVendorOpen) {
      toast.error("This vendor is currently closed.");
      return;
    }

    const payload = {
      VendorId: Number(vendorId),
      items: items
        .filter((it) => it.MenuItemId !== "" && Number(it.quantity) > 0)
        .map((it) => ({
          MenuItemId: Number(it.MenuItemId),
          quantity: Number(it.quantity),
        })),
    };

    if (payload.items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    // helpful debug to see exactly what we send
    console.log("[create order] payload:", payload);

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
        const msg =
          data?.message ||
          (typeof data === "string" ? data : "") ||
          "Failed to create order";
        toast.error(msg);
        console.warn("[create order] server said:", data);
        return;
      }

      await fetchOrders();
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
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: "DELETE",
        headers,
      });
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

  const ordersSafe = Array.isArray(orders) ? orders : [];

  // convenience for button disable + tooltip
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
          <Typography variant="h5" gutterBottom>
            Place New Order
          </Typography>
          {selectedVendor && (
            <Chip
              label={isSelectedVendorOpen ? "Open" : "Closed"}
              color={isSelectedVendorOpen ? "success" : "default"}
              variant={isSelectedVendorOpen ? "filled" : "outlined"}
            />
          )}
        </Stack>

        <TextField
          select
          label="Select Vendor"
          fullWidth
          value={vendorId}
          onChange={handleVendorChange}
          margin="normal"
        >
          {(Array.isArray(vendors) ? vendors : []).map((v) => {
            const open = v.isOpen !== false; // default true
            return (
              <MenuItem key={v.id} value={v.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>
                    {v.name} {v.cuisine ? `- ${v.cuisine}` : ""}
                    {!open ? " (Closed)" : ""}
                  </span>
                  <Chip
                    size="small"
                    label={open ? "Open" : "Closed"}
                    color={open ? "success" : "default"}
                    variant={open ? "filled" : "outlined"}
                  />
                </Stack>
              </MenuItem>
            );
          })}
        </TextField>

        {items.map((item, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mt={2}>
            <TextField
              select
              label="Menu Item"
              value={item.MenuItemId}
              onChange={(e) => handleItemChange(index, "MenuItemId", e.target.value)}
              style={{ flex: 1 }}
              disabled={!isSelectedVendorOpen}
            >
              {(Array.isArray(menuItems) ? menuItems : []).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} - ₹{m.price}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="number"
              label="Quantity"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
              style={{ width: 110 }}
              inputProps={{ min: 0 }}
              disabled={!isSelectedVendorOpen}
            />
          </Box>
        ))}

        <Box mt={2} display="flex" alignItems="center" gap={2}>
          <Button variant="outlined" onClick={addItem} disabled={!isSelectedVendorOpen}>
            Add Another Item
          </Button>

          <Typography sx={{ ml: "auto" }}>Total: ₹{totalAmount.toFixed(2)}</Typography>
          <Tooltip
            title={
              !vendorId
                ? "Choose a vendor"
                : !isSelectedVendorOpen
                ? "This vendor is closed"
                : !hasValidItems
                ? "Add at least one item"
                : ""
            }
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={disableSubmit}
              >
                Submit Order
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box mt={5}>
        <Typography variant="h5" gutterBottom>
          Your Orders
        </Typography>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {ordersSafe.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.Vendor?.name || "-"}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>₹{order.totalAmount}</TableCell>
                <TableCell>
                  {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {ordersSafe.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No orders yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Container>
  );
};

export default UserDashboard;