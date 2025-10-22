
import React, { useState } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE_URL || ""; // e.g. https://your-backend/api
const ENDPOINT = `${API_BASE}/auth/forgot-password`;       // POST { email }

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setOkMsg("");
    setErrMsg("");

    const trimmed = email.trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isEmail) {
      setErrMsg("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      // Backend may return 200/202 with {message}
      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Request failed");
      }

      setOkMsg(
        data?.message ||
          "If this email exists in our system, a reset link has been sent."
      );
      setEmail("");
    } catch (err) {
      setErrMsg(
        err?.message ||
          "Could not send reset link. Please try again in a moment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Reset your password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your registered email address and we’ll send you a password
          reset link.
        </Typography>

        {okMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {okMsg}
          </Alert>
        )}
        {errMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        )}

        <Box component="form" onSubmit={onSubmit}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={submitting}
            startIcon={
              submitting ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </Box>

        <Box sx={{ mt: 2, textAlign: "center" }}>
          <Typography variant="body2">
            <RouterLink to="/login" style={{ textDecoration: "none" }}>
              ← Back to login
            </RouterLink>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}