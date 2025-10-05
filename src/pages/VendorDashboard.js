
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Stack, Chip, Grid, Box, Divider, Tooltip,
  FormControlLabel, Switch, MenuItem, LinearProgress, Skeleton, Alert, Avatar
} from "@mui/material";
import { Delete, Edit, Refresh, Add } from "@mui/icons-material";
import DownloadIcon from "@mui/icons-material/Download";
import StarIcon from "@mui/icons-material/Star";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { socket, connectSocket } from "../utils/socket";
import VendorSalesTrend from "../components/VendorSalesTrend";

const ROOT = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const apiUrl = (p) => `${ROOT}${p}`;
const PLACEHOLDER_IMG = "/images/placeholder-food.png";

/* ------------ helpers ------------ */
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

const SummaryCard = ({ title, value, sub, loading = false }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="body2" color="text.secondary">{title}</Typography>
    {loading ? <Skeleton width={120} height={36} /> : <Money value={value} />}
    {sub && (
      <Typography variant="caption" color="text.secondary">
        {loading ? <Skeleton width={80} /> : sub}
      </Typography>
    )}
  </Paper>
);

const AovCard = ({ title, revenue = 0, orders = 0, loading = false }) => {
  const aov = orders > 0 ? Number(revenue) / Number(orders) : 0;
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">{title} AOV</Typography>
      {loading ? <Skeleton width={120} height={36} /> : (
        <Typography variant="h5" fontWeight={700}>₹{aov.toFixed(2)}</Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {loading ? <Skeleton width={120} /> : `${orders} orders · ₹${Number(revenue || 0).toFixed(2)}`}
      </Typography>
    </Paper>
  );
};

const StatusChips = ({ byStatus = {}, loading = false }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Orders by status</Typography>
    {loading ? (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width={90} height={28} variant="rounded" />)}
      </Stack>
    ) : (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {Object.entries(byStatus).map(([k, v]) => (
          <Chip key={k} label={`${k}: ${v || 0}`} color={STATUS_COLORS[k] || "default"} />
        ))}
      </Stack>
    )}
  </Paper>
);

/** Image helpers (JPG/PNG) **/
const isHttpUrl = (v) => {
  if (!v) return false;
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
};
const isImageHttpUrl = (v) => {
  if (!isHttpUrl(v)) return false;
  try {
    const u = new URL(v);
    const p = u.pathname.toLowerCase();
    const format = (u.searchParams.get("format") || "").toLowerCase();
    return (
      p.endsWith(".jpg") || p.endsWith(".jpeg") || p.endsWith(".png") ||
      format === "jpg" || format === "jpeg" || format === "png"
    );
  } catch { return false; }
};
const isLocalImagePath = (v) =>
  typeof v === "string" &&
  v.startsWith("/uploads/") &&
  /\.(jpg|jpeg|png)$/i.test(v);
const pickThumb = (v) => (isImageHttpUrl(v) || isLocalImagePath(v)) ? v : PLACEHOLDER_IMG;

