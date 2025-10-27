
// src/components/RateOrderDialog.jsx
import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Rating, Stack, Typography, Alert
} from "@mui/material";
import { toast } from "react-toastify";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

export default function RateOrderDialog({ open, onClose, orderId, onRated }) {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const submit = async () => {
    setErrMsg("");

    if (!orderId) {
      setErrMsg("Missing order id.");
      return;
    }
    if (!Number.isFinite(Number(stars)) || stars < 1 || stars > 5) {
      setErrMsg("Please select a rating between 1 and 5.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setErrMsg("You’re not logged in.");
      toast.error("Please log in again.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/rate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // important for cookie-based sessions too
        credentials: "include",
        body: JSON.stringify({ rating: Number(stars), review: String(review || "").trim() }),
      });

      if (!res.ok) {
        // Show precise backend message if present
        let msg = "Failed to submit rating";
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {}
        setErrMsg(msg);
        toast.error(msg);
        return;
        }

      toast.success("Thanks for the feedback!");
      onRated?.();   // parent can refresh order
      onClose?.();   // close dialog
      setReview("");
      setStars(5);
    } catch (e) {
      setErrMsg("Network error while submitting rating.");
      toast.error("Network error while submitting rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
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

          {errMsg && <Alert severity="error">{errMsg}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting} type="button">Cancel</Button>
        {/* type="button" ensures we don't submit a parent <form> */}
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting}
          type="button"
        >
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}