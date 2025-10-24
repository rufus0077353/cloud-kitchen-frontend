
// src/pages/AdminPayouts.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import PaidIcon from "@mui/icons-material/Paid";
import ScheduleIcon from "@mui/icons-material/Schedule";

const API = process.env.REACT_APP_API_BASE_URL || "";

const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(n || 0))}`;

const pct = (n) =>
  `${Number.isFinite(Number(n)) ? Number(n * 100).toFixed(2) : "0.00"}%`;

const safeCsv = (val) => {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, headerArr, rowsArr) => {
  const csv = [headerArr.join(","), ...rowsArr].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminPayouts() {
  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState(""); // quick search by vendor name/id
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({ gross: 0, platformFee: 0, net: 0, payableNow: 0 });
  const [source, setSource] = useState(""); // "payouts" | "orders-fallback"
  const [loading, setLoading] = useState(false);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      // backend currently ignores from/to, but we keep them for future support
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const r = await fetch(`${API}/api/admin/payouts?${params.toString()}`, { headers });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`);

      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotals(
        data?.totals || { gross: 0, platformFee: 0, net: 0, payableNow: 0 }
      );
      setSource(data?.source || "");
    } catch (e) {
      console.error("payouts fetch failed:", e);
      setItems([]);
      setTotals({ gross: 0, platformFee: 0, net: 0, payableNow: 0 });
      setSource("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayouts(); }, []); // mount

  const filtered = items.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      String(r.vendorId).includes(s) ||
      (r.vendorName || "").toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const headersCsv = [
      "Vendor ID",
      "Vendor",
      "Commission %",
      "Gross",
      "Platform Fee",
      "Net",
      "Payable Now",
      "Pending",
      "Scheduled",
      "Paid",
      "Source",
    ];
    const rowsCsv = filtered.map((r) =>
      [
        r.vendorId,
        safeCsv(r.vendorName),
        Number(r.commissionRate ?? 0).toFixed(2),
        Number(r.gross ?? 0).toFixed(2),
        Number(r.platformFee ?? 0).toFixed(2),
        Number(r.net ?? 0).toFixed(2),
        Number(r.payableNow ?? 0).toFixed(2),
        r.statusCounts?.pending ?? 0,
        r.statusCounts?.scheduled ?? 0,
        r.statusCounts?.paid ?? 0,
        source || "",
      ].join(",")
    );
    downloadCsv("admin-payouts", headersCsv, rowsCsv);
  };

  const doAction = async (vendorId, action) => {
    // action: "pay" | "schedule"
    const url =
      action === "pay"
        ? `${API}/api/admin/payouts/vendor/${vendorId}/pay`
        : `${API}/api/admin/payouts/vendor/${vendorId}/schedule`;
    try {
      const res = await fetch(url, { method: "PATCH", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      await fetchPayouts();
    } catch (e) {
      console.error(`payout ${action} failed`, e);
      // keep UI responsive; you can add a toast here if you use react-toastify
    }
  };

  return (
    <Box p={3}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}
      >
        <Typography variant="h4">Payouts</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Search vendor"
            placeholder="name or #id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <TextField
            size="small"
            label="From"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            size="small"
            label="To"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPayouts}>
            Apply
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, border: (t) => `1px solid ${t.palette.divider}` }}
      >
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 1 }}>
          <Chip label={`Gross: ${fmtMoney(totals.gross)}`} />
          <Chip label={`Platform Fee: ${fmtMoney(totals.platformFee)}`} />
          <Chip label={`Vendor Net: ${fmtMoney(totals.net)}`} />
          <Chip label={`Payable Now: ${fmtMoney(totals.payableNow)}`} color="success" />
          {source && (
            <Chip
              label={source === "payouts" ? "Source: payouts table" : "Source: orders fallback"}
              variant="outlined"
              color={source === "payouts" ? "primary" : "default"}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Tip: “Payable Now” only appears when using the payouts table (status = pending). 
          In fallback mode (computed from delivered+paid orders) it will be 0.
        </Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell align="right">Commission %</TableCell>
              <TableCell align="right">Gross</TableCell>
              <TableCell align="right">Platform Fee</TableCell>
              <TableCell align="right">Vendor Net</TableCell>
              <TableCell align="right">Payable Now</TableCell>
              <TableCell align="center">Statuses</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {loading ? "Loading…" : "No data"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.vendorId} hover>
                  <TableCell>
                    #{r.vendorId} — {r.vendorName}
                  </TableCell>
                  <TableCell align="right">
                    {Number(r.commissionRate ?? 0).toFixed(2)}%
                  </TableCell>
                  <TableCell align="right">{fmtMoney(r.gross)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.platformFee)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.net)}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600}>{fmtMoney(r.payableNow)}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Chip size="small" label={`pending ${r.statusCounts?.pending ?? 0}`} />
                      <Chip
                        size="small"
                        color="info"
                        label={`sched ${r.statusCounts?.scheduled ?? 0}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        color="success"
                        label={`paid ${r.statusCounts?.paid ?? 0}`}
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Schedule all pending payouts">
                        <span>
                          <IconButton
                            onClick={() => doAction(r.vendorId, "schedule")}
                            disabled={loading || (r.statusCounts?.pending ?? 0) === 0}
                            color="info"
                          >
                            <ScheduleIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Mark all pending payouts as Paid">
                        <span>
                          <IconButton
                            onClick={() => doAction(r.vendorId, "pay")}
                            disabled={loading || (r.statusCounts?.pending ?? 0) === 0}
                            color="success"
                          >
                            <PaidIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}

            {filtered.length > 0 && (
              <TableRow>
                <TableCell>
                  <strong>Totals</strong>
                </TableCell>
                <TableCell />
                <TableCell align="right">
                  <strong>{fmtMoney(totals.gross)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{fmtMoney(totals.platformFee)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{fmtMoney(totals.net)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{fmtMoney(totals.payableNow)}</strong>
                </TableCell>
                <TableCell />
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={fetchPayouts}
                    variant="outlined"
                  >
                    Refresh
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}