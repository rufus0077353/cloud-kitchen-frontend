
// src/pages/UserOrders.js  — polished UX version
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
  ReceiptLong, ShoppingCart as ShoppingCartIcon, Storefront as StorefrontIcon,
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openCart, setOpenCart] = useState(false);
  const { totalQty } = useCart();
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

  const fetchOrders = async (opts = {}) => {
    if (!token) return navigate("/login");
    const p = opts.page ?? page;
    const rpp = opts.rowsPerPage ?? rowsPerPage;
    const status = opts.statusFilter ?? statusFilter;
    setLoading(true);
    try {
      const url =
        status === "all"
          ? `${API}/api/orders/my?page=${p + 1}&pageSize=${rpp}`
          : `${API}/api/orders/my?page=0`;
      const res = await fetch(url, { headers, credentials: "include" });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear(); navigate("/login"); return;
      }
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];
      const filtered = status === "all" ? list : list.filter((o) => o.status === status);
      setOrders(filtered);
      setTotal(filtered.length);
    } catch {
      setError("Failed to fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders({ page: 0 }); }, []); // initial
  useEffect(() => { fetchOrders({ page, rowsPerPage, statusFilter }); }, [page, rowsPerPage, statusFilter]);

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
      if (!res.ok) return toast.error("Delete failed");
      toast.info("Order deleted");
      setOpenDialog(false);
      fetchOrders({ page, rowsPerPage, statusFilter });
    } catch {
      toast.error("Server error");
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
          No orders yet.
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
          <Button startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
            Browse
          </Button>
          <Button
            variant="outlined"
            startIcon={
              <Badge color="primary" badgeContent={totalQty} invisible={!totalQty}>
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
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton height={40} /></TableCell>
                    </TableRow>
                  ))
                : orders.length === 0
                ? (
                  <TableRow><TableCell colSpan={7}><EmptyState /></TableCell></TableRow>
                )
                : orders.map((o) => {
                    const payMethod = o.paymentMethod || "cod";
                    const canCancel = o.status === "pending" && o.paymentStatus !== "paid";
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
                        <TableCell>{new Date(o.createdAt).toLocaleString()}</TableCell>
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

      {/* Cart Drawer */}
      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />
    </Container>
  );
}