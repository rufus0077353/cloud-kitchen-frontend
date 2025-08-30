
// src/pages/VendorDashboard.js
import React, { useEffect, useState } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Stack, Chip, Box, CircularProgress
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const STATUS_COLORS = {
  pending:   "default",
  accepted:  "primary",
  rejected:  "error",
  ready:     "warning",
  delivered: "success",
};

const VendorDashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", description: "" });
  const [vendorId, setVendorId] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ---- MENU ----
  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/mine`, { headers });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || `Failed (${res.status})`;
        toast.error(`Failed to load menu: ${msg}`);
        setMenuItems([]);
        return;
      }
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch menu failed:", err);
      toast.error("Failed to load menu");
      setMenuItems([]);
    }
  };

  // ---- RECENT ORDERS ----
  const fetchRecentOrders = async () => {
    if (!vendorId) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/${vendorId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const orders = Array.isArray(data) ? data : [];
      setRecentOrders(orders.slice(0, 5)); // only last 5
    } catch (e) {
      console.error("Recent orders fetch failed:", e);
    }
  };

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || "Failed to update";
        toast.error(msg);
        return;
      }
      toast.success("Status updated");
      fetchRecentOrders();
    } catch (e) {
      console.error("Status update error:", e);
      toast.error("Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  // ---- SOCKET ----
  useEffect(() => {
    const getMeAndJoin = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vendors/me`, { headers });
        if (!r.ok) return;
        const me = await r.json();
        if (me?.vendorId) {
          setVendorId(me.vendorId);
          socket.emit("vendor:join", me.vendorId);
        }
      } catch {}
    };
    getMeAndJoin();

    const onReconnect = () => {
      if (vendorId) socket.emit("vendor:join", vendorId);
    };

    const onNewOrder = (order) => {
      if (vendorId && Number(order?.VendorId) === Number(vendorId)) {
        toast.info(`🆕 New order #${order?.id ?? ""} received`);
        setRecentOrders((prev) => [order, ...prev].slice(0, 5));
      }
    };

    const onStatus = (payload) => {
      setRecentOrders((prev) =>
        prev.map((o) => (o.id === payload.id ? { ...o, status: payload.status } : o))
      );
    };

    socket.on("connect", onReconnect);
    socket.on("order:new", onNewOrder);
    socket.on("order:status", onStatus);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("order:new", onNewOrder);
      socket.off("order:status", onStatus);
    };
  }, [vendorId]);

  // ---- AUTH + LOGOUT ----
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logout successful");
    window.location.href = "/login";
  };

  // ---- FORM ----
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || user.role !== "vendor") {
      toast.error("Vendors only");
      return;
    }

    const method = editingItem ? "PUT" : "POST";
    const url = editingItem
      ? `${API_BASE}/api/menu-items/${editingItem.id}`
      : `${API_BASE}/api/menu-items`;

    const body = {
      name: form.name,
      price: form.price === "" ? null : parseFloat(form.price),
      description: form.description,
    };

    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to save item");
        return;
      }
      toast.success(editingItem ? "Item updated" : "Item added");
      setForm({ name: "", price: "", description: "" });
      setEditingItem(null);
      fetchMenu();
    } catch (err) {
      console.error("Menu item save error:", err);
      toast.error("Server error occurred");
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name ?? "",
      price: item.price ?? "",
      description: item.description ?? "",
    });
    setEditingItem(item);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success("Item deleted!");
        fetchMenu();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Server error");
    }
  };

  // ---- INIT ----
  useEffect(() => {
    fetchMenu();
  }, []);
  useEffect(() => { fetchRecentOrders(); }, [vendorId]);

  const rows = Array.isArray(menuItems) ? menuItems : [];

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Vendor Dashboard
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              color="inherit"
              component={Link}
              to="/vendor/orders"
              sx={{ textTransform: "none" }}
            >
              View Orders
            </Button>
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {/* MENU FORM */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6">
            {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField label="Name" name="name" value={form.name} onChange={handleChange} required fullWidth sx={{ mb: 2 }} />
            <TextField label="Price" name="price" type="number" value={form.price} onChange={handleChange} required fullWidth sx={{ mb: 2 }} />
            <TextField label="Description" name="description" value={form.description} onChange={handleChange} fullWidth sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" color="primary">
              {editingItem ? "Update" : "Add"}
            </Button>
          </form>
        </Paper>

        {/* MENU TABLE */}
        <Typography variant="h6" sx={{ mb: 2 }}>Your Menu</Typography>
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.price != null ? `₹${item.price}` : "-"}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(item)} color="primary"><Edit /></IconButton>
                    <IconButton onClick={() => handleDelete(item.id)} color="error"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">No items yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* RECENT ORDERS */}
        <Typography variant="h6" sx={{ mb: 2 }}>Recent Orders</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.id}</TableCell>
                  <TableCell>{o.User?.name || "-"}</TableCell>
                  <TableCell>
                    <Chip label={o.status} color={STATUS_COLORS[o.status] || "default"} size="small" />
                  </TableCell>
                  <TableCell>₹{o.totalAmount}</TableCell>
                  <TableCell>
                    {updatingId === o.id && <CircularProgress size={18} sx={{ mr: 1 }} />}
                    {o.status === "pending" && (
                      <>
                        <Button size="small" onClick={() => updateStatus(o.id, "accepted")}>Accept</Button>
                        <Button size="small" color="error" onClick={() => updateStatus(o.id, "rejected")}>Reject</Button>
                      </>
                    )}
                    {o.status === "accepted" && (
                      <Button size="small" onClick={() => updateStatus(o.id, "ready")}>Mark Ready</Button>
                    )}
                    {o.status === "ready" && (
                      <Button size="small" onClick={() => updateStatus(o.id, "delivered")}>Mark Delivered</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {recentOrders.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No orders yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </>
  );
};

export default VendorDashboard;