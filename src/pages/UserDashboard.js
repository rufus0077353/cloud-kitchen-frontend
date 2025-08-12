
// src/pages/UserDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import {
  Container,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
  Box,
  AppBar,
  Toolbar,
} from "@mui/material";
import { socket } from "../utils/socket";
import { subscribePush } from "../utils/push"; // ok to keep even if you don't use push yet

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const UserDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([{ MenuItemId: "", quantity: 1 }]);
  const [totalAmount, setTotalAmount] = useState(0);

  const token = localStorage.getItem("token");
  const user = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
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
        return;
      }
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : data?.vendors || []);
    } catch (e) {
      console.error("vendors error:", e);
      setVendors([]);
    }
  };

  const fetchMenuItemsForVendor = async (vId) => {
    if (!vId) return;
    try {
      const res = await fetch(`${API_BASE}/api/menu-items?vendorId=${vId}`);
      if (!res.ok) {
        const data = await safeJson(res);
        console.error("menu-items failed:", res.status, data);
        setMenuItems([]);
        return;
      }
      const data = await res.json();
      const arr = Array.isArray(data)
        ? data
        : data?.items || data?.menu || data?.menuItems || [];
      setMenuItems(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("menu-items error:", e);
      setMenuItems([]);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchVendors();
    // optional web‑push subscription (safe no-op if you haven't wired push yet)
    try { subscribePush?.(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- SOCKET: join user room + live updates ----------
  useEffect(() => {
    if (!user?.id) return;

    const join = () => socket.emit("user:join", user.id);
    join(); // initial join

    const onNew = (fullOrder) => {
      if (Number(fullOrder?.UserId) !== Number(user.id)) return;
      setOrders((prev) => {
        const exists = (prev || []).some((o) => o.id === fullOrder.id);
        if (exists) {
          return (prev || []).map((o) =>
            o.id === fullOrder.id ? { ...o, ...fullOrder } : o
          );
        }
        return [fullOrder, ...(prev || [])];
      });
      toast.info(`New order #${fullOrder?.id ?? ""} placed`);
    };

    const onStatus = (payload) => {
      if (Number(payload?.UserId) !== Number(user.id)) return;
      setOrders((prev) =>
        (prev || []).map((o) =>
          o.id === payload.id ? { ...o, status: payload.status } : o
        )
      );
      toast.success(`Order #${payload?.id ?? ""} is now ${payload?.status}`);
    };

    const onReconnect = () => join();

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("connect", onReconnect);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
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
      const menuItem = list.find((mi) => mi.id === parseInt(item.MenuItemId));
      if (menuItem) total += Number(menuItem.price) * Number(item.quantity || 0);
    });
    setTotalAmount(total);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { MenuItemId: "", quantity: 1 }]);
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("Please log in");
      return;
    }
    if (!vendorId) {
      toast.error("Select a vendor first");
      return;
    }

    const payload = {
      UserId: user.id,
      VendorId: parseInt(vendorId),
      totalAmount,
      items: items
        .filter((it) => it.MenuItemId && Number(it.quantity) > 0)
        .map((it) => ({
          MenuItemId: parseInt(it.MenuItemId),
          quantity: parseInt(it.quantity),
        })),
    };

    if (payload.items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await safeJson(res);
        toast.error(data?.message || "Failed to create order");
        return;
      }

      // Refresh to keep totals consistent
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
        setOrders((prev) =>
          Array.isArray(prev) ? prev.filter((o) => o.id !== orderId) : []
        );
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
        <Typography variant="h5" gutterBottom>
          Place New Order
        </Typography>

        <TextField
          select
          label="Select Vendor"
          fullWidth
          value={vendorId}
          onChange={handleVendorChange}
          margin="normal"
        >
          {(Array.isArray(vendors) ? vendors : []).map((v) => (
            <MenuItem key={v.id} value={v.id}>
              {v.name} {v.cuisine ? `- ${v.cuisine}` : ""}
            </MenuItem>
          ))}
        </TextField>

        {items.map((item, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mt={2}>
            <TextField
              select
              label="Menu Item"
              value={item.MenuItemId}
              onChange={(e) =>
                handleItemChange(index, "MenuItemId", e.target.value)
              }
              style={{ flex: 1 }}
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
              onChange={(e) =>
                handleItemChange(index, "quantity", e.target.value)
              }
              style={{ width: 110 }}
              inputProps={{ min: 0 }}
            />
          </Box>
        ))}

        <Box mt={2}>
          <Button variant="outlined" onClick={addItem}>
            Add Another Item
          </Button>
        </Box>

        <Box mt={2}>
          <Typography>Total: ₹{totalAmount.toFixed(2)}</Typography>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Submit Order
          </Button>
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
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString()
                    : "-"}
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