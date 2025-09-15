// src/pages/AdminPayouts.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Stack, Typography, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

const API = process.env.REACT_APP_API_BASE_URL || "";

const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0))}`;

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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const r = await fetch(`${API}/api/orders/payouts/summary/all?${params}`, { headers });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("payouts fetch failed:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayouts(); /* on mount */ }, []); // eslint-disable-line

  const totals = rows.reduce(
    (s, r) => {
      s.paidOrders += Number(r.paidOrders || 0);
      s.grossPaid += Number(r.grossPaid || 0);
      s.commission += Number(r.commission || 0);
      s.netOwed += Number(r.netOwed || 0);
      return s;
    },
    { paidOrders: 0, grossPaid: 0, commission: 0, netOwed: 0 }
  );

  const exportCsv = () => {
    const headersCsv = [
      "Vendor ID", "Vendor", "Rate %", "Paid Orders", "Gross Paid", "Commission", "Net Owed"
    ];
    const rowsCsv = rows.map((r) =>
      [
        r.vendorId,
        safeCsv(r.vendorName),
        (Number(r.rate || 0) * 100).toFixed(2),
        r.paidOrders,
        r.grossPaid,
        r.commission,
        r.netOwed
      ].join(",")
    );
    downloadCsv("admin-payouts", headersCsv, rowsCsv);
  };

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">Payouts</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" label="From" type="date" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" label="To" type="date" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPayouts}>Apply</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rows.length===0}>Export CSV</Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Chip label={`Paid Orders: ${totals.paidOrders}`} />
          <Chip label={`Gross Paid: ${fmtMoney(totals.grossPaid)}`} />
          <Chip label={`Commission: ${fmtMoney(totals.commission)}`} />
          <Chip label={`Net Owed: ${fmtMoney(totals.netOwed)}`} />
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Paid Orders</TableCell>
              <TableCell align="right">Gross Paid</TableCell>
              <TableCell align="right">Commission</TableCell>
              <TableCell align="right">Net Owed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No data</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.vendorId} hover>
                <TableCell>#{r.vendorId} — {r.vendorName}</TableCell>
                <TableCell align="right">{(Number(r.rate || 0) * 100).toFixed(2)}%</TableCell>
                <TableCell align="right">{r.paidOrders}</TableCell>
                <TableCell align="right">{fmtMoney(r.grossPaid)}</TableCell>
                <TableCell align="right">{fmtMoney(r.commission)}</TableCell>
                <TableCell align="right">{fmtMoney(r.netOwed)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow>
                <TableCell><strong>Totals</strong></TableCell>
                <TableCell />
                <TableCell align="right"><strong>{totals.paidOrders}</strong></TableCell>
                <TableCell align="right"><strong>{fmtMoney(totals.grossPaid)}</strong></TableCell>
                <TableCell align="right"><strong>{fmtMoney(totals.commission)}</strong></TableCell>
                <TableCell align="right"><strong>{fmtMoney(totals.netOwed)}</strong></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}