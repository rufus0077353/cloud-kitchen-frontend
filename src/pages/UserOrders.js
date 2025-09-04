
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Box,
} from "@mui/material";
import {
  Delete,
  Edit,
  Logout,
  ArrowBack,
  ReceiptLong,
} from "@mui/icons-material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StorefrontIcon from "@mui/icons-material/Storefront";
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
  return <Chip label={status} color={STATUS_COLORS[status] || "default"} size="small" />;
}

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // pagination state
  const [page, setPage] = useState(0); // MUI is 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // status filter
  const [statusFilter, setStatusFilter] = useState("all");

  // cart drawer
  const [openCart, setOpenCart] = useState(false);
  const { totalQty } = useCart();

  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const safeArray = (v) => (Array.isArray(v) ? v : []);
  const safeJson = async (res) => {
    try { return await res.json(); } catch { return null; }
  };

  const normalizeList = (list) => {
    const map = new Map();
    for (const o of safeArray(list)) {
      if (!o?.id) continue;
      map.set(o.id, { ...(map.get(o.id) || {}), ...o });
    }
    return [...map.values()].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at || (Number(b.id) - Number(a.id));
    });
  };

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
        quantity: mi.OrderItem?.quantity ?? 1,
        price: mi.price ?? 0,
      }));
    }
    return [];
  };

  const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

  // ---------- data loaders (supports server + client pagination depending on filter) ----------
  const fetchOrders = async (opts = {}) => {
    if (!token) { navigate("/login"); return; }

    // allow explicit page/rows override
    const p = typeof opts.page === "number" ? opts.page : page;
    const rpp = typeof opts.rowsPerPage === "number" ? opts.rowsPerPage : rowsPerPage;
    const status = opts.statusFilter ?? statusFilter;

    setLoading(true);
    try {
      // If filtering by a specific status, pull full list once (backend legacy mode page=0), then filter client-side
      const url =
        status === "all"
          ? `${API}/api/orders/my?page=${p + 1}&pageSize=${rpp}`
          : `${API}/api/orders/my?page=0`; // 0 => legacy return all

      const res = await fetch(url, { headers });

      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }

      const data = await safeJson(res);
      if (!res.ok) {
        setError(data?.message || "Failed to fetch orders.");
        setOrders([]);
        setTotal(0);
        return;
      }

      // Normalized list from any payload shape
      const list =
        Array.isArray(data?.items) && typeof data?.total === "number"
          ? data.items
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data?.items)
          ? data.items
          : [];

      const normalized = normalizeList(list);

      if (status === "all") {
        // Server-side pagination path
        if (Array.isArray(data?.items) && typeof data?.total === "number") {
          setOrders(normalizeList(data.items));
          setTotal(Number(data.total) || 0);
        } else {
          // fallback to client slice
          setTotal(normalized.length);
          const start = p * rpp;
          setOrders(normalized.slice(start, start + rpp));
        }
      } else {
        // Client-side filter + paginate
        const filtered = normalized.filter((o) => o.status === status);
        setTotal(filtered.length);
        const start = p * rpp;
        setOrders(filtered.slice(start, start + rpp));
      }
    } catch (err) {
      setError("Failed to fetch orders.");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    fetchOrders({ page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When page/rowsPerPage/statusFilter change, (re)fetch
  useEffect(() => {
    fetchOrders({ page, rowsPerPage, statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter]);

  // ---------- sockets (live updates) ----------
  useEffect(() => {
    if (!user?.id) return;

    const join = () => { try { socket.emit("user:join", user.id); } catch {} };
    join();
    const onConnect = () => { join(); fetchOrders({ page, rowsPerPage, statusFilter }); };

    const refill = () => fetchOrders({ page, rowsPerPage, statusFilter });

    const onNew = (fullOrder) => {
      if (Number(fullOrder?.UserId) !== Number(user.id)) return;
      refill();
      toast.info(`New order #${fullOrder?.id ?? ""} placed`);
    };

    const onStatus = (payload) => {
      if (Number(payload?.UserId) !== Number(user.id)) return;
      refill();
      toast.success(`Order #${payload?.id ?? ""} is now ${payload?.status}`);
    };

    // (keep existing custom events if your app uses them)
    const onPayProcessing = () => refill();
    const onPaySuccess = () => refill();
    const onPayFailed = () => refill();

    socket.on("connect", onConnect);
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("payment:processing", onPayProcessing);
    socket.on("payment:success", onPaySuccess);
    socket.on("payment:failed", onPayFailed);
    socket.on("order:payment", refill); // new backend event

    return () => {
      socket.off("connect", onConnect);
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("payment:processing", onPayProcessing);
      socket.off("payment:success", onPaySuccess);
      socket.off("payment:failed", onPayFailed);
      socket.off("order:payment", refill);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, rowsPerPage, statusFilter]);

  // ---------- actions ----------
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}`, { method: "DELETE", headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }
      if (res.ok) {
        const newTotal = Math.max(0, total - 1);
        const maxPageIndex = Math.max(0, Math.ceil(newTotal / rowsPerPage) - 1);
        const nextPage = Math.min(page, maxPageIndex);
        setTotal(newTotal);
        setPage(nextPage);
        fetchOrders({ page: nextPage, rowsPerPage, statusFilter });
        setOpenDialog(false);
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Delete failed");
      }
    } catch (err) {
      setError("Server error during delete");
    }
  };

  const cancelOrder = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}/cancel`, {
        method: "PATCH",
        headers,
      });

      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }

      const data = await safeJson(res);
      if (!res.ok) {
        toast.error(data?.message || "Failed to cancel order");
        return;
      }

      toast.success("Order cancelled");
      // refresh current page
      fetchOrders({ page, rowsPerPage, statusFilter });
    } catch (err) {
      toast.error("Network error while cancelling order");
    }
  };

  const openInvoice = async (orderId, { pdf = false } = {}) => {
  try {
    const endpoint = pdf ? `${API}/api/orders/${orderId}/invoice.pdf` : `${API}/api/orders/${orderId}/invoice`;
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 401) {
      toast.error("Session expired. Please log in again.");
      localStorage.clear();
      (navigate ? navigate("/login") : (window.location.href = "/login"));
      return;
    }
    if (!res.ok) {
      const msg = (await res.text().catch(() => "")) || "Failed to load invoice";
      toast.error(msg);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
   } catch (e) {
    toast.error("Network error while opening invoice");
   } 
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };
  const confirmDelete = (id) => { setOrderToDelete(id); setOpenDialog(true); };

  // ---------- pagination handlers ----------
  const handleChangePage = (_evt, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (evt) => {
    const value = parseInt(evt.target.value, 10) || 10;
    setRowsPerPage(value);
    setPage(0); // reset to first page
  };

  // tooltip content helper to preserve newlines
  const ItemsTooltip = ({ items }) => (
    <Box sx={{ whiteSpace: "pre-line" }}>
      {items.length
        ? items.map((it) => `${it.name} × ${it.quantity} = ${rupee(it.price * it.quantity)}`).join("\n")
        : "No items"}
    </Box>
  );

  return (
    <Container>
      {/* Header with back, vendors, cart & checkout */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">My Orders</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button variant="outlined" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
            Browse Vendors
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
          <Button variant="contained" color="primary" onClick={() => navigate("/checkout")} disabled={!totalQty}>
            Go to Checkout
          </Button>
          <Button variant="contained" color="secondary" onClick={handleLogout} startIcon={<Logout />}>
            Logout
          </Button>
        </Stack>
      </Stack>

      {/* Status Filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="status-filter">Status</InputLabel>
          <Select
            labelId="status-filter"
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="ready">Ready</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Snackbar
          open
          onClose={() => setError("")}
          autoHideDuration={6000}
          message={error}
        />
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Stack direction="row" gap={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                      <CircularProgress size={20} /> <span>Loading…</span>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : safeArray(orders).length ? (
                safeArray(orders).map((order) => {
                  const items = getLineItems(order);
                  const payMethod = order.paymentMethod || "cod";
                  const payStatus = order.paymentStatus || "unpaid";
                  const canCancel = order.status === "pending" && payStatus !== "paid";

                  return (
                    <TableRow key={order.id} hover>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.Vendor?.name || "-"}</TableCell>
                      <TableCell>
                        <StatusChip status={order.status} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PaymentBadge status={order.paymentStatus} />
                          <Chip size="small" label={payMethod === "mock_online" ? "Online" : "COD"} variant="outlined" />
                        </Stack>
                      </TableCell>
                      <TableCell>{rupee(order.totalAmount)}</TableCell>
                      <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</TableCell>
                      <TableCell align="right">
                        {/* Items tooltip on the receipt icon; preserves newlines */}
                        <Tooltip title={<ItemsTooltip items={items} />}>
                          <span>
                            <IconButton onClick={() => openInvoice(order.id)} title="Receipt">
                              <ReceiptLong />
                            </IconButton>
                            <IconButton
                              onClick={() => openInvoice(order.id, { pdf: true })}
                              title="Download PDF">PDF</IconButton>
                          </span>
                        </Tooltip>

                        <Button
                          size="small"
                          color="warning"
                          variant="outlined"
                          onClick={() => cancelOrder(order.id)}
                          sx={{ mr: 1 }}
                          disabled={!canCancel}
                        >
                          Cancel Order
                        </Button>

                        <Button size="small" onClick={() => navigate(`/track/${order.id}`)}>
                          Track
                        </Button>

                        {/* Delete */}
                        <IconButton color="error" onClick={() => confirmDelete(order.id)} title="Delete">
                          <Delete />
                        </IconButton>

                        {/* (Optional) Edit disabled placeholder */}
                        <IconButton disabled title="Edit (disabled)">
                          <Edit />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        No orders found.
                      </Typography>
                      <Button variant="outlined" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
                        Browse Vendors
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination bar */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10) || 10); setPage(0); }}
          rowsPerPageOptions={[5, 10, 20, 50]}
          labelRowsPerPage="Per page:"
        />
      </Paper>

      {/* Delete confirmation dialog */}
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