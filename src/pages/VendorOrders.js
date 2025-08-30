
// src/pages/VendorOrders.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar, Toolbar, Container, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, Chip, Button, Box, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Stack, IconButton, TextField,
  Collapse, Divider, Switch, FormControlLabel, Tooltip, TablePagination
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { io } from "socket.io-client";

const API_BASE   = process.env.REACT_APP_API_BASE_URL  || "";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL    || API_BASE;
const DASHBOARD_PATH = process.env.REACT_APP_VENDOR_DASH_PATH || "/vendor";

const STATUS_COLORS = {
  pending:   "default",
  accepted:  "primary",
  rejected:  "error",
  ready:     "warning",
  delivered: "success",
};

export default function VendorOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [realtime, setRealtime] = useState(true);
  const [pollMs, setPollMs] = useState(30000);
  const [soundOn, setSoundOn] = useState(true);
  const [vendorId, setVendorId] = useState(null);

  const prevPendingIdsRef = useRef(new Set());
  const socketRef = useRef(null);

  const audioRef = useRef(null);
  const beepSrc = useMemo(
    () =>
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAChAAAAAAAaAAAAPwAAAB8AAACAgICAAAAAA" +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    []
  );
  const playBeep = () => {
    if (!soundOn) return;
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch {}
  };

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadOrders = async ({ silent = false, toPage = page, size = rowsPerPage } = {}) => {
    if (!silent) setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(toPage + 1), pageSize: String(size) }).toString();
      const res = await fetch(`${API_BASE}/api/orders/vendor?${q}`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || `Failed (${res.status})`;
        if (!silent) toast.error(msg);
        setOrders([]);
        setTotal(0);
        return;
      }
      if (Array.isArray(data)) {
        setOrders(data);
        setTotal(data.length);
      } else {
        setOrders(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total || 0));
      }

      const incoming = Array.isArray(data) ? data : (data.items || []);
      const currentPendingIds = new Set(
        (incoming || []).filter((o) => o.status === "pending").map((o) => o.id)
      );
      const hadNew =
        [...currentPendingIds].some((id) => !prevPendingIdsRef.current.has(id)) &&
        prevPendingIdsRef.current.size !== 0;
      prevPendingIdsRef.current = currentPendingIds;
      if (hadNew && !silent) {
        playBeep();
        toast.info("New pending order received");
      }
    } catch (e) {
      if (!silent) toast.error("Network error while loading orders");
      setOrders([]);
      setTotal(0);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    const prev = orders;
    const next = prev.map((o) => (o.id === id ? { ...o, status } : o));
    setOrders(next);
    setUpdatingId(id);

    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || "Failed to update";
        setOrders(prev); // rollback
        toast.error(msg);
        return;
      }
      toast.success("Status updated");
      loadOrders({ silent: true });
    } catch (e) {
      setOrders(prev); // rollback
      toast.error("Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  // NEW: mark COD order as paid
  const markPaid = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/payments/${id}/mark-paid`, {
        method: "PATCH",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Failed to mark paid");
        return;
      }
      toast.success("Payment marked as paid");
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, paymentStatus: "paid", paidAt: new Date().toISOString() } : o))
      );
    } catch (e) {
      toast.error("Network error");
    }
  };

  // 👇 NEW: open invoice with Authorization header
  const openInvoice = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/invoice`, {
        headers: { Authorization: `Bearer ${token}` }, // send token!
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
      // tidy up later
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error("Network error while opening invoice");
    }
  };

  useEffect(() => {
    const getMe = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vendors/me`, { headers });
        if (!r.ok) return;
        const me = await r.json();
        if (me?.vendorId) setVendorId(me.vendorId);
      } catch {}
    };
    getMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;

    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      withCredentials: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = s;

    s.on("connect_error", (err) => {
      console.warn("socket connect_error:", err?.message || err);
    });

    const onNew = (fullOrder) => {
      if (page > 0 || rowsPerPage > 0) {
        loadOrders({ silent: true });
      } else {
        setOrders((prev) => [fullOrder, ...prev]);
      }
      playBeep();
      toast.info(`New order #${fullOrder?.id || ""}`);
    };

    const onStatus = (payload) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === payload.id ? { ...o, status: payload.status } : o))
      );
    };

    const onPayment = (payload) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === payload.orderId ? { ...o, paymentStatus: payload.paymentStatus } : o))
      );
    };

    s.on("order:new", onNew);
    s.on("order:status", onStatus);
    s.on("payment:status", onPayment);
    s.on("orders:refresh", () => loadOrders({ silent: true }));

    return () => {
      try {
        s.off("order:new", onNew);
        s.off("order:status", onStatus);
        s.off("payment:status", onPayment);
        s.off("orders:refresh");
        s.disconnect();
      } catch {}
    };
  }, [token]); // eslint-disable-line

  useEffect(() => {
    if (!vendorId || !socketRef.current) return;
    try {
      socketRef.current.emit("vendor:join", vendorId);
    } catch {}
  }, [vendorId]);

  useEffect(() => {
    if (!realtime) return;
    const id = setInterval(() => loadOrders({ silent: true }), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime, pollMs]);

  const getLineItems = (order) => {
    if (Array.isArray(order?.OrderItems) && order.OrderItems.length) {
      return order.OrderItems.map((oi) => ({
        name: oi.MenuItem?.name || "Item",
        price: oi.MenuItem?.price ?? null,
        quantity: oi.quantity ?? oi.OrderItem?.quantity ?? 1,
      }));
    }
    if (Array.isArray(order?.MenuItems) && order.MenuItems.length) {
      return order.MenuItems.map((mi) => ({
        name: mi.name,
        price: mi.price ?? null,
        quantity: mi.OrderItem?.quantity ?? 1,
      }));
    }
    return [];
  };

  const itemsToText = (order) =>
    getLineItems(order).map((it) => `${it.name} x${it.quantity}`).join(", ") || "-";

  const matchesSearch = (order, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const userName = (order?.User?.name || "").toLowerCase();
    const itemsStr = itemsToText(order).toLowerCase();
    return userName.includes(needle) || itemsStr.includes(needle);
  };

  const withinDateRange = (order) => {
    if (!dateFrom && !dateTo) return true;
    const ts = new Date(order.createdAt).getTime();
    if (Number.isNaN(ts)) return false;
    let ok = true;
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00").getTime();
      ok = ok && ts >= from;
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59").getTime();
      ok = ok && ts <= to;
    }
    return ok;
  };

  const filtered = (Array.isArray(orders) ? orders : [])
    .filter((o) => (statusFilter === "all" ? true : o.status === statusFilter))
    .filter((o) => matchesSearch(o, search))
    .filter((o) => withinDateRange(o));

  const visibleOrders = [...filtered].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime() || 0;
    const bTime = new Date(b.createdAt).getTime() || 0;
    const aTotal = Number(a.totalAmount) || 0;
    const bTotal = Number(b.totalAmount) || 0;
    switch (sortBy) {
      case "created_asc": return aTime - bTime;
      case "total_desc":  return bTotal - aTotal;
      case "total_asc":   return aTotal - bTotal;
      case "created_desc":
      default:            return bTime - aTime;
    }
  });

  const safeCsv = (val) => {
    if (val == null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCsv = () => {
    const rows = visibleOrders.map((o) => ({
      id: o.id,
      user: o.User?.name || "",
      items: itemsToText(o),
      total: o.totalAmount,
      status: o.status,
      payment: `${o.paymentMethod || ""}/${o.paymentStatus || ""}`,
      createdAt: o.createdAt,
    }));
    const headers = ["Order ID", "User", "Items", "Total", "Status", "Payment", "Created At"];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [r.id, safeCsv(r.user), safeCsv(r.items), r.total, r.status, r.payment, r.createdAt ? new Date(r.createdAt).toLocaleString() : ""].join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `vendor-orders-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBack = () => {
    const canGoBack = (window.history?.state && window.history.state.idx > 0) || window.history.length > 1;
    if (canGoBack) navigate(-1);
    else navigate(DASHBOARD_PATH);
  };

  const paymentChip = (o) => {
    const method = o.paymentMethod || "cod";
    const status = o.paymentStatus || "unpaid";
    const label = `${method === "mock_online" ? "Online" : "COD"} · ${status}`;
    let color = "default";
    if (status === "paid") color = "success";
    else if (status === "refunded") color = "warning";
    else if (status === "processing") color = "info";
    else color = "default";
    return <Chip size="small" label={label} color={color} />;
  };

  const handleChangePage = (_e, newPage) => {
    setPage(newPage);
    loadOrders({ toPage: newPage, size: rowsPerPage });
  };
  const handleChangeRowsPerPage = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    loadOrders({ toPage: 0, size: newSize });
  };

  return (
    <>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" aria-label="Back to vendor dashboard" onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Vendor Orders
          </Typography>
          <Button onClick={() => navigate(DASHBOARD_PATH)} variant="outlined" size="small" sx={{ textTransform: "none" }}>
            Back to Dashboard
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 3 }}>
        <audio ref={audioRef} src={beepSrc} preload="auto" />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h5">Orders</Typography>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
            <TextField size="small" label="Search (user or item)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <TextField size="small" label="From" type="date" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <TextField size="small" label="To" type="date" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select labelId="status-filter-label" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
                <MenuItem value="ready">Ready</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-by-label">Sort by</InputLabel>
              <Select labelId="sort-by-label" label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <MenuItem value="created_desc">Newest first</MenuItem>
                <MenuItem value="created_asc">Oldest first</MenuItem>
                <MenuItem value="total_desc">Total: high → low</MenuItem>
                <MenuItem value="total_asc">Total: low → high</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel control={<Switch checked={realtime} onChange={(e) => setRealtime(e.target.checked)} />} label="Polling fallback" />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="poll-ms">Every</InputLabel>
              <Select labelId="poll-ms" label="Every" value={pollMs} onChange={(e) => setPollMs(Number(e.target.value))} disabled={!realtime}>
                <MenuItem value={10000}>10s</MenuItem>
                <MenuItem value={30000}>30s</MenuItem>
                <MenuItem value={60000}>60s</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title={soundOn ? "Sound on" : "Sound off"}>
              <IconButton onClick={() => setSoundOn((s) => !s)}>
                {soundOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
              </IconButton>
            </Tooltip>

            <IconButton onClick={() => loadOrders()} title="Refresh now">
              <RefreshIcon />
            </IconButton>

            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>
              Export CSV
            </Button>
          </Stack>
        </Stack>

        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Order #</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : visibleOrders.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">No orders found</TableCell></TableRow>
              ) : (
                visibleOrders.map((o) => {
                  const disabled = updatingId === o.id;
                  const lineItems = getLineItems(o);
                  const expandedRow = expanded.has(o.id);

                  return (
                    <React.Fragment key={o.id}>
                      <TableRow hover>
                        <TableCell width={48}>
                          <IconButton size="small" onClick={() => toggleExpand(o.id)} aria-label="expand">
                            {expandedRow ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>{o.id} {disabled && <CircularProgress size={14} sx={{ ml: 1 }} />}</TableCell>
                        <TableCell>{o.User?.name || "-"}</TableCell>
                        <TableCell>{itemsToText(o)}</TableCell>
                        <TableCell>₹{o.totalAmount}</TableCell>
                        <TableCell><Chip label={o.status} color={STATUS_COLORS[o.status] || "default"} /></TableCell>
                        <TableCell>{paymentChip(o)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            {o.status === "pending" && (
                              <>
                                <Button size="small" disabled={disabled} onClick={() => updateStatus(o.id, "accepted")}>Accept</Button>
                                <Button size="small" color="error" disabled={disabled} onClick={() => updateStatus(o.id, "rejected")}>Reject</Button>
                              </>
                            )}
                            {o.status === "accepted" && (
                              <Button size="small" disabled={disabled} onClick={() => updateStatus(o.id, "ready")}>Mark Ready</Button>
                            )}
                            {o.status === "ready" && (
                              <Button size="small" disabled={disabled} onClick={() => updateStatus(o.id, "delivered")}>Mark Delivered</Button>
                            )}

                            {o.paymentMethod === "cod" && o.paymentStatus === "unpaid" && (
                              <Button size="small" variant="outlined" onClick={() => markPaid(o.id)}>Mark Paid</Button>
                            )}

                            {/* OPEN INVOICE with auth header */}
                            <Button size="small" variant="text" onClick={() => openInvoice(o.id)}>
                              Receipt
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                          <Collapse in={expandedRow} timeout="auto" unmountOnExit>
                            <Box sx={{ px: 3, py: 2, bgcolor: "background.default" }}>
                              <Typography variant="subtitle1" gutterBottom>Order Details</Typography>
                              <Divider sx={{ mb: 2 }} />
                              {lineItems.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No line items</Typography>
                              ) : (
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Item</Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600, textAlign: "right" }}>Qty</Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600, textAlign: "right" }}>Price</Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600, textAlign: "right" }}>Line Total</Typography>

                                  {lineItems.map((it, idx) => (
                                    <React.Fragment key={idx}>
                                      <Typography variant="body2">{it.name}</Typography>
                                      <Typography variant="body2" sx={{ textAlign: "right" }}>{it.quantity}</Typography>
                                      <Typography variant="body2" sx={{ textAlign: "right" }}>
                                        {it.price != null ? `₹${it.price}` : "-"}
                                      </Typography>
                                      <Typography variant="body2" sx={{ textAlign: "right" }}>
                                        {it.price != null ? `₹${(Number(it.price) * Number(it.quantity || 1)).toFixed(2)}` : "-"}
                                      </Typography>
                                    </React.Fragment>
                                  ))}
                                </Box>
                              )}

                              <Divider sx={{ my: 2 }} />
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Placed: {o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Payment: {o.paymentMethod === "mock_online" ? "Online" : "COD"} · {o.paymentStatus || "unpaid"}
                                  {o.paidAt ? ` · Paid at: ${new Date(o.paidAt).toLocaleString()}` : ""}
                                </Typography>
                                <Typography variant="subtitle2">Total: ₹{o.totalAmount}</Typography>
                              </Stack>
                              {o.User?.email && (
                                <Typography variant="body2" color="text.secondary">User Email: {o.User.email}</Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </Paper>
      </Container>
    </>
  );
}