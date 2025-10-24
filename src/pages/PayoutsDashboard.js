
// src/pages/PayoutsDashboard.js  (Vendor view)
import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Typography, Box, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Stack, TextField, Button, CircularProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import { toast } from "react-toastify";
import { connectSocket, socket } from "../utils/socket";

/* -------- API base normalizer -------- */
function resolveApiBase() {
  const raw = process.env.REACT_APP_API_BASE_URL || "";
  if (!raw) return "http://localhost:5000/api";
  const trimmed = raw.replace(/\/+$/, "");
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}
const API = resolveApiBase();

/* -------- helpers -------- */
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0))}`;
const safeCsv = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Accept "yyyy-mm-dd" or "dd-mm-yyyy" → "yyyy-mm-dd"
const toISODate = (s = "") => {
  if (!s) return "";
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
};

export default function PayoutsDashboard() {
  const token = localStorage.getItem("token") || "";

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [summary, setSummary]   = useState(null); // { paidOrders, grossPaid, commission, netOwed, grossUnpaid, rate }
  const [range, setRange]       = useState({ from: "", to: "" });

  const qs = useMemo(() => {
    const q = [];
    const from = toISODate(range.from);
    const to   = toISODate(range.to);
    if (from) q.push(`from=${from}`);
    if (to)   q.push(`to=${to}`);
    return q.length ? `?${q.join("&")}` : "";
  }, [range]);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // preferred vendor endpoint
      let url = `${API}/orders/payouts/summary${qs}`;
      let res = await fetch(url, { headers });

      // fallback if your backend uses an older vendor route
      if (res.status === 404) {
        url = `${API}/orders/vendor/summary${qs}`;
        res = await fetch(url, { headers });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      // expect a single object for vendor view
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setSummary(data);
      } else {
        setSummary(null);
        setError("Unexpected response shape.");
      }
    } catch (e) {
      setError(e?.message || "Failed to load payouts");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    try { connectSocket(); } catch {}
    const onAny = () => load();
    socket.on("payout:update", onAny);
    socket.on("payout:updated", onAny);
    socket.on("payments:refresh", onAny);
    return () => {
      socket.off("payout:update", onAny);
      socket.off("payout:updated", onAny);
      socket.off("payments:refresh", onAny);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const exportCsv = () => {
    if (!summary) return toast.info("Nothing to export");
    const headers = [
      "Paid Orders","Gross Paid","Commission","Net Owed","Unpaid Gross","Rate %","From","To"
    ];
    const row = [
      summary.paidOrders ?? 0,
      summary.grossPaid ?? 0,
      summary.commission ?? 0,
      summary.netOwed ?? 0,
      summary.grossUnpaid ?? 0,
      ((summary.rate || 0) * 100).toFixed(2),
      toISODate(range.from) || "",
      toISODate(range.to) || ""
    ].map(safeCsv).join(",");

    const csv = [headers.join(","), row].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-payouts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = useMemo(() => {
    if (!summary) return [];
    const ratePct = ((summary.rate || 0) * 100).toFixed(2);
    return [
      ["Paid Orders", fmtNum(summary.paidOrders || 0)],
      ["Gross Paid", fmtMoney(summary.grossPaid || 0)],
      [`Commission (${ratePct}%)`, fmtMoney(summary.commission || 0)],
      ["Net Owed", fmtMoney(summary.netOwed || 0)],
      ["Unpaid Gross", fmtMoney(summary.grossUnpaid || 0)],
    ];
  }, [summary]);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Vendor Payout Summary</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={load} startIcon={<RefreshIcon />} variant="outlined">Refresh</Button>
          <Button onClick={exportCsv} startIcon={<DownloadIcon />} variant="contained" color="success">
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          type="date" label="From" size="small" InputLabelProps={{ shrink: true }}
          value={range.from} onChange={(e) => setRange((d) => ({ ...d, from: e.target.value }))}
        />
        <TextField
          type="date" label="To" size="small" InputLabelProps={{ shrink: true }}
          value={range.to} onChange={(e) => setRange((d) => ({ ...d, to: e.target.value }))}
        />
        <Button variant="contained" onClick={load}>Apply</Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper sx={{ p: 2, color: "error.main", bgcolor: "error.light", opacity: 0.9 }}>
          {error}
        </Paper>
      ) : !summary ? (
        <Typography color="text.secondary">No payout data found</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell align="right">{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}