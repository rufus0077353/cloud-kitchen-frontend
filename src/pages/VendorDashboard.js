// src/pages/VendorDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Stack, Chip, Grid, Box, Divider, Tooltip,
  FormControlLabel, Switch, MenuItem, LinearProgress
} from "@mui/material";
import { Delete, Edit, Refresh } from "@mui/icons-material";
import DownloadIcon from "@mui/icons-material/Download";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import VendorSalesTrend from "../components/VendorSalesTrend";

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

// AOV card
const AovCard = ({ title, revenue = 0, orders = 0 }) => {
  const aov = orders > 0 ? Number(revenue) / Number(orders) : 0;
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">{title} AOV</Typography>
      <Typography variant="h5" fontWeight={700}>₹{aov.toFixed(2)}</Typography>
      <Typography variant="caption" color="text.secondary">
        {orders} orders · ₹{Number(revenue || 0).toFixed(2)}
      </Typography>
    </Paper>
  );
};

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

  // ----- summary / vendor state -----
  const [summary, setSummary] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const [isOpen, setIsOpen] = useState(true); // vendor open/closed

  // ----- daily trend controls -----
  const [days, setDays] = useState(14);
  const [daily, setDaily] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // ----- lifetime / goals -----
  const [revGoal, setRevGoal] = useState(50000);
  const [ordersGoal, setOrdersGoal] = useState(200);

  // ----- top items (NEW) -----
  const [topItems, setTopItems] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ---------- MENU LOAD ----------
  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    } catch {
      toast.error("Network error while loading summary");
      setSummary(null);
    }
  };

  // ---------- DAILY TREND LOAD ----------
  const fetchDaily = async (range = days) => {
    setLoadingDaily(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/daily?days=${range}`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        const msg = data?.message || `Trend failed (${res.status})`;
        toast.error(msg);
        setDaily([]);
        return;
      }
      setDaily(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Network error while loading trend");
      setDaily([]);
    } finally {
      setLoadingDaily(false);
    }
  };

  // ---------- TOP ITEMS (NEW) ----------
  // Pulls the most recent 200 vendor orders and aggregates item quantity & revenue.
  const fetchTopItems = async () => {
    setLoadingTop(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor?page=1&pageSize=200`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || `Top items failed (${res.status})`;
        toast.error(msg);
        setTopItems([]);
        return;
      }
      const orders = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      const agg = new Map();
      for (const o of orders) {
        const fromOrderItems = Array.isArray(o?.OrderItems) && o.OrderItems.length > 0;
        const lines = fromOrderItems
          ? o.OrderItems.map(oi => ({
              id: oi.MenuItem?.id ?? oi.MenuItemId ?? null,
              name: oi.MenuItem?.name ?? "Item",
              price: Number(oi.MenuItem?.price ?? 0),
              qty: Number(oi.quantity ?? oi.OrderItem?.quantity ?? 1),
            }))
          : (Array.isArray(o?.MenuItems) ? o.MenuItems.map(mi => ({
              id: mi.id ?? null,
              name: mi.name ?? "Item",
              price: Number(mi.price ?? 0),
              qty: Number(mi.OrderItem?.quantity ?? 1),
            })) : []);
        for (const ln of lines) {
          if (!ln) continue;
          const key = ln.id ?? ln.name;
          const prev = agg.get(key) || { name: ln.name, qty: 0, revenue: 0 };
          prev.qty += ln.qty;
          prev.revenue += ln.qty * ln.price;
          agg.set(key, prev);
        }
      }
      const items = [...agg.values()].sort((a, b) => b.revenue - a.revenue);
      setTopItems(items.slice(0, 8)); // top 8
    } catch (e) {
      console.error("fetchTopItems error:", e);
      setTopItems([]);
    } finally {
      setLoadingTop(false);
    }
  };

  const exportTopCsv = () => {
    const headers = ["Item", "Quantity", "Revenue"];
    const lines = (topItems || []).map(i => `${i.name},${i.qty},${i.revenue}`);
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `vendor-top-items-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          setIsOpen(Boolean(me.isOpen)); // read initial open state
          socket.emit("vendor:join", me.vendorId);
        }
      } catch {
        // ignore
      }
    };

    getMeAndJoin();

    const onReconnect = () => {
      if (vendorId) socket.emit("vendor:join", vendorId);
    };

    const onNewOrder = (order) => {
      if (Number(order?.VendorId) === Number(vendorId)) {
        toast.info(`🆕 New order #${order?.id ?? ""} received`);
        fetchSummary();
        fetchDaily(days);
        fetchTopItems(); // refresh top items
      }
    };

    socket.on("connect", onReconnect);
    socket.on("order:new", onNewOrder);
    socket.on("order:status", () => { fetchSummary(); fetchDaily(days); fetchTopItems(); });

    return () => {
      socket.off("connect", onReconnect);
      socket.off("order:new", onNewOrder);
      socket.off("order:status", () => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, token, days]);

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
      fetchSummary();
      fetchDaily(days);
      fetchTopItems();
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
        fetchDaily(days);
        fetchTopItems();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Server error");
    }
  };

  // Toggle vendor open/closed
  const toggleOpen = async (checked) => {
    const prev = isOpen;
    setIsOpen(checked);
    try {
      if (!vendorId) return;
      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ isOpen: checked }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || "Failed to update status";
        setIsOpen(prev); // rollback
        toast.error(msg);
        return;
      }
      toast.success(`Vendor is now ${checked ? "Open" : "Closed"}`);
    } catch {
      setIsOpen(prev); // rollback
      toast.error("Network error while updating status");
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchSummary();
    fetchDaily(days);
    fetchTopItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = Array.isArray(menuItems) ? menuItems : [];
  const byStatus = summary?.byStatus || {};

  // CSV export for daily trend
  const exportDailyCsv = () => {
    const headers = ["Date", "Orders", "Revenue"];
    const lines = (daily || []).map(d => `${d.date},${d.orders},${d.revenue}`);
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `vendor-daily-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------ computed helpers for goals / AOV ------
  const todayOrders  = Number(summary?.today?.orders || 0);
  const weekOrders   = Number(summary?.week?.orders || 0);
  const monthOrders  = Number(summary?.month?.orders || 0);
  const lifeOrders   = Number(summary?.totals?.orders || 0);

  const todayRevenue = Number(summary?.today?.revenue || 0);
  const weekRevenue  = Number(summary?.week?.revenue || 0);
  const monthRevenue = Number(summary?.month?.revenue || 0);
  const lifeRevenue  = Number(summary?.totals?.revenue || 0);

  const revProgress    = revGoal > 0 ? Math.min(100, (monthRevenue / revGoal) * 100) : 0;
  const ordersProgress = ordersGoal > 0 ? Math.min(100, (monthOrders / ordersGoal) * 100) : 0;

  const revRemaining    = Math.max(0, revGoal - monthRevenue);
  const ordersRemaining = Math.max(0, ordersGoal - monthOrders);

  const goalHint = useMemo(() => {
    if (!revGoal && !ordersGoal) return "";
    const parts = [];
    if (revRemaining > 0) parts.push(`₹${revRemaining.toFixed(0)} revenue left`);
    if (ordersRemaining > 0) parts.push(`${ordersRemaining} orders to go`);
    if (!parts.length) return "Monthly goals reached 🎉";
    return `You’re close: ${parts.join(" · ")}`;
  }, [revRemaining, ordersRemaining, revGoal, ordersGoal]);

  // ------- Top items helpers -------
  const totalTopRevenue = (topItems || []).reduce((s, i) => s + Number(i.revenue || 0), 0) || 0;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1 }}
          >
            Vendor Dashboard
            <Chip
              size="small"
              label={isOpen ? "Open" : "Closed"}
              color={isOpen ? "success" : "default"}
              variant="outlined"
            />
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            {/* Open/Closed switch */}
            <FormControlLabel
              control={
                <Switch
                  checked={isOpen}
                  onChange={(e) => toggleOpen(e.target.checked)}
                  disabled={!vendorId}
                />
              }
              label={isOpen ? "Open" : "Closed"}
              sx={{ mr: 1 }}
            />

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
        {/* ---- SUMMARY + TREND ---- */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ mb: 3 }}>
            <VendorSalesTrend />
          </Box>

          {/* Daily Trend Controls + CSV */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
            <Typography variant="subtitle1">Daily Trend Controls</Typography>
            <Stack direction="row" gap={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
              <TextField
                select
                size="small"
                label="Range"
                value={days}
                onChange={(e) => { const v = Number(e.target.value); setDays(v); fetchDaily(v); }}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value={7}>Last 7 days</MenuItem>
                <MenuItem value={14}>Last 14 days</MenuItem>
                <MenuItem value={30}>Last 30 days</MenuItem>
              </TextField>

              <Tooltip title="Reload summary & trend">
                <IconButton onClick={() => { fetchSummary(); fetchDaily(days); }}>
                  <Refresh />
                </IconButton>
              </Tooltip>

              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportDailyCsv} disabled={loadingDaily || (daily || []).length === 0}>
                Export CSV
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Revenue Summary */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Summary</Typography>
            <Tooltip title="Refresh summary">
              <IconButton onClick={fetchSummary}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="Today" value={todayRevenue} sub={`${todayOrders || 0} orders`} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Week" value={weekRevenue} sub={`${weekOrders || 0} orders`} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Month" value={monthRevenue} sub={`${monthOrders || 0} orders`} />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <StatusChips byStatus={byStatus} />
            </Grid>
          </Grid>

          {/* AOV row */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Average Order Value (AOV)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}><AovCard title="Today"      revenue={todayRevenue} orders={todayOrders} /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="This Week"  revenue={weekRevenue}  orders={weekOrders}  /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="This Month" revenue={monthRevenue} orders={monthOrders} /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="Lifetime"   revenue={lifeRevenue}  orders={lifeOrders}  /></Grid>
            </Grid>
          </Box>

          <Divider sx={{ mt: 2 }} />

          {/* Monthly Goals with progress */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Monthly Goals</Typography>

            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Revenue Goal</Typography>
                    <TextField
                      size="small"
                      label="₹ goal"
                      type="number"
                      value={revGoal}
                      onChange={(e) => setRevGoal(Math.max(0, Number(e.target.value) || 0))}
                      sx={{ width: 160 }}
                    />
                  </Stack>
                  <Typography variant="subtitle2">₹{monthRevenue.toFixed(2)} / ₹{Number(revGoal).toFixed(0)}</Typography>
                  <LinearProgress variant="determinate" value={revProgress} sx={{ mt: 1, height: 10, borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {revRemaining <= 0 ? "Goal achieved 🎉" : `₹${revRemaining.toFixed(0)} to go`}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Orders Goal</Typography>
                    <TextField
                      size="small"
                      label="Orders goal"
                      type="number"
                      value={ordersGoal}
                      onChange={(e) => setOrdersGoal(Math.max(0, Number(e.target.value) || 0))}
                      sx={{ width: 160 }}
                    />
                  </Stack>
                  <Typography variant="subtitle2">{monthOrders} / {ordersGoal}</Typography>
                  <LinearProgress variant="determinate" value={ordersProgress} sx={{ mt: 1, height: 10, borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {ordersRemaining <= 0 ? "Goal achieved 🎉" : `${ordersRemaining} orders to go`}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Typography variant="body2" color="text.secondary">
              {goalHint}
            </Typography>
          </Box>

          <Divider sx={{ mt: 2 }} />

          {/* NEW: Top Selling Items */}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Top Selling Items</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Reload top items">
                  <IconButton onClick={fetchTopItems}><Refresh /></IconButton>
                </Tooltip>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportTopCsv} disabled={loadingTop || (topItems || []).length === 0}>
                  Export CSV
                </Button>
              </Stack>
            </Stack>

            <Paper sx={{ p: 2 }}>
              {(topItems || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {loadingTop ? "Loading…" : "No data yet"}
                </Typography>
              ) : (
                <Grid container spacing={1}>
                  {(topItems || []).map((it, idx) => {
                    const share = totalTopRevenue > 0 ? (it.revenue / totalTopRevenue) * 100 : 0;
                    return (
                      <Grid item xs={12} key={`${it.name}-${idx}`}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="body2" sx={{ maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {idx + 1}. {it.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {it.qty} sold · ₹{Number(it.revenue || 0).toFixed(2)}
                          </Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={Math.min(100, share)} sx={{ height: 8, borderRadius: 1, mb: 1 }} />
                      </Grid>
                    );
                  })}
                </Grid>
              )}
              {totalTopRevenue > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Total revenue across top items: ₹{totalTopRevenue.toFixed(2)}
                </Typography>
              )}
            </Paper>
          </Box>

          <Divider sx={{ mt: 2 }} />

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Lifetime: <strong>{lifeOrders}</strong> orders ·{" "}
              <strong>₹{lifeRevenue.toFixed(2)}</strong>
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
              {(Array.isArray(menuItems) ? menuItems : []).map((item) => (
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
              {(Array.isArray(menuItems) ? menuItems : []).length === 0 && (
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