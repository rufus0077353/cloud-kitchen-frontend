
// src/pages/UserOrders.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel,
  MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tooltip, Typography,
  Badge, Skeleton, Fade, IconButton
} from "@mui/material";
import {
  ArrowBack, Delete, Download as DownloadIcon, Edit, Logout,
  ReceiptLong, ShoppingCart as ShoppingCartIcon, Storefront as StorefrontIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import CartDrawer from "../components/CartDrawer";
import { useCart } from "../context/CartContext";
import PaymentBadge from "../components/PaymentBadge";

const API = process.env.REACT_APP_API_BASE_URL || "";

/* ---------- status chip helper ---------- */
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

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // cart drawer
  const [openCart, setOpenCart] = useState(false);
  const { totalQty } = useCart();

  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

  // unify line items for tooltip
  const getLineItems = (order) => {
    if (Array.isArray(order?.OrderItems)) {
      return order.OrderItems.map((oi) => ({
        name: oi.MenuItem?.name || "Item",
        quantity: oi.quantity ?? 1,
        price: oi.MenuItem?.price ?? 0,
      }));
    }
    if (Array.isArray(order?.MenuItems)) {
      return order.MenuItems.map((mi) => ({
        name: mi.name,
        quantity: mi?.OrderItem?.quantity ?? 1,
        price: mi.price ?? 0,
      }));
    }
    return [];
  };

  const ItemsTooltip = ({ items }) => (
    <Box sx={{ whiteSpace: "pre-line" }}>
      {items.length
        ? items
            .map((it) => `${it.name} × ${it.quantity} = ${rupee(Number(it.price) * Number(it.quantity))}`)
            .join("\n")
        : "No items"}
    </Box>
  );

  /** Robustly pick array + total from any payload shape */
  const normalizePayload = (data) => {
    if (!data) return { list: [], total: 0 };
    if (Array.isArray(data?.items) && typeof data?.total === "number") {
      return { list: data.items, total: Number(data.total) };
    }
    if (Array.isArray(data?.orders)) {
      return { list: data.orders, total: data.orders.length };
    }
    if (Array.isArray(data?.rows)) {
      return { list: data.rows, total: Number(data?.count ?? data.rows.length) };
    }
    if (Array.isArray(data)) {
      return { list: data, total: data.length };
    }
    // some APIs wrap as {data:[...]}
    if (Array.isArray(data?.data)) {
      return { list: data.data, total: data.data.length };
    }
    return { list: [], total: 0 };
  };

  /** Sort newest first, tolerant of createdAt/created_at missing */
  const sortOrders = (arr) =>
    [...arr].sort((a, b) => {
      const aT = new Date(a.createdAt || a.created_at || 0).getTime();
      const bT = new Date(b.createdAt || b.created_at || 0).getTime();
      return bT - aT || Number(b.id) - Number(a.id);
    });

  /**
   * Fetch orders with fallbacks:
   * 1) /api/orders/my?page=&pageSize=
   * 2) /api/orders/my
   * 3) /api/orders  (last resort)
   */
  const fetchOrders = async (opts = {}) => {
    if (!token) {
      navigate("/login");
      return;
    }

    const p = typeof opts.page === "number" ? opts.page : page;
    const rpp = typeof opts.rowsPerPage === "number" ? opts.rowsPerPage : rowsPerPage;
    const status = opts.statusFilter ?? statusFilter;

    setLoading(true);
    try {
      const endpoints = [
        status === "all"
          ? `${API}/api/orders/my?page=${p + 1}&pageSize=${rpp}`
          : `${API}/api/orders/my?page=0`,
        `${API}/api/orders/my`,
        `${API}/api/orders`,
      ];

      let got = { list: [], total: 0 };
      for (const url of endpoints) {
        const res = await fetch(url, { headers, credentials: "include" });
        if (res.status === 401) {
          toast.error("Session expired. Please log in again.");
          localStorage.clear();
          navigate("/login");
          return;
        }
        // ignore 404/204 silently and try next endpoint
        if (!res.ok) continue;

        const data = await res.json().catch(() => null);
        const { list, total: t } = normalizePayload(data);
        if (list.length) {
          got = { list, total: t || list.length };
          break;
        }
        // if server gave items but empty, still preserve "total"
        got = { list, total: t || 0 };
      }

      const all = sortOrders(got.list);

      if (status === "all") {
        // If the first endpoint returned paged items + total, keep as-is;
        // otherwise slice client-side
        if (got.total > all.length) {
          setOrders(all); // server already paginated; `total` > current length
          setTotal(got.total);
        } else {
          const start = p * rpp;
          setOrders(all.slice(start, start + rpp));
          setTotal(all.length);
        }
      } else {
        const filtered = all.filter((o) => String(o.status) === status);
        const start = p * rpp;
        setOrders(filtered.slice(start, start + rpp));
        setTotal(filtered.length);
      }
    } catch (e) {
      setError("Failed to fetch orders");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // initial
  useEffect(() => {
    fetchOrders({ page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to controls
  useEffect(() => {
    fetchOrders({ page, rowsPerPage, statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter]);

  // live updates via socket
  useEffect(() => {
    if (!user?.id) return;

    const join = () => { try { socket.emit("user:join", user.id); } catch {} };
    const refill = () => fetchOrders({ page, rowsPerPage, statusFilter });

    join();
    const onConnect = () => { join(); refill(); };
    const onNew = (fullOrder) => {
      if (Number(fullOrder?.UserId) !== Number(user.id)) return;
      toast.info(`New order #${fullOrder?.id ?? ""} placed`);
      refill();
    };
    const onStatus = (payload) => {
      if (Number(payload?.UserId) !== Number(user.id)) return;
      toast.success(`Order #${payload?.id ?? ""} is now ${payload?.status}`);
      refill();
    };

    socket.on("connect", onConnect);
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("payment:processing", refill);
    socket.on("payment:success", refill);
    socket.on("payment:failed", refill);
    socket.on("order:payment", refill);

    return () => {
      socket.off("connect", onConnect);
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("payment:processing", refill);
      socket.off("payment:success", refill);
      socket.off("payment:failed", refill);
      socket.off("order:payment", refill);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, rowsPerPage, statusFilter]);

  const cancelOrder = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}/cancel`, {
        method: "PATCH",
        headers,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data?.message || "Failed to cancel order");
      toast.success("Order cancelled");
      fetchOrders({ page, rowsPerPage, statusFilter });
    } catch {
      toast.error("Network error while cancelling");
    }
  };

  const openInvoice = async (id, pdf = false) => {
    try {
      const endpoint = pdf ? `${API}/api/orders/${id}/invoice.pdf` : `${API}/api/orders/${id}/invoice`;
      const res = await fetch(endpoint, { headers, credentials: "include" });
      if (!res.ok) return toast.error("Invoice not found");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Failed to open invoice");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}`, { method: "DELETE", headers, credentials: "include" });
      if (!res.ok) return toast.error("Delete failed");
      toast.info("Order deleted");
      setOpenDialog(false);
      const newTotal = Math.max(0, total - 1);
      const maxPageIndex = Math.max(0, Math.ceil(newTotal / rowsPerPage) - 1);
      const nextPage = Math.min(page, maxPageIndex);
      setPage(nextPage);
      fetchOrders({ page: nextPage, rowsPerPage, statusFilter });
    } catch {
      toast.error("Server error while deleting");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const EmptyState = () => (
    <Fade in timeout={400}>
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          No orders found.
        </Typography>
        <Button variant="outlined" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
          Browse Vendors
        </Button>
      </Box>
    </Fade>
  );

  return (
    <Container sx={{ py: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>My Orders</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>Back</Button>
          <Button startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>Browse</Button>
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
          <Button variant="contained" onClick={() => navigate("/checkout")} disabled={!totalQty}>
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
                  <TableRow>
                    <TableCell colSpan={7}><EmptyState /></TableCell>
                  </TableRow>
                )
                : orders.map((o) => {
                    const payMethod = o.paymentMethod || "cod";
                    const canCancel = o.status === "pending" && o.paymentStatus !== "paid";
                    const items = getLineItems(o);

                    return (
                      <TableRow key={o.id} hover>
                        <TableCell>#{o.id}</TableCell>
                        <TableCell>{o.Vendor?.name || "-"}</TableCell>
                        <TableCell><StatusChip status={o.status} /></TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PaymentBadge status={o.paymentStatus} />
                            <Chip size="small" label={payMethod === "mock_online" ? "Online" : "COD"} />
                          </Stack>
                        </TableCell>
                        <TableCell>{rupee(o.totalAmount)}</TableCell>
                        <TableCell>{o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleString() : "-"}</TableCell>
                        <TableCell align="right">
                          <Tooltip title={<ItemsTooltip items={items} />}>
                            <span>
                              <IconButton onClick={() => openInvoice(o.id)} aria-label="Receipt">
                                <ReceiptLong />
                              </IconButton>
                              <IconButton onClick={() => openInvoice(o.id, true)} aria-label="PDF">
                                <DownloadIcon />
                              </IconButton>
                            </span>
                          </Tooltip>

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
                          <Button size="small" onClick={() => navigate(`/track/${o.id}`)}>Track</Button>

                          <IconButton color="error" onClick={() => { setOrderToDelete(o.id); setOpenDialog(true); }} aria-label="Delete">
                            <Delete />
                          </IconButton>
                          <IconButton disabled aria-label="Edit"><Edit /></IconButton>
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
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10) || 10); setPage(0); }}
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

      {/* Cart Drawer */}
      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />
    </Container>
  );
