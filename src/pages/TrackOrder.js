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
import StarIcon from "@mui/icons-material/Star";
import { Rating } from "@mui/material";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";
import api from "../utils/api";
import RateOrderDialog from "../components/RateOrderDialog";

const STAGES = ["pending", "accepted", "ready", "delivered"]; // "rejected" handled separately

// MUI Chip accepts: default | primary | secondary | error | info | success | warning
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

  // rating dialog
  const [rateOpen, setRateOpen] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      // api base already includes /api → just call /orders/:id
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
  const isDelivered = statusLc === "delivered";
  const isRated = Boolean(order?.rating && Number(order.rating) > 0);

  const stageIndex = useMemo(() => {
    const idx = STAGES.indexOf(statusLc);
    return idx >= 0 ? idx : 0;
  }, [statusLc]);

  const percent = useMemo(() => {
    if (isRejected) return 100;
    const totalSteps = STAGES.length - 1; // 3
    return Math.min(100, Math.max(0, (stageIndex / totalSteps) * 100));
  }, [stageIndex, isRejected]);

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
                label={statusLc.toUpperCase()}
                color={COLORS[statusLc] || "default"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`${(order.paymentMethod === "online" || order.paymentMethod === "mock_online") ? "Online" : "COD"} · ${(order.paymentStatus || "unpaid").toUpperCase()}`}
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
                <Typography variant="body2" color="text.secondary">No items</Typography>
              )}
            </Box>

            <Divider />

            {/* Rating section */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Your rating</Typography>
                {/* Show Rate button only if delivered AND not already rated */}
                {isDelivered && !isRated && (
                  <Button size="small" variant="contained" onClick={() => setRateOpen(true)}>
                    Rate this order
                  </Button>
                )}
              </Stack>

              {isRated ? (
                <Stack spacing={0.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Rating value={Number(order.rating)} precision={1} readOnly />
                    <Chip
                      size="small"
                      icon={<StarIcon fontSize="small" />}
                      label={`${order.rating}/5`}
                      variant="outlined"
                    />
                  </Stack>
                  {order.review ? (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      “{order.review}”
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No written review.
                    </Typography>
                  )}
                  {order.ratedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Rated on {new Date(order.ratedAt).toLocaleString()}
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  You can rate this order once it’s delivered.
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

      {/* Rate dialog */}
      {order && (
        <RateOrderDialog
          open={rateOpen}
          onClose={() => setRateOpen(false)}
          orderId={orderid}
          // Immediately reflect the saved rating in the UI
          onRated={(payload) => {
            setRateOpen(false);
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    rating: Number(payload?.rating) || 0,
                    review: payload?.review || "",
                    ratedAt: payload?.ratedAt || new Date().toISOString(),
                  }
                : prev
            );
            toast.success("Thanks for your feedback!");
          }}
        />
      )}
    </Box>
  );
}