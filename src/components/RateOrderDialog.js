
// src/components/RateOrderDialog.jsx
import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Rating, Typography
} from "@mui/material";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function RateOrderDialog({ open, onClose, order, onRated }) {
  const token = localStorage.getItem("token");
  const [stars, setStars] = useState(order?.rating || 0);
  const [review, setReview] = useState(order?.review || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!order?.id) return;
    if (stars < 1) {
      toast.error("Please select at least 1 star");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/orders/${order.id}/rate`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: stars, review }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message || "Failed to save rating");
        return;
      }
      toast.success("Thanks for your rating!");
      onRated?.(data?.order || { ...order, rating: stars, review });
      onClose?.();
    } catch {
      toast.error("Network error while rating");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Rate your order #{order?.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" sx={{ minWidth: 76 }}>Rating</Typography>
            <Rating
              value={Number(stars || 0)}
              onChange={(_, v) => setStars(v || 0)}
              size="large"
            />
          </Stack>
          <TextField
            label="Write a short review (optional)"
            placeholder="How was the food and delivery?"
            multiline
            minRows={3}
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, 1000))}
            helperText={`${review.length}/1000`}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}