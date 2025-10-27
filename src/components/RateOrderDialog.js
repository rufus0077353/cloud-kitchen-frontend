
// src/components/RateOrderDialog.jsx
import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Rating, Typography
} from "@mui/material";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function RateOrderDialog({
  open,
  onClose,
  orderId,             // <- make sure you pass orderId={order.id}
  onRated,             // optional callback: (payload) => void
}) {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderId) {
      toast.error("Missing order id");
      return;
    }
    if (stars < 1 || stars > 5) {
      toast.error("Rating must be 1–5");
      return;
    }

    const token = localStorage.getItem("token");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/rate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ rating: stars, review }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Failed to submit rating");
        return;
      }

      toast.success("Thanks for your feedback!");
      onClose?.();
      onRated?.(data);          // let parent refresh if desired
    } catch (e) {
      toast.error("Network error while submitting rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Rate your order #{orderId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2">Rating</Typography>
            <Rating value={stars} onChange={(_, v) => setStars(v || 0)} />
          </Stack>
          <TextField
            label="Write a short review (optional)"
            multiline minRows={3} fullWidth
            value={review}
            onChange={(e) => setReview(e.target.value)}
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}