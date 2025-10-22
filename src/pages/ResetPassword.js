
// src/pages/ResetPassword.js
import React, { useMemo, useState } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
} from "@mui/material";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import HighlightOff from "@mui/icons-material/HighlightOff";

const API_BASE = process.env.REACT_APP_API_BASE_URL || ""; // e.g. https://your-backend/api
const ENDPOINT = `${API_BASE}/auth/reset-password`;         // POST { token, password }

/** --- Password helpers --- */
const hasLetter = (s) => /[A-Za-z]/.test(s);
const hasNumber = (s) => /\d/.test(s);
const hasSpecial = (s) => /[^A-Za-z0-9]/.test(s);
const hasUpper = (s) => /[A-Z]/.test(s);
const noSpaces = (s) => !/\s/.test(s);
const minLen = (s, n = 8) => (s || "").length >= n;

function strengthScore(pw = "") {
  if (!pw) return 0;
  let score = 0;
  // base length
  score += Math.min(40, (pw.length / 12) * 40);      // up to 40
  // diversity
  const kinds = [hasLetter(pw), hasNumber(pw), hasSpecial(pw), hasUpper(pw)].filter(Boolean).length;
  score += kinds * 12;                                // up to 48
  // bonus for no spaces + longer than 16
  if (noSpaces(pw)) score += 4;
  if (pw.length >= 16) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function strengthLabel(score) {
  if (score < 35) return "Weak";
  if (score < 60) return "Okay";
  if (score < 85) return "Strong";
  return "Excellent";
}

function strengthColor(score) {
  if (score < 35) return "#d32f2f"; // red
  if (score < 60) return "#ed6c02"; // orange
  if (score < 85) return "#2e7d32"; // green
  return "#1b5e20";                  // darker green
}

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // live validations
  const rules = useMemo(() => {
    const pw = password || "";
    return [
      { ok: minLen(pw, 8), label: "At least 8 characters" },
      { ok: hasLetter(pw), label: "Contains a letter" },
      { ok: hasNumber(pw), label: "Contains a number" },
      { ok: hasUpper(pw) || hasSpecial(pw), label: "Uppercase or special character" },
      { ok: noSpaces(pw), label: "No spaces" },
    ];
  }, [password]);

  const allRulesOk = rules.every((r) => r.ok);
  const score = strengthScore(password);
  const label = strengthLabel(score);
  const color = strengthColor(score);

  const onSubmit = async (e) => {
    e.preventDefault();
    setOkMsg("");
    setErrMsg("");

    if (!token) {
      setErrMsg("Reset token is missing or invalid.");
      return;
    }
    if (!allRulesOk) {
      setErrMsg("Please satisfy all password rules before continuing.");
      return;
    }
    if (password !== confirm) {
      setErrMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not reset password");

      setOkMsg(data?.message || "Your password has been reset successfully.");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setErrMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Set a new password
        </Typography>

        {!token && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This page requires a valid reset token. Please use the link from your email.
          </Alert>
        )}

        {okMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {okMsg} You can now{" "}
            <RouterLink to="/login" style={{ textDecoration: "none", color: "#1976d2" }}>
              log in
            </RouterLink>.
          </Alert>
        )}
        {errMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        )}

        <Box component="form" onSubmit={onSubmit}>
          <TextField
            label="New password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            autoFocus
            sx={{ mb: 1.5 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPw((s) => !s)}
                    edge="end"
                  >
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Strength meter */}
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 10,
                borderRadius: 1,
                "& .MuiLinearProgress-bar": { backgroundColor: color },
              }}
            />
            <Typography variant="caption" sx={{ color }}>
              Strength: {label}
            </Typography>
          </Stack>

          {/* Rules checklist */}
          <List dense sx={{ mt: -1, mb: 1 }}>
            {rules.map((r, i) => (
              <ListItem key={i} disableGutters>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {r.ok ? (
                    <CheckCircleOutline fontSize="small" color="success" />
                  ) : (
                    <HighlightOff fontSize="small" color="disabled" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{
                    variant: "body2",
                    color: r.ok ? "text.primary" : "text.secondary",
                  }}
                  primary={r.label}
                />
              </ListItem>
            ))}
          </List>

          <TextField
            label="Confirm password"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirm((s) => !s)}
                    edge="end"
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            error={Boolean(confirm) && confirm !== password}
            helperText={Boolean(confirm) && confirm !== password ? "Passwords do not match" : " "}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={submitting || !token}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {submitting ? "Saving…" : "Reset password"}
          </Button>

          <Box sx={{ mt: 2, textAlign: "center" }}>
            <RouterLink to="/login" style={{ textDecoration: "none", color: "#1976d2" }}>
              ← Back to login
            </RouterLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}