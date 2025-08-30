// src/pages/VendorDashboard.js
import React, { useEffect, useState } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Stack, Chip, Grid, Box, Divider, Tooltip
} from "@mui/material";
import { Delete, Edit, Refresh } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const STATUS_COLORS = {
  pending:   "default",
  accepted:  "primary",
  ready:     "warning",
  delivered: "success",
  rejected:  "error",
};

const Money = ({ value }) => (
  <Typography variant="h5" fontWeight={700}>₹{Number(value || 0).toFixed(2)}</Typography>
);

const SummaryCard = ({ title, value, sub }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="body2" color="text.secondary">{title}</Typography>
    <Money value={value} />
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Paper>
);

const StatusChips = ({ byStatus = {} }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Orders by status</Typography>
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {Object.entries(byStatus).map(([k, v]) => (
        <Chip key={k} label={`${k}: ${v || 0}`} color={STATUS_COLORS[k] || "default"} />
      ))}
    </Stack>
  </Paper>
);

const VendorDashboard = () => {
  // ----- menu state -----
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", description: "" });

  // ----- summary state -----
  const [summary, setSummary] = useState(null);
  const [vendorId, setVendorId] = useState(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ---------- MENU LOAD ----------
  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/mine`, { headers: { Authorization: `Bearer ${token}` } });
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

  // ---------- SUMMARY LOAD ----------
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/summary`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || `Summary failed (${res.status})`;
        toast.error(msg);
        setSummary(null);
        return;
      }
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      toast.error("Network error while loading summary");
      setSummary(null);
    }
  };

  // ---- socket: join vendor room + notify on new orders ----
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
      if (Number(order?.VendorId) === Number(vendorId)) {
        toast.info(`🆕 New order #${order?.id ?? ""} received`);
        fetchSummary(); // keep cards fresh
      }
    };

    socket.on("connect", onReconnect);
    socket.on("order:new", onNewOrder);
    socket.on("order:status", fetchSummary);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("order:new", onNewOrder);
      socket.off("order:status", fetchSummary);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logout successful");
    window.location.href = "/login";
  };

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
      // VendorId is derived on backend from token
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to save item");
        return;
      }

      toast.success(editingItem ? "Item updated" : "Item added");
      setForm({ name: "", price: "", description: "" });
      setEditingItem(null);
      fetchMenu();
      fetchSummary(); // revenue may change with orders, but safe to refresh
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
      const res = await fetch(`${API_BASE}/api/menu-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Item deleted!");
        fetchMenu();
        fetchSummary();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Server error");
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = Array.isArray(menuItems) ? menuItems : [];
  const byStatus = summary?.byStatus || {};

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
        {/* ---- SUMMARY ROW ---- */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Summary</Typography>
            <Tooltip title="Refresh summary">
              <IconButton onClick={fetchSummary}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="Today" value={summary?.today?.revenue} sub={`${summary?.today?.orders || 0} orders`} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Week" value={summary?.week?.revenue} sub={`${summary?.week?.orders || 0} orders`} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Month" value={summary?.month?.revenue} sub={`${summary?.month?.orders || 0} orders`} />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <StatusChips byStatus={byStatus} />
            </Grid>
          </Grid>

          <Divider sx={{ mt: 2 }} />

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Lifetime: <strong>{summary?.totals?.orders || 0}</strong> orders ·{" "}
              <strong>₹{Number(summary?.totals?.revenue || 0).toFixed(2)}</strong>
            </Typography>
          </Box>
        </Paper>

        {/* ---- MENU FORM ---- */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6">
            {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Price"
              name="price"
              type="number"
              value={form.price}
              onChange={handleChange}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" color="primary">
              {editingItem ? "Update" : "Add"}
            </Button>
          </form>
        </Paper>

        {/* ---- MENU TABLE ---- */}
        <Typography variant="h6" sx={{ mb: 2 }}>Your Menu</Typography>
        <TableContainer component={Paper}>
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
                  <TableCell>
                    {item.price !== null && item.price !== undefined ? `₹${item.price}` : "-"}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(item)} color="primary">
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(item.id)} color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">No items yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </>
  );
};

export default VendorDashboard;