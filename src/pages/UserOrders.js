
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
} from "@mui/material";
import { Delete, Edit, Logout, ArrowBack, ReceiptLong } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API = process.env.REACT_APP_API_BASE_URL || "";

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

  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const safeArray = (v) => (Array.isArray(v) ? v : []);
  const safeJson = async (res) => { try { return await res.json(); } catch { return null; } };

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

  // ---------- data loaders (with pagination) ----------
  const fetchOrders = async (opts) => {
    if (!token) { navigate("/login"); return; }

    // allow explicit page/rows override (e.g., on socket refresh)
    const p = typeof opts?.page === "number" ? opts.page : page;
    const rpp = typeof opts?.rowsPerPage === "number" ? opts.rowsPerPage : rowsPerPage;

    setLoading(true);
    try {
      // Backend expects 1-based page
      const url = `${API}/api/orders/my?page=${p + 1}&pageSize=${rpp}`;
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

      // Paginated shape
      if (Array.isArray(data?.items) && typeof data?.total === "number") {
        setOrders(normalizeList(data.items));
        setTotal(Number(data.total) || 0);
        return;
      }

      // Legacy fallback: backend returned full array
      const list =
        Array.isArray(data) ? data :
        Array.isArray(data?.orders) ? data.orders :
        Array.isArray(data?.items) ? data.items : [];

      const normalized = normalizeList(list);
      setTotal(normalized.length);

      // client-side slice to emulate pagination
      const start = p * rpp;
      const pageSlice = normalized.slice(start, start + rpp);
      setOrders(pageSlice);
    } catch (_err) {
      setError("Failed to fetch orders.");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders({ page: 0 }); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchOrders({ page, rowsPerPage }); /* eslint-disable-next-line */ }, [page, rowsPerPage]);

  // ---------- sockets (live updates) ----------
  useEffect(() => {
    if (!user?.id) return;

    const join = () => { try { socket.emit("user:join", user.id); } catch {} };
    join();
    const onConnect = () => { join(); fetchOrders(); };

    const refill = () => fetchOrders({ page, rowsPerPage });

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

    const onPayProcessing = () => refill();
    const onPaySuccess = () => refill();
    const onPayFailed = () => refill();

    socket.on("connect", onConnect);
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("payment:processing", onPayProcessing);
    socket.on("payment:success", onPaySuccess);
    socket.on("payment:failed", onPayFailed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("payment:processing", onPayProcessing);
      socket.off("payment:success", onPaySuccess);
      socket.off("payment:failed", onPayFailed);
    };
  }, [user?.id, page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // After delete, refetch the current page (handles last-row-on-page deletion gracefully)
        const newTotal = Math.max(0, total - 1);
        const maxPageIndex = Math.max(0, Math.ceil(newTotal / rowsPerPage) - 1);
        const nextPage = Math.min(page, maxPageIndex);
        setTotal(newTotal);
        setPage(nextPage);
        fetchOrders({ page: nextPage, rowsPerPage });
        setOpenDialog(false);
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Delete failed");
      }
    } catch (_err) {
      setError("Server error during delete");
    }
  };

  const openInvoice = async (orderId) => {
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
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
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (_e) {
      toast.error("Network error while opening invoice");
    }
  };

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };
  const confirmDelete = (id) => { setOrderToDelete(id); setOpenDialog(true); };

  // ---------- pagination handlers ----------
  const handleChangePage = (_evt, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (evt) => {
    const value = parseInt(evt.target.value, 10) || 10;
    setRowsPerPage(value);
    setPage(0); // reset to first page
  };

  return (
    <Container>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">My Orders</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button variant="contained" color="secondary" onClick={handleLogout} startIcon={<Logout />}>
            Logout
          </Button>
        </Stack>
      </Stack>

      {error && <Snackbar open autoHideDuration={6000} message={error} />}

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
                  return (
                    <TableRow key={order.id}>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.Vendor?.name || "-"}</TableCell>
                      <TableCell>{order.status}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={payMethod === "mock_online" ? "Online" : "COD"} variant="outlined" />
                          <Chip
                            size="small"
                            label={payStatus}
                            color={
                              payStatus === "paid" ? "success"
                              : payStatus === "processing" ? "info"
                              : payStatus === "failed" ? "error"
                              : "default"
                            }
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>{rupee(order.totalAmount)}</TableCell>
                      <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</TableCell>
                      <TableCell align="right">
                        <Tooltip
                          title={items.length
                            ? items.map((it) => `${it.name} × ${it.quantity} = ${rupee(it.price * it.quantity)}`).join("\n")
                            : "No items"}
                        >
                          <span />
                        </Tooltip>

                        <IconButton onClick={() => openInvoice(order.id)} title="Receipt">
                          <ReceiptLong />
                        </IconButton>

                        {/* Delete */}
                        <IconButton color="error" onClick={() => confirmDelete(order.id)} title="Delete">
                          <Delete />
                        </IconButton>
                        <IconButton disabled title="Edit (disabled)">
                          <Edit />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">No orders yet</TableCell>
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
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
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
    </Container>
  );
}