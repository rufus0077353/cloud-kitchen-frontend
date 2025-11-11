
// src/pages/VerifyEmailPrompt.jsx
import React, { useState } from "react";
import { Box, Paper, Typography, Button, Alert, Stack } from "@mui/material";

const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

export default function VerifyEmailPrompt() {
  const [status, setStatus] = useState("idle"); // idle | sending | ok | err
  const [msg, setMsg] = useState("");

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); }
    catch { return {}; }
  })();
  const token = localStorage.getItem("token") || "";

  const resend = async () => {
    setStatus("sending"); setMsg("");
    try {
      const res = await fetch(`${API}/api/auth/email/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // 🔐 IMPORTANT
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setStatus("ok");
      setMsg(data.message || "Verification email resent. Please check your inbox/spam.");
    } catch (e) {
      setStatus("err");
      setMsg(e.message || "Failed to resend");
    }
  };

  const checkStatus = async () => {
    setStatus("sending"); setMsg("");
    try {
      const res = await fetch(`${API}/api/auth/email/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      if (data.emailVerified) {
        setStatus("ok");
        setMsg("Email verified! You can now continue.");
        // Optionally redirect:
        // window.location.replace("/dashboard");
      } else {
        setStatus("err");
        setMsg("Not verified yet. Please click the link in your email.");
      }
    } catch (e) {
      setStatus("err");
      setMsg(e.message || "Failed to check status");
    }
  };

  return (
    <Box sx={{ mt: 6, display: "flex", justifyContent: "center" }}>
      <Paper sx={{ p: 3, maxWidth: 520, width: "100%" }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
          Verify your email
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          We’ve sent a verification link to <b>{user?.email || "your email"}</b>.
          Please check your inbox (and spam) to continue.
        </Typography>

        {status === "ok" && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
        {status === "err" && <Alert severity="error" sx={{ mb: 2 }}>{msg}</Alert>}

        <Stack direction="row" spacing={2}>
          <Button
            onClick={resend}
            variant="contained"
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Resend Email"}
          </Button>
          <Button onClick={checkStatus} variant="outlined">
            I’ve Verified
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}