
// src/pages/Login.js
import React, { useState } from "react";
import {
  Container, Paper, TextField, Button, Typography, Stack
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

function getRole(user) {
  const r =
    user?.role ??
    user?.Role ??
    user?.userRole ??
    user?.user_type ??
    user?.userType ??
    "";
  return String(r || "").trim().toLowerCase();
}

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const goToHomeByRole = async (user, token) => {
    const role = getRole(user);

    // Vendors: make sure we have vendorId in storage
    if (role === "vendor") {
      try {
        const res = await fetch(`${API_BASE}/api/vendors/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const me = await res.json();
          if (me?.vendorId || me?.id) {
            localStorage.setItem("vendorId", String(me.vendorId ?? me.id));
          }
        }
      } catch (_) {}
      nav("/vendor/dashboard", { replace: true });
      return;
    }

    if (role === "admin") {
      nav("/admin/dashboard", { replace: true });
      return;
    }

    // fallback: normal user
    const redirectBack = location.state?.from?.pathname;
    nav(redirectBack || "/dashboard", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Login failed (${res.status})`);
      }

      const json = await res.json();
      // Expecting { token, user } but tolerate variants
      const token = json.token || json.accessToken || json.jwt;
      const user  = json.user  || json.profile  || json.data  || {};
      if (!token || !user?.id) {
        throw new Error("Invalid login response");
      }

      // Store auth
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Route based on role (vendor/admin/user)
      await goToHomeByRole(user, token);
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Sign in
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            {err && (
              <Typography color="error" variant="body2">
                {err}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Login"}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}