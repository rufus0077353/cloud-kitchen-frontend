
// src/pages/TrackOrder.js
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Paper, Stack, Typography, Chip, LinearProgress, Divider, Button
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API = process.env.REACT_APP_API_BASE_URL || "";

const STAGES = ["pending", "accepted", "ready", "delivered"]; // rejected handled separately
const COLORS = {
  pending: "default",
  accepted: "info",
  ready: "warning",
  delivered: "success",
  rejected: "error",
};

export default function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/orders/${id}`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Failed to fetch order");
        return;
      }
      setOrder(data);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); /* eslint-disable-next-line */ }, [id]);

  // live updates
  useEffect(() => {
    const onStatus = (p) => {
      if (Number(p?.id) === Number(id)) {
        setOrder((prev) => (prev ? { ...prev, status: p.status } : prev));
        toast.info(`Order #${id} is now ${p.status}`);
      }
    };
    socket.on("order:status", onStatus);
    return () => socket.off("order:status", onStatus);
  }, [id]);

  const stageIndex = useMemo(() => {
    if (!order?.status) return 0;
    const s = String(order.status);
    const idx = STAGES.indexOf(s);
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

  const isRejected = order?.status === "rejected";

  const percent = useMemo(() => {
    if (isRejected) return 100;
    const total = STAGES.length - 1;
    return Math.min(100, Math.max(0, (stageIndex / total) * 100));
  }, [stageIndex, isRejected]);

  const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

  return (
    <Box sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />}>Back</Button>
        <Typography variant="h5">Track Order #{id}</Typography>
        <span />
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {!order ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">Order not found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1">
                {order.Vendor?.name || "Vendor"}
              </Typography>
              <Chip
                size="small"
                label={order.status}
                color={COLORS[order.status] || "default"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={(order.paymentMethod === "mock_online" ? "Online" : "COD") + " · " + (order.paymentStatus || "unpaid")}
              />
              <Typography variant="subtitle2" sx={{ ml: "auto" }}>
                Total: {rupee(order.totalAmount)}
              </Typography>
            </Stack>

            {/* Timeline */}
            <Box>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ mb: 2, height: 8, borderRadius: 999 }}
                color={isRejected ? "error" : "primary"}
              />
              <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5 }}>
                {STAGES.map((s, i) => {
                  const done = !isRejected && i <= stageIndex;
                  const Icon = done ? CheckCircleIcon : RadioButtonUncheckedIcon;
                  return (
                    <Stack key={s} alignItems="center" sx={{ width: "25%" }}>
                      <Icon fontSize="small" color={done ? "success" : "disabled"} />
                      <Typography variant="caption" sx={{ mt: 0.5 }}>{s}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
              {isRejected && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  This order was rejected by the vendor.
                </Typography>
              )}
            </Box>

            <Divider />

            {/* Items */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Items</Typography>
              {Array.isArray(order.MenuItems) && order.MenuItems.length > 0 ? (
                <Stack spacing={0.5}>
                  {order.MenuItems.map((mi) => (
                    <Stack key={mi.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{mi.name} × {mi?.OrderItem?.quantity ?? 1}</Typography>
                      <Typography variant="body2">{rupee(mi.price)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : Array.isArray(order.OrderItems) ? (
                <Stack spacing={0.5}>
                  {order.OrderItems.map((oi) => (
                    <Stack key={oi.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{oi.MenuItem?.name || "Item"} × {oi.quantity ?? 1}</Typography>
                      <Typography variant="body2">{rupee(oi.MenuItem?.price ?? 0)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No items</Typography>
              )}
            </Box>

            <Divider />

            <Typography variant="caption" color="text.secondary">
              Placed: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}
            </Typography>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}