
// src/pages/UserOrders.js — resilient fetch with fallbacks + Refresh
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel,
  MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tooltip, Typography,
  Badge, Skeleton, Fade, IconButton, Rating
} from "@mui/material";
import {
  ArrowBack, Delete, Download as DownloadIcon, Edit, Logout,
  ReceiptLong, ShoppingCart as ShoppingCartIcon, Storefront as StorefrontIcon,
  Refresh as RefreshIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import CartDrawer from "../components/CartDrawer";
import { useCart } from "../context/CartContext";
import PaymentBadge from "../components/PaymentBadge";
import RateOrderDialog from "../components/RateOrderDialog";

const API = process.env.REACT_APP_API_BASE_URL || "";

/* ---------- helpers ---------- */
const STATUS_COLORS = {
  pending: "default",
  accepted: "primary",
  ready: "warning",
  delivered: "success",
  rejected: "error",
};
function StatusChip({ status }) {
  return (
    <Chip
      label={status}
      color={STATUS_COLORS[status] || "default"}
      size="small"
      variant="filled"
      sx={{ textTransform: "capitalize" }}
    />
  );
}
const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;
const safeArray = (v) => (Array.isArray(v) ? v : []);

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openCart, setOpenCart] = useState(false);

  // rating dialog
  const [rateOpen, setRateOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState(null);

  const { totalQty } = useCart();
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // --- normalize any backend shape into a stable array ---
  const normalize = (data) => {
    const list =
      Array.isArray(data?.items) && typeof data?.total === "number"
        ? data.items
        : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];
    // newest first
    return [...list].sort(
      (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
    );
  };

  // --- resilient fetch that tries multiple endpoints/shapes ---
  const fetchOrders = async (opts = {}) => {
    if (!token) { navigate("/login"); return; }

    const p = opts.page ?? page;
    const rpp = opts.rowsPerPage ?? rowsPerPage;
    const status = opts.statusFilter ?? statusFilter;

    const urlCandidates =
      status === "all"
        ? [
            `${API}/api/orders/my?page=${p + 1}&pageSize=${rpp}`, // preferred paginated
            `${API}/api/orders/my`,                               // full list (fallback)
            `${API}/api/orders/my?page=0`,                        // some backends treat 0 as "all"
          ]
        : [
            `${API}/api/orders/my?page=0`,
            `${API}/api/orders/my`,
          ];

    setLoading(true);
    try {
      let got = null;
      for (const url of urlCandidates) {
        const res = await fetch(url, { headers, credentials: "include" });
        if (res.status === 401) {
          toast.error("Session expired. Please log in again.");
          localStorage.clear(); navigate("/login"); return;
        }
        if (!res.ok) continue;
        const payload = await res.json().catch(() => null);
        const list = normalize(payload);
        // accept if we have data or this is the last candidate
        if (list.length || url === urlCandidates[urlCandidates.length - 1]) {
          got = { list, raw: payload };
          break;
        }
      }

      const full = got?.list ?? [];
      const filtered = status === "all" ? full : full.filter((o) => o.status === status);
      // if the very first (paginated) call returned items+total, prefer its total
      let totalCount =
        typeof got?.raw?.total === "number" ? Number(got.raw.total) : filtered.length;

      setOrders(filtered);
      setTotal(totalCount);
    } catch (e) {
      console.error("orders fetch error", e);
      setError("Failed to fetch orders");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders({ page: 0 }); }, []); // initial load
  useEffect(() => { fetchOrders({ page, rowsPerPage, statusFilter }); },
    [page, rowsPerPage, statusFilter]);

  // live updates
  useEffect(() => {
    if (!user?.id) return;
    const refill = () => fetchOrders({ page, rowsPerPage, statusFilter });
    try { socket.emit("user:join", user.id); } catch {}
    socket.on("order:new", refill);
    socket.on("order:status", refill);
    socket.on("order:payment", refill);
    return () => {
      socket.off("order:new", refill);
      socket.off("order:status", refill);
      socket.off("order:payment", refill);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, rowsPerPage, statusFilter]);

  const cancelOrder = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}/cancel`, {
        method: "PATCH", headers, credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data?.message || "Cancel failed");
      toast.success("Order cancelled");
      fetchOrders({ page, rowsPerPage, statusFilter });
    } catch {
      toast.error("Network error");
    }
  };

  const openInvoice = async (id, pdf = false) => {
    try {
      const endpoint = pdf ? `${API}/api/orders/${id}/invoice.pdf` : `${API}/api/orders/${id}/invoice`;
      const res = await fetch(endpoint, { headers, credentials: "include" });
      if (!res.ok) return toast.error("Invoice not found");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Failed to open invoice");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}`, { method: "DELETE", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data?.message || "Delete failed");
      toast.info("Order deleted");
      setOpenDialog(false);
      fetchOrders({ page, rowsPerPage, statusFilter });
    } catch {
      toast.error("Server error");
    }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const EmptyState = () => (
    <Fade in timeout={400}>
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          No orders yet.
        </Typography>
        <Button variant="outlined" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
          Browse Vendors
        </Button>
      </Box>
    </Fade>
  );

  const onRated = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  };

  return (
    <Container sx={{ py: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>My Orders</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Back</Button>
          <Button startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
            Browse
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => fetchOrders({ page, rowsPerPage, statusFilter })}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={
              <Badge color="primary" badgeContent={useCart().totalQty} invisible={!useCart().totalQty}>
                <ShoppingCartIcon />
              </Badge>
            }
            onClick={() => setOpenCart(true)}
          >
            Cart
          </Button>
          <Button variant="contained" onClick={() => navigate("/checkout")} disabled={!useCart().totalQty}>
            Checkout
          </Button>
          <Button color="secondary" variant="contained" startIcon={<Logout />} onClick={handleLogout}>
            Logout
          </Button>
        </Stack>
      </Stack>

      {/* Filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            {["all", "pending", "accepted", "ready", "delivered", "rejected"].map((s) => (
              <MenuItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Snackbar open autoHideDuration={5000} message={error} onClose={() => setError("")} />
      )}

      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {["Order ID", "Vendor", "Status", "Payment", "Total", "Created", "Actions"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton height={40} /></TableCell></TableRow>
                  ))
                : orders.length === 0
                ? (
                  <TableRow><TableCell colSpan={7}><EmptyState /></TableCell></TableRow>
                )
                : orders.map((o) => {
                    const payMethod = o.paymentMethod || "cod";
                    const canCancel = o.status === "pending" && o.paymentStatus !== "paid";
                    const isDelivered = o.status === "delivered";
                    return (
                      <TableRow key={o.id} hover>
                        <TableCell>#{o.id}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography>{o.Vendor?.name || "-"}</Typography>
                            {o.rating ? <Rating value={Number(o.rating)} readOnly size="small" /> : null}
                          </Stack>
                        </TableCell>
                        <TableCell><StatusChip status={o.status} /></TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PaymentBadge status={o.paymentStatus} />
                            <Chip size="small" label={payMethod === "mock_online" ? "Online" : "COD"} />
                          </Stack>
                        </TableCell>
                        <TableCell>{rupee(o.totalAmount)}</TableCell>
                        <TableCell>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Receipt (HTML)">
                            <IconButton onClick={() => openInvoice(o.id)}>
                              <ReceiptLong />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download PDF">
                            <IconButton onClick={() => openInvoice(o.id, true)}>
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>

                          {isDelivered && !o.rating && (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ mr: 1 }}
                              onClick={() => { setRateTarget(o); setRateOpen(true); }}
                            >
                              Rate
                            </Button>
                          )}

                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mr: 1 }}
                            onClick={() => cancelOrder(o.id)}
                            disabled={!canCancel}
                          >
                            Cancel
                          </Button>

                          <Button size="small" onClick={() => navigate(`/track/${o.id}`)}>
                            Track
                          </Button>

                          <IconButton color="error" onClick={() => { setOrderToDelete(o.id); setOpenDialog(true); }}>
                            <Delete />
                          </IconButton>
                          <IconButton disabled><Edit /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
          rowsPerPageOptions={[5, 10, 20]}
          labelRowsPerPage="Rows:"
        />
      </Paper>

      {/* Delete confirmation */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Delete Order</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this order?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button color="error" onClick={() => handleDelete(orderToDelete)}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Rate dialog */}
      <RateOrderDialog
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        order={rateTarget}
        onRated={onRated}
      />

      {/* Cart Drawer */}
      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />
    </Container>
  );
}