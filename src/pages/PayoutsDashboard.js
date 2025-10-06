
// src/pages/PayoutsDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Container, Typography, Box, Table, TableHead, TableBody, TableRow,
  TableCell, Paper, TableContainer, Button, CircularProgress, Stack,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Divider
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import { connectSocket, socket } from "../utils/socket";
import { toast } from "react-toastify";

/* ---------------- API base normalizer ----------------
   Put EITHER https://your-backend OR https://your-backend/api
   in REACT_APP_API_BASE_URL — this will normalize to .../api */
function resolveApiBase() {
  const raw = process.env.REACT_APP_API_BASE_URL || "";
  if (!raw) return "http://localhost:5000/api"; // sensible default
  const trimmed = raw.replace(/\/+$/, "");
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}
const API_BASE = resolveApiBase();

/* ---------------- helpers ---------------- */
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0))}`;
const safeCsv = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Accepts "yyyy-mm-dd" or "dd-mm-yyyy" and returns valid "yyyy-mm-dd" or ""
const toISODate = (s = "") => {
  if (!s) return "";
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;               // already ISO
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);              // dd-mm-yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return ""; // anything else -> ignore
};

export default function PayoutsDashboard({ role = "vendor", token: tokenProp }) {
  const token = tokenProp || localStorage.getItem("token") || "";
  const isAdmin = role === "admin";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const [selectedPayout, setSelectedPayout] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const handleOpenModal = (payout) => { setSelectedPayout(payout); setOpenModal(true); };
  const handleCloseModal = () => { setSelectedPayout(null); setOpenModal(false); };

  const qsFromDateRange = useMemo(() => {
    const qs = [];
    const fromISO = toISODate(dateRange.from);
    const toISO = toISODate(dateRange.to);
    if (fromISO) qs.push(`from=${fromISO}`);
    if (toISO) qs.push(`to=${toISO}`);
    return qs.length ? `?${qs.join("&")}` : "";
  }, [dateRange]);

  /** Fetch payouts with:
   *  - admin:  /orders/payouts/summary/all
   *  - vendor: /orders/payouts/summary   (fallback -> /orders/vendor/summary on 404)
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = isAdmin
        ? `${API_BASE}/orders/payouts/summary/all`
        : `${API_BASE}/orders/payouts/summary`;

      let res = await fetch(`${endpoint}${qsFromDateRange}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // vendor-only fallback if first route doesn't exist
      if (!isAdmin && res.status === 404) {
        endpoint = `${API_BASE}/orders/vendor/summary`;
        res = await fetch(`${endpoint}${qsFromDateRange}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }

      if (!res.ok) {
        if (res.status === 401) throw new Error("Not authenticated");
        if (res.status === 403) throw new Error("Forbidden (wrong role)");
        if (res.status === 404) throw new Error("API route not found");
        const msg = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${msg ? ` - ${msg}` : ""}`);
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("❌ payout fetch failed:", err);
      toast.error(err.message || "Failed to load payouts");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    try { connectSocket(); } catch {}

    const onPayoutUpdate = () => fetchData();
    const onPaymentsRefresh = () => fetchData();

    socket.on("payout:update", onPayoutUpdate);
    socket.on("payout:updated", onPayoutUpdate);
    socket.on("payments:refresh", onPaymentsRefresh);
    return () => {
      socket.off("payout:update", onPayoutUpdate);
      socket.off("payout:updated", onPayoutUpdate);
      socket.off("payments:refresh", onPaymentsRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, qsFromDateRange]);

  const exportCSV = () => {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;

    const headers = Array.from(
      rows.reduce((set, r) => { Object.keys(r || {}).forEach((k) => set.add(k)); return set; }, new Set())
    );

    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => safeCsv(r?.[h] ?? "")).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // nice vendor rows
  const vendorRows = useMemo(() => {
    if (!data || isAdmin) return [];
    const ratePct = Number(data.rate || 0) * 100;
    return [
      ["Paid Orders", fmtNum(data.paidOrders || 0)],
      ["Gross Paid", fmtMoney(data.grossPaid || 0)],
      [`Commission (${ratePct.toFixed(0)}%)`, fmtMoney(data.commission || 0)],
      ["Net Owed", fmtMoney(data.netOwed || 0)],
      ["Unpaid Gross", fmtMoney(data.grossUnpaid || 0)],
    ];
  }, [data, isAdmin]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          {isAdmin ? "Admin Payout Summary" : "Vendor Payout Summary"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={fetchData} startIcon={<RefreshIcon />} variant="outlined">Refresh</Button>
          <Button onClick={exportCSV} startIcon={<DownloadIcon />} variant="contained" color="success">Export CSV</Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          type="date" label="From" size="small" InputLabelProps={{ shrink: true }}
          value={dateRange.from} onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
        />
        <TextField
          type="date" label="To" size="small" InputLabelProps={{ shrink: true }}
          value={dateRange.to} onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
        />
        <Button variant="contained" onClick={fetchData}>Apply</Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
      ) : !data ? (
        <Typography color="text.secondary">No payout data found</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {isAdmin ? (
                  <>
                    <TableCell>Vendor</TableCell>
                    <TableCell align="right">Paid Orders</TableCell>
                    <TableCell align="right">Gross Paid</TableCell>
                    <TableCell align="right">Commission</TableCell>
                    <TableCell align="right">Net Owed</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>Metric</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {isAdmin ? (
                Array.isArray(data) && data.length ? (
                  data.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{row.vendorName ?? row.vendor ?? `#${row.VendorId ?? "-"}`}</TableCell>
                      <TableCell align="right">{fmtNum(row.paidOrders)}</TableCell>
                      <TableCell align="right">{fmtMoney(row.grossPaid)}</TableCell>
                      <TableCell align="right">{fmtMoney(row.commission)}</TableCell>
                      <TableCell align="right">{fmtMoney(row.netOwed)}</TableCell>
                      <TableCell align="right">
                        <Button variant="outlined" size="small" onClick={() => handleOpenModal(row)}>View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} align="center">No records</TableCell></TableRow>
                )
              ) : (
                vendorRows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">{value}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Details Modal */}
      <Dialog open={openModal} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>Payout Details</DialogTitle>
        <DialogContent dividers>
          {selectedPayout ? (
            <Stack spacing={1.5}>
              <Typography><b>Vendor:</b> {selectedPayout.vendorName ?? `#${selectedPayout.VendorId ?? "-"}`}</Typography>
              <Typography><b>Paid Orders:</b> {fmtNum(selectedPayout.paidOrders)}</Typography>
              <Typography><b>Gross Paid:</b> {fmtMoney(selectedPayout.grossPaid)}</Typography>
              <Typography>
                <b>Commission Rate:</b>{" "}
                {(((selectedPayout.rate ?? selectedPayout.commissionRate) || 0) * 100).toFixed(2)}%
              </Typography>
              <Typography><b>Commission Amount:</b> {fmtMoney(selectedPayout.commission ?? selectedPayout.commissionAmount)}</Typography>
              <Typography><b>Payout Amount (Net Owed):</b> {fmtMoney(selectedPayout.payoutAmount ?? selectedPayout.netOwed)}</Typography>
              {selectedPayout.status && <Typography><b>Status:</b> {selectedPayout.status}</Typography>}
              <Divider />
              {selectedPayout.createdAt && (
                <Typography color="text.secondary"><b>Created:</b> {new Date(selectedPayout.createdAt).toLocaleString()}</Typography>
              )}
              {selectedPayout.updatedAt && (
                <Typography color="text.secondary"><b>Updated:</b> {new Date(selectedPayout.updatedAt).toLocaleString()}</Typography>
              )}
            </Stack>
          ) : (
            <Typography>No details available</Typography>
          )}
        </DialogContent>
        <DialogActions><Button onClick={handleCloseModal}>Close</Button></DialogActions>
      </Dialog>
    </Container>
  );
}