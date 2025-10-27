
// src/components/RateOrderDialog.jsx
import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Rating, Stack, Typography
} from "@mui/material";
import { toast } from "react-toastify";

const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

export default function RateOrderDialog({ open, onClose, orderId, onRated }) {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const token = localStorage.getItem("token");
    if (!orderId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/rate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ rating: stars, review })
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.message || "Failed to submit rating";
        toast.error(msg);
      } else {
        toast.success("Thanks for the feedback!");
        onRated?.(); // refresh the order if parent provided a handler
        onClose?.();
      }
    } catch {
      toast.error("Network error while submitting rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rate your order #{orderId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography component="legend">Rating</Typography>
            <Rating
              value={stars}
              onChange={(_, v) => setStars(v || 0)}
              precision={1}
              size="large"
            />
          </Stack>
          <TextField
            label="Write a short review (optional)"
            multiline
            minRows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            inputProps={{ maxLength: 1000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}