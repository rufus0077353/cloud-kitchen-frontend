
import React, { useState, useMemo } from "react";
import { Container, Paper, Stack, Typography, Button, Alert } from "@mui/material";

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function VerifyEmailPrompt() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const [msg, setMsg] = useState("");

  const resend = async () => {
    setMsg("");
    const token = localStorage.getItem("token");
    try {
      const r = await fetch(`${API}/auth/email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to resend");
      setMsg("Verification email sent. Please check your Inbox/Spam.");
    } catch (e) {
      setMsg(e.message || "Failed to resend");
    }
  };

  return (
    <Container sx={{ py: 6 }}>
      <Paper sx={{ p: 3, maxWidth: 520, mx: "auto" }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={700}>Verify your email</Typography>
          <Typography color="text.secondary">
            We’ve sent a verification link to <b>{user?.email || "your email"}</b>. Please check your email to continue.
          </Typography>
          {!!msg && <Alert severity="info">{msg}</Alert>}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={resend}>Resend email</Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              I’ve verified
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}