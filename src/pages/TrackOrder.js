
// src/pages/TrackOrder.js
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  LinearProgress,
  Divider,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ReplayIcon from "@mui/icons-material/Replay";
import CancelScheduleSendIcon from "@mui/icons-material/CancelScheduleSend";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import api from "../utils/api";

const STAGES = ["pending", "accepted", "ready", "delivered"]; // "rejected" handled separately

// MUI Chip: default | primary | secondary | error | info | success | warning
const COLORS = {
  pending: "default",
  accepted: "info",
  ready: "warning",
  delivered: "success",
  rejected: "error",
};

const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function TrackOrder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // for actions

  const fetchOrder = async () => {
    setLoading(true);
    try {
      // api base already has /api
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to fetch order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // live updates from server
  useEffect(() => {
    const onStatus = (payload) => {
      if (Number(payload?.id) === Number(id)) {
        setOrder((prev) => (prev ? { ...prev, ...payload } : payload));
        const s = String(payload?.status || "").toUpperCase();
        toast.info(`Order #${id} updated: ${s}`);
      }
    };
    socket.on("order:status", onStatus);
    return () => socket.off("order:status", onStatus);
  }, [id]);

  const statusLc = String(order?.status || "pending").toLowerCase();
  const isRejected = statusLc === "rejected";

  const stageIndex = useMemo(() => {
    const idx = STAGES.indexOf(statusLc);
    return idx >= 0 ? idx : 0;
  }, [statusLc]);

  const percent = useMemo(() => {
    if (isRejected) return 100;
    const totalSteps = STAGES.length - 1; // 3
    return Math.min(100, Math.max(0, (stageIndex / totalSteps) * 100));
  }, [stageIndex, isRejected]);

  // ---------- action guards ----------
  const paymentMethod = String(order?.paymentMethod || "").toLowerCase(); // "cod" | "mock_online" | "online"
  const paymentStatus = String(order?.paymentStatus || "unpaid").toLowerCase(); // "unpaid" | "paid" | "processing"
  const canCancel =
    (statusLc === "pending" || statusLc === "accepted") &&
    (paymentMethod === "cod" || paymentStatus !== "paid"); // allow cancel until prep, unless already paid online
  const canReorder = statusLc === "delivered" || statusLc === "rejected";

  // ---------- actions ----------
  const cancelOrder = async () => {
    if (!canCancel) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${id}/cancel`);
      // optimistic merge
      setOrder((prev) => ({ ...(prev || {}), ...(data || {}), status: "rejected" }));
      toast.success("Order cancelled");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to cancel order");
    } finally {
      setBusy(false);
    }
  };

  const reorder = async () => {
    if (!canReorder) return;
    setBusy(true);
    try {
      // Primary attempt: dedicated reorder endpoint
      await api.post(`/orders/${id}/reorder`);
      toast.success("Items added from past order. Opening cart…");
      // If your cart drawer exists, send them to checkout directly or open cart.
      // Navigate to checkout (adjust if you prefer opening a drawer instead)
      navigate("/checkout");
    } catch (err) {
      // Fallback UX if endpoint not present
      console.error(err);
      const msg =
        err?.response?.status === 404
          ? "Reorder is not available for this order."
          : err?.response?.data?.message || "Failed to reorder";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
        spacing={1.5}
      >
        <Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />}>
          Back
        </Button>
        <Typography variant="h5">Track Order #{id}</Typography>

        {/* Actions on the right */}
        {!!order && (
          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={cancelOrder}
              disabled={!canCancel || busy}
              startIcon={<CancelScheduleSendIcon />}
            >
              Cancel Order
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={reorder}
              disabled={!canReorder || busy}
              startIcon={<ReplayIcon />}
            >
              Reorder
            </Button>
          </Stack>
        )}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {!order ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">Order not found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            {/* Header chips */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1">{order.Vendor?.name || "Vendor"}</Typography>

              <Chip
                size="small"
                label={statusLc.toUpperCase()}
                color={COLORS[statusLc] || "default"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${
                  paymentMethod === "online" || paymentMethod === "mock_online" ? "Online" : "COD"
                } · ${(order.paymentStatus || "unpaid").toUpperCase()}`}
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
                      <Typography variant="caption" sx={{ mt: 0.5 }}>
                        {s}
                      </Typography>
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
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Items
              </Typography>

              {Array.isArray(order?.MenuItems) && order.MenuItems.length > 0 ? (
                <Stack spacing={0.5}>
                  {order.MenuItems.map((mi) => (
                    <Stack key={mi.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">
                        {mi.name} × {mi?.OrderItem?.quantity ?? 1}
                      </Typography>
                      <Typography variant="body2">{rupee(mi.price)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : Array.isArray(order?.OrderItems) ? (
                <Stack spacing={0.5}>
                  {order.OrderItems.map((oi) => (
                    <Stack key={oi.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">
                        {oi.MenuItem?.name || "Item"} × {oi.quantity ?? 1}
                      </Typography>
                      <Typography variant="body2">{rupee(oi.MenuItem?.price ?? 0)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No items
                </Typography>
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