/* ------------ main ------------ */
const VendorDashboard = () => {
  const formRef = useRef(null);

  // ----- menu state -----
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", description: "", imageUrl: "" });

  // ----- summary / vendor state -----
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isOpenSaving, setIsOpenSaving] = useState(false);

  // vendor profile
  const [vendorProfile, setVendorProfile] = useState({
    name: "", cuisine: "", location: "", phone: "", logoUrl: ""
  });
  const [savingVendorProfile, setSavingVendorProfile] = useState(false);

  // ----- daily trend controls -----
  const [days, setDays] = useState(() => Number(localStorage.getItem("vd_days") || 14));
  const [daily, setDaily] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // ----- lifetime / goals -----
  const [revGoal, setRevGoal] = useState(() => Number(localStorage.getItem("vd_rev_goal") || 50000));
  const [ordersGoal, setOrdersGoal] = useState(() => Number(localStorage.getItem("vd_orders_goal") || 200));

  // ----- top items -----
  const [topItems, setTopItems] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  // notifications (browser)
  const [notifReady, setNotifReady] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const authHeaders = { Authorization: `Bearer ${token}` };

  // payouts (summary)
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  // persist settings
  useEffect(() => { localStorage.setItem("vd_days", String(days)); }, [days]);
  useEffect(() => { localStorage.setItem("vd_rev_goal", String(revGoal)); }, [revGoal]);
  useEffect(() => { localStorage.setItem("vd_orders_goal", String(ordersGoal)); }, [ordersGoal]);
  useEffect(() => { localStorage.setItem("vd_is_open", String(isOpen)); }, [isOpen]);

  /* ---------- PROFILE LOAD ---------- */
  const parseJsonSafe = async (res) => {
    try { return await res.json(); } catch { return {}; }
  };

  const fetchVendorMe = async () => {
    try {
      const r = await fetch(apiUrl("/api/vendors/me"), { headers: authHeaders });
      const me = await parseJsonSafe(r);
      if (!r.ok) throw new Error(me?.message || `Failed (${r.status})`);

      if (me?.vendorId) setVendorId(me.vendorId);
      if (typeof me?.isOpen === "boolean") setIsOpen(me.isOpen);
      setVendorProfile({
        name: me?.name ?? "",
        cuisine: me?.cuisine ?? "",
        location: me?.location ?? "",
        phone: me?.phone ?? "",
        logoUrl: me?.logoUrl ?? "",
      });
    } catch {
      if (!vendorId) return;
      try {
        const r2 = await fetch(apiUrl(`/api/vendors/${vendorId}`), { headers: authHeaders });
        const v = await parseJsonSafe(r2);
        if (!r2.ok) throw new Error(v?.message || `Failed (${r2.status})`);
        if (typeof v?.isOpen === "boolean") setIsOpen(v.isOpen);
        setVendorProfile({
          name: v?.name ?? "",
          cuisine: v?.cuisine ?? "",
          location: v?.location ?? "",
          phone: v?.phone ?? "",
          logoUrl: v?.logoUrl ?? "",
        });
      } catch { /* ignore */ }
    }
  };

  const saveVendorProfile = async () => {
    if (!vendorId) {
      toast.error("No vendor profile attached to this account.");
      return;
    }
    setSavingVendorProfile(true);
    try {
      const body = {
        name: vendorProfile.name,
        cuisine: vendorProfile.cuisine,
        location: vendorProfile.location,
        phone: vendorProfile.phone || null,
        logoUrl: vendorProfile.logoUrl || null,
      };
      const res = await fetch(apiUrl(`/api/vendors/${vendorId}`), {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Failed to save profile");
      toast.success("Vendor profile updated");
      await fetchVendorMe();
    } catch (e) {
      toast.error(e?.message || "Failed to save vendor profile");
    } finally {
      setSavingVendorProfile(false);
    }
  };

  /* ---------- MENU LOAD ---------- */
  const fetchMenu = async () => {
    const tryMine = async () => {
      const res = await fetch(apiUrl("/api/menu-items/mine"), { headers: authHeaders });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
      return Array.isArray(data) ? data : [];
    };

    const tryVendorMenu = async () => {
      let vId = vendorId;
      if (!vId) {
        const r = await fetch(apiUrl("/api/vendors/me"), { headers: authHeaders });
        const me = await parseJsonSafe(r);
        if (me?.vendorId) vId = me.vendorId;
      }
      if (!vId) throw new Error("No vendor profile attached to this account.");
      const r2 = await fetch(apiUrl(`/api/vendors/${vId}/menu`), { headers: authHeaders });
      const d2 = await parseJsonSafe(r2);
      if (!r2.ok) throw new Error(d2?.message || `Failed (${r2.status})`);
      return Array.isArray(d2) ? d2 : (Array.isArray(d2.items) ? d2.items : []);
    };

    try {
      const list = await tryMine();
      setMenuItems(list);
    } catch (e1) {
      try {
        const list = await tryVendorMenu();
        setMenuItems(list);
        toast.warn(`Loaded menu via fallback: ${e1?.message || "mine failed"}`);
      } catch (e2) {
        setMenuItems([]);
        toast.error(`Failed to load menu: ${e2?.message || e1?.message || "Unknown error"}`);
      }
    }
  };

  /* ---------- SUMMARY LOAD ---------- */
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(apiUrl("/api/orders/vendor/summary"), { headers: authHeaders });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await parseJsonSafe(res)).message || `Summary failed (${res.status})`;
        toast.error(msg);
        setSummary(null);
        return;
      }
      const data = await res.json();
      setSummary(data);
    } catch {
      toast.error("Network error while loading summary");
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  /* ---------- DAILY TREND LOAD ---------- */
  const fetchDaily = async (range = days) => {
    setLoadingDaily(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/vendor/daily?days=${range}`), { headers: authHeaders });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const msg = data?.message || `Trend failed (${res.status})`;
        toast.error(msg);
        setDaily([]);
        return;
      }
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.items)) list = data.items;
      setDaily(list);
    } catch {
      toast.error("Network error while loading trend");
      setDaily([]);
    } finally {
      setLoadingDaily(false);
    }
  };

  /* ---------- PAYOUTS (SUMMARY) ---------- */
  const fetchPayouts = async () => {
   setPayoutsLoading(true);
    try {
     const res = await fetch(apiUrl(`/api/orders/payouts/summary`), { headers: authHeaders });
     const data = await parseJsonSafe(res);
     if (!res.ok) throw new Error(data?.message || "Failed to fetch payouts");
     // normalize to the shape your UI expects
     setPayoutSummary({
      paidOrders: data.paidOrders || 0,
      grossPaid: data.grossPaid || 0,
      commission: data.commission || 0,
      netOwed: data.netOwed || 0,
     });
    } catch (e) {
     console.error("Failed to fetch payouts:", e?.message);
     setPayoutSummary(null);
    }  finally {
     setPayoutsLoading(false);
    }
  };

  /* ---------- TOP ITEMS (client-side) ---------- */
  const fetchTopItems = async () => {
    setLoadingTop(true);
    try {
      const res = await fetch(apiUrl("/api/orders/vendor?page=1&pageSize=200"), { headers: authHeaders });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await parseJsonSafe(res);
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
          const prev = agg.get(key) || { id: ln.id, name: ln.name, qty: 0, revenue: 0 };
          prev.qty += ln.qty;
          prev.revenue += ln.qty * ln.price;
          agg.set(key, prev);
        }
      }
      const items = [...agg.values()].sort((a, b) => b.revenue - a.revenue);
      setTopItems(items.slice(0, 8));
    } catch (e) {
      console.error("fetchTopItems error:", e);
      setTopItems([]);
    } finally {
      setLoadingTop(false);
    }
  };

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

  /* ---- socket: join vendor room + live updates ---- */
  useEffect(() => {
    connectSocket();
    const getMeAndJoin = async () => {
      try {
        const r = await fetch(apiUrl("/api/vendors/me"), { headers: authHeaders });
        if (!r.ok) return;
        const me = await r.json();
        if (me?.vendorId) {
          setVendorId(me.vendorId);
          const persisted = localStorage.getItem("vd_is_open");
          setIsOpen(typeof persisted === "string" ? persisted === "true" : Boolean(me.isOpen));
          socket.emit("vendor:join", me.vendorId);
        }
      } catch { /* ignore */ }
    };
    getMeAndJoin();

    const onReconnect = () => { if (vendorId) socket.emit("vendor:join", vendorId); };

    try {
      const { refreshSocketAuth, socket: s } = require("../utils/socket");
      refreshSocketAuth();
      if (!s.connected) s.connect();
    } catch {}

    const onNewOrder = (order) => {
      if (Number(order?.VendorId) === Number(vendorId)) {
        toast.info(`🆕 New order #${order?.id ?? ""} received`);
        if (notifReady && "Notification" in window) {
          try { new Notification(`New order #${order?.id ?? ""}`, { body: "Open your orders to view details." }); } catch {}
        }
        fetchSummary();
        fetchDaily(days);
        fetchTopItems();
      }
    };

    const onOrderStatus = () => {
      fetchSummary();
      fetchDaily(days);
      fetchTopItems();
      fetchPayouts();
    };

    const onPayoutUpdate = () => { fetchPayouts(); };
    const onPayoutStatus = () => { fetchPayouts(); };

    socket.on("connect", onReconnect);
    socket.on("order:new", onNewOrder);
    socket.on("order:status", onOrderStatus);
    socket.on("payout:update", onPayoutUpdate);
    socket.on("payout:status", onPayoutStatus);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("order:new", onNewOrder);
      socket.off("order:status", onOrderStatus);
      socket.off("payout:update", onPayoutUpdate);
      socket.off("payout:status", onPayoutStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, token, days, notifReady]);

  useEffect(() => { if (vendorId) fetchPayouts(); }, [vendorId]); // eslint-disable-line

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
      ? apiUrl(`/api/menu-items/${editingItem.id}`)
      : apiUrl(`/api/menu-items`);

    const rawUrl = (form.imageUrl || "").trim();
    const imageUrl = (isImageHttpUrl(rawUrl) || isLocalImagePath(rawUrl)) ? rawUrl : null;

    const body = {
      name: form.name,
      price: form.price === "" ? null : parseFloat(form.price),
      description: form.description,
      imageUrl,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await parseJsonSafe(res);
        toast.error(data.message || "Failed to save item");
        return;
      }

      toast.success(editingItem ? "Item updated" : "Item added");
      setForm({ name: "", price: "", description: "", imageUrl: "" });
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
      imageUrl: item.imageUrl ?? item.imageURL ?? "",
    });
    setEditingItem(item);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/menu-items/${id}`), {
        method: "DELETE",
        headers: authHeaders,
      });
      if (res.ok) {
        toast.success("Item deleted!");
        fetchMenu();
        fetchSummary();
        fetchDaily(days);
        fetchTopItems();
      } else {
        const data = await parseJsonSafe(res);
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Server error");
    }
  };

  // ✅ Use vendor-safe toggle endpoint to avoid PUT coupling and reduce payload
  const toggleOpen = async (checked) => {
    const prev = isOpen;
    setIsOpen(checked);
    setIsOpenSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/vendors/me/open`), {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: checked }),
      });
      const out = await parseJsonSafe(res);
      if (!res.ok) {
        const msg = out?.message || "Failed to update status";
        setIsOpen(prev);
        toast.error(msg);
        return;
      }
      toast.success(`Vendor is now ${checked ? "Open" : "Closed"}`);
    } catch {
      setIsOpen(prev);
      toast.error("Network error while updating status");
    } finally {
      setIsOpenSaving(false);
    }
  };

  const requestBrowserNotif = async () => {
    if (!("Notification" in window)) {
      toast.error("Browser notifications not supported");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifReady(true);
        new Notification("Notifications enabled", { body: "You’ll get alerts for new orders." });
      } else {
        toast.info("Notifications permission was not granted");
      }
    } catch {
      toast.error("Could not enable notifications");
    }
  };

  useEffect(() => {
    (async () => {
      await fetchVendorMe();
      await Promise.all([
        fetchMenu(),
        fetchSummary(),
        fetchDaily(days),
        fetchTopItems(),
      ]);
      // if vendorId is known, fetch payouts
      if (vendorId) await fetchPayouts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const rows = Array.isArray(menuItems) ? menuItems : [];
  const byStatus = summary?.byStatus || {};

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

  const accepted  = Number(byStatus.accepted || 0);
  const rejected  = Number(byStatus.rejected || 0);
  const delivered = Number(byStatus.delivered || 0);

  const acceptanceRate = (accepted + rejected) > 0 ? (accepted / (accepted + rejected)) * 100 : null;
  const completionRate = accepted > 0 ? (delivered / accepted) * 100 : null;
  const avgPrepTime = "—";

  const topNames = useMemo(
    () => new Set((topItems || []).slice(0, 3).map(i => (i.name || "").toLowerCase())),
    [topItems]
  );

  const totalTopRevenue = (topItems || []).reduce((s, i) => s + Number(i.revenue || 0), 0) || 0;

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1, minWidth: 220 }}
          >
            Vendor Dashboard
            <Chip
              size="small"
              label={isOpen ? "Open" : "Closed"}
              color={isOpen ? "success" : "default"}
              variant="outlined"
            />
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isOpen}
                  onChange={(e) => toggleOpen(e.target.checked)}
                  disabled={!vendorId || isOpenSaving}
                />
              }
              label={isOpenSaving ? "Saving…" : (isOpen ? "Open" : "Closed")}
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

            <Tooltip title="Enable browser notifications">
              <span>
                <Button
                  color="inherit"
                  startIcon={<NotificationsActiveIcon />}
                  onClick={requestBrowserNotif}
                  disabled={notifReady}
                >
                  {notifReady ? "Notifications On" : "Enable Alerts"}
                </Button>
              </span>
            </Tooltip>

            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {/* ---- QUICK ACTIONS BAR ---- */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button startIcon={<Add />} variant="contained" onClick={scrollToForm}>
              Create item
            </Button>
            <Button variant="outlined" onClick={() => { fetchSummary(); fetchDaily(days); fetchTopItems(); fetchMenu(); fetchPayouts(); }}>
              Refresh all
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportDailyCsv} disabled={loadingDaily || (daily || []).length === 0}>
              Export daily CSV
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportTopCsv} disabled={loadingTop || (topItems || []).length === 0}>
              Export top items CSV
            </Button>
            <Box sx={{ ml: "auto" }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip size="small" label={`Acceptance: ${acceptanceRate == null ? "—" : `${acceptanceRate.toFixed(0)}%`}`} />
                <Chip size="small" label={`Completion: ${completionRate == null ? "—" : `${completionRate.toFixed(0)}%`}`} />
                <Chip size="small" label={`Avg prep: ${avgPrepTime}`} />
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* ---- SUMMARY + TREND ---- */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ mb: 3 }}>
            {/* 👇 Sales Trend graph lives here */}
            <VendorSalesTrend days={days} />
          </Box>

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

          {(daily || []).length === 0 && !loadingDaily && (
            <Alert severity="info" sx={{ mt: 1 }}>
              No orders in this range yet. Try a wider range or check back later.
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6">Summary</Typography>
            <Tooltip title="Refresh summary">
              <IconButton onClick={fetchSummary}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="Today" value={summary?.today?.revenue} sub={`${summary?.today?.orders || 0} orders`} loading={summaryLoading} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Week" value={summary?.week?.revenue} sub={`${summary?.week?.orders || 0} orders`} loading={summaryLoading} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SummaryCard title="This Month" value={summary?.month?.revenue} sub={`${summary?.month?.orders || 0} orders`} loading={summaryLoading} />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <StatusChips byStatus={summary?.byStatus || {}} loading={summaryLoading} />
            </Grid>
          </Grid>

          {/* AOV row */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Average Order Value (AOV)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}><AovCard title="Today"      revenue={summary?.today?.revenue}  orders={summary?.today?.orders}  loading={summaryLoading} /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="This Week"  revenue={summary?.week?.revenue}   orders={summary?.week?.orders}   loading={summaryLoading} /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="This Month" revenue={summary?.month?.revenue}  orders={summary?.month?.orders}  loading={summaryLoading} /></Grid>
              <Grid item xs={12} sm={3}><AovCard title="Lifetime"   revenue={summary?.totals?.revenue} orders={summary?.totals?.orders} loading={summaryLoading} /></Grid>
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
                  <Typography variant="subtitle2">₹{Number(summary?.month?.revenue || 0).toFixed(2)} / ₹{Number(revGoal).toFixed(0)}</Typography>
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
                  <Typography variant="subtitle2">{Number(summary?.month?.orders || 0)} / {ordersGoal}</Typography>
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

          {/* Top Selling Items */}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 1, flexWrap: "wrap" }}>
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
                          <Typography variant="body2" sx={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 0.5 }}>
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
              Lifetime: <strong>{lifeOrders || 0}</strong> orders ·{" "}
              <strong>₹{Number(lifeRevenue || 0).toFixed(2)}</strong>
            </Typography>
          </Box>
        </Paper>

        {/* ---- MY VENDOR PROFILE (Editable) ---- */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">My Vendor Profile</Typography>
            <Tooltip title="Reload vendor profile">
              <IconButton onClick={fetchVendorMe}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    value={vendorProfile.name}
                    onChange={(e) => setVendorProfile((p) => ({ ...p, name: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Cuisine"
                    value={vendorProfile.cuisine}
                    onChange={(e) => setVendorProfile((p) => ({ ...p, cuisine: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Location"
                    value={vendorProfile.location}
                    onChange={(e) => setVendorProfile((p) => ({ ...p, location: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone"
                    value={vendorProfile.phone}
                    onChange={(e) => setVendorProfile((p) => ({ ...p, phone: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Logo URL (JPEG/PNG or /uploads/...)"
                    value={vendorProfile.logoUrl}
                    onChange={(e) => setVendorProfile((p) => ({ ...p, logoUrl: e.target.value }))}
                    helperText="Tip: upload via the same /api/uploads endpoint or paste an https .jpg/.png"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Stack alignItems="center" spacing={1}>
                <Avatar
                  variant="rounded"
                  src={pickThumb(vendorProfile.logoUrl)}
                  alt="Logo preview"
                  sx={{ width: 96, height: 96 }}
                  imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                />
                <Typography variant="caption" color="text.secondary">Logo preview</Typography>
              </Stack>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={saveVendorProfile}
              disabled={savingVendorProfile || !vendorId}
            >
              {savingVendorProfile ? "Saving…" : "Save Profile"}
            </Button>
            <Button variant="outlined" onClick={fetchVendorMe}>Reset</Button>
          </Stack>
        </Paper>

        {/* ---- MENU FORM ---- */}
        <Paper sx={{ p: 3, mb: 3 }} ref={formRef}>
          <Typography variant="h6">
            {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField label="Name" name="name" value={form.name} onChange={handleChange} required fullWidth sx={{ mb: 2 }} />
            <TextField label="Price" name="price" type="number" value={form.price} onChange={handleChange} required fullWidth sx={{ mb: 2 }} />
            <TextField label="Description" name="description" value={form.description} onChange={handleChange} fullWidth sx={{ mb: 2 }} />

            {/* URL input */}
            <TextField
              label="Image URL (JPEG/PNG)"
              name="imageUrl"
              value={form.imageUrl}
              onChange={handleChange}
              placeholder="https://…/photo.jpg  or  /uploads/file.png"
              fullWidth
              helperText="Use .jpg, .jpeg or .png"
              sx={{ mb: 1.5 }}
            />

            {/* Choose File uploader */}
            <Box sx={{ mb: 2 }}>
              <Button variant="outlined" component="label">
                Choose File
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const data = new FormData();
                    data.append("image", file);
                    try {
                      const res = await fetch(apiUrl(`/api/uploads`), {
                        method: "POST",
                        headers: authHeaders, // FormData: do NOT set Content-Type manually
                        body: data,
                      });
                      if (!res.ok) {
                        const err = await parseJsonSafe(res);
                        toast.error(err.message || "Upload failed");
                        return;
                      }
                      const out = await res.json(); // expects { url: "/uploads/xyz.jpg" }
                      setForm((p) => ({ ...p, imageUrl: out.url }));
                      toast.success("Image uploaded");
                    } catch (err) {
                      console.error("Upload error", err);
                      toast.error("Server error while uploading image");
                    }
                  }}
                />
              </Button>
            </Box>

            {/* Preview */}
            {form.imageUrl && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Avatar
                    variant="rounded"
                    src={pickThumb(form.imageUrl)}
                    alt="preview"
                    sx={{ width: 56, height: 56 }}
                    imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                  />
                  <Typography variant="caption" color="text.secondary">Preview</Typography>
              </Stack>
            )}

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
                <TableCell width={64}>Image</TableCell>
                <TableCell style={{ minWidth: 160 }}>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(Array.isArray(menuItems) ? menuItems : []).map((item) => {
                const isTop = topNames.has((item.name || "").toLowerCase());
                const img = item.imageUrl ?? item.imageURL ?? "";
                const thumbSrc = pickThumb(img);
                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Avatar
                        variant="rounded"
                        src={thumbSrc}
                        alt={item.name || "Item"}
                        sx={{ width: 48, height: 48 }}
                        imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: "wrap" }}>
                        <span>{item.name}</span>
                        {isTop && (
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<StarIcon fontSize="small" />}
                            label="Top seller"
                            color="warning"
                            sx={{ ml: 0.5 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {item.price !== null && item.price !== undefined ? `₹${item.price}` : "-"}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.description}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => handleEdit(item)} color="primary" title="Edit">
                        <Edit />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(item.id)} color="error" title="Delete">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(Array.isArray(menuItems) ? menuItems : []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No items yet. Click <strong>Create item</strong> to add your first dish.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ---- PAYOUTS (SUMMARY VIEW) ---- */}
        <Paper sx={{ p: 3, mt: 3, mb: 6 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6">Payouts</Typography>
            <Tooltip title="Refresh payouts">
              <IconButton onClick={fetchPayouts}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          {payoutsLoading ? (
            <Skeleton variant="rectangular" height={68} />
          ) : !payoutSummary ? (
            <Typography variant="body2" color="text.secondary">No payouts yet.</Typography>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Paid Orders</Typography>
                  <Typography variant="h5" fontWeight={700}>{payoutSummary.paidOrders || 0}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Gross Paid</Typography>
                  <Money value={payoutSummary.grossPaid || 0} />
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Commission</Typography>
                  <Money value={payoutSummary.commission || 0} />
                </Paper>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Net Owed to You</Typography>
                  <Money value={payoutSummary.netOwed || 0} />
                </Paper>
              </Grid>
            </Grid>
          )}
        </Paper>
      </Container>
    </>
  );
};

export default VendorDashboard;