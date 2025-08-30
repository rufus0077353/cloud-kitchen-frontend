
// src/pages/UserOrders.js
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
} from "@mui/material";
import { Delete, Edit, Logout } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function UserOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const safeJson = async (res) => {
    try { return await res.json(); } catch { return null; }
  };

  // ---------- helpers ----------
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

  // ---------- data loaders ----------
  const fetchOrders = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const res = await fetch(`${API}/api/orders/my`, { headers });
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
        return;
      }
      // Accept either an array or an object like { orders: [...] }
      const list = Array.isArray(data) ? data : Array.isArray(data?.orders) ? data.orders : [];
      setOrders(list);
    } catch (err) {
      setError("Failed to fetch orders.");
      setOrders([]);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- sockets (live updates) ----------
  useEffect(() => {
    if (!user?.id) return;

    // join personal room
    socket.emit("user:join", user.id);

    const onNew = (fullOrder) => {
      if (Number(fullOrder?.UserId) !== Number(user.id)) return;
      setOrders((prev) => {
        const arr = safeArray(prev);
        const exists = arr.some((o) => o.id === fullOrder.id);
        return exists ? arr.map((o) => (o.id === fullOrder.id ? { ...o, ...fullOrder } : o)) : [fullOrder, ...arr];
      });
      toast.info(`New order #${fullOrder?.id ?? ""} placed`);
    };

    const onStatus = (payload) => {
      if (Number(payload?.UserId) !== Number(user.id)) return;
      setOrders((prev) =>
        safeArray(prev).map((o) => (o.id === payload.id ? { ...o, status: payload.status } : o))
      );
      toast.success(`Order #${payload?.id ?? ""} is now ${payload?.status}`);
    };

    // mock payment events
    const onPayProcessing = (p) => {
      if (!p?.id) return;
      setOrders((prev) => safeArray(prev).map((o) => (o.id === p.id ? { ...o, paymentStatus: "processing" } : o)));
    };
    const onPaySuccess = (p) => {
      if (!p?.id) return;
      setOrders((prev) => safeArray(prev).map((o) => (o.id === p.id ? { ...o, paymentStatus: "paid" } : o)));
    };
    const onPayFailed = (p) => {
      if (!p?.id) return;
      setOrders((prev) => safeArray(prev).map((o) => (o.id === p.id ? { ...o, paymentStatus: "failed" } : o)));
    };

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("payment:processing", onPayProcessing);
    socket.on("payment:success", onPaySuccess);
    socket.on("payment:failed", onPayFailed);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("payment:processing", onPayProcessing);
      socket.off("payment:success", onPaySuccess);
      socket.off("payment:failed", onPayFailed);
    };
  }, [user?.id]);

  // ---------- actions ----------
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/api/orders/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }
      if (res.ok) {
        setOrders((prev) => safeArray(prev).filter((order) => order.id !== id));
        setOpenDialog(false);
      } else {
        const data = await safeJson(res);
        setError(data?.message || "Delete failed");
      }
    } catch (err) {
      setError("Server error during delete");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const confirmDelete = (id) => {
    setOrderToDelete(id);
    setOpenDialog(true);
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        My Orders
      </Typography>

      <Button
        variant="contained"
        color="secondary"
        onClick={handleLogout}
        startIcon={<Logout />}
        sx={{ mb: 2 }}
      >
        Logout
      </Button>

      {error && <Snackbar open autoHideDuration={6000} message={error} />}

      <TableContainer component={Paper}>
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
            {safeArray(orders).map((order) => {
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
                          payStatus === "paid"
                            ? "success"
                            : payStatus === "processing"
                            ? "info"
                            : payStatus === "failed"
                            ? "error"
                            : "default"
                        }
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>{rupee(order.totalAmount)}</TableCell>
                  <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={
                        items.length
                          ? items.map((it) => `${it.name} × ${it.quantity} = ${rupee(it.price * it.quantity)}`).join("\n")
                          : "No items"
                      }
                    >
                      <span />
                    </Tooltip>
                    <IconButton color="error" onClick={() => confirmDelete(order.id)}>
                      <Delete />
                    </IconButton>
                    <IconButton disabled>
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {safeArray(orders).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No orders yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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