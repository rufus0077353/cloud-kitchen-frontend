// src/pages/AdminPayouts.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Stack, Typography, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/,"");

const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN",{ maximumFractionDigits: 2 }).format(Number(n || 0))}`;
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));

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
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  a.href = url; a.download = `${filename}-${stamp}.csv`; a.click();
  URL.revokeObjectURL(url);
};

export default function AdminPayouts() {
  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ gross: 0, platformFee: 0, net: 0, payableNow: 0 });
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchPayouts = async () => {
    setLoading(true);
    setErr("");
    try {
      // Primary admin endpoint
      let r = await fetch(`${API}/api/admin/payouts`, { headers });

      // Allow legacy vendor-wide summary array (older code paths)
      if (!r.ok) {
        const text = await r.text().catch(()=> "");
        throw new Error(text || `HTTP ${r.status}`);
      }
      const data = await r.json();

      if (Array.isArray(data)) {
        // Older shape: array only
        setRows(data);
        const t = data.reduce((acc, v) => {
          acc.gross += Number(v.grossPaid || v.gross || 0);
          acc.platformFee += Number(v.platformFee || v.commission || 0);
          acc.net += Number(v.netOwed || v.net || v.payoutAmount || 0);
          acc.payableNow += Number(v.payableNow || 0);
          return acc;
        }, { gross: 0, platformFee: 0, net: 0, payableNow: 0 });
        setTotals({
          gross: +t.gross.toFixed(2),
          platformFee: +t.platformFee.toFixed(2),
          net: +t.net.toFixed(2),
          payableNow: +t.payableNow.toFixed(2),
        });
        setSource("array");
      } else {
        // New shape from /api/admin/payouts
        const items = Array.isArray(data.items) ? data.items : [];
        setRows(items);
        setTotals({
          gross: Number(data.totals?.gross || 0),
          platformFee: Number(data.totals?.platformFee || 0),
          net: Number(data.totals?.net || 0),
          payableNow: Number(data.totals?.payableNow || 0),
        });
        setSource(String(data.source || ""));
      }
    } catch (e) {
      setErr(e?.message || "Failed to load payouts");
      setRows([]);
      setTotals({ gross: 0, platformFee: 0, net: 0, payableNow: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayouts(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.vendorName || r.Vendor?.name || `Vendor ${r.vendorId || r.VendorId || ""}`)
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const exportCsv = () => {
    const headersCsv = [
      "Vendor ID","Vendor","Commission %","Gross","Platform Fee","Vendor Net","Payable Now",
      "Pending (count)","Scheduled (count)","Paid (count)","Source"
    ];
    const rowsCsv = filtered.map((r) => {
      const vendorId = r.vendorId ?? r.VendorId ?? "";
      const vendorName = r.vendorName ?? r.Vendor?.name ?? `Vendor ${vendorId}`;
      const ratePct =
        r.commissionRate != null ? Number(r.commissionRate) :
        r.rate != null ? Number(r.rate) : null;
      const pct = ratePct != null ? (ratePct).toFixed(2) : ""; // already % in admin route
      const sc = r.statusCounts || {};
      return [
        vendorId,
        safeCsv(vendorName),
        pct,
        Number(r.gross ?? r.grossPaid ?? 0).toFixed(2),
        Number(r.platformFee ?? r.commission ?? 0).toFixed(2),
        Number(r.net ?? r.netOwed ?? 0).toFixed(2),
        Number(r.payableNow ?? 0).toFixed(2),
        sc.pending ?? 0,
        sc.scheduled ?? 0,
        sc.paid ?? 0,
        source
      ].join(",");
    });
    downloadCsv("admin-payouts", headersCsv, rowsCsv);
  };

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">Payouts</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Search vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPayouts}>
            Apply
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap flexWrap="wrap">
          <Chip label={`Gross: ${fmtMoney(totals.gross)}`} />
          <Chip label={`Platform Fee: ${fmtMoney(totals.platformFee)}`} />
          <Chip label={`Vendor Net: ${fmtMoney(totals.net)}`} />
          <Chip color="success" label={`Payable Now: ${fmtMoney(totals.payableNow)}`} />
          {source && <Chip variant="outlined" label={`Source: ${source}`} />}
        </Stack>
      </Paper>

      {err && (
        <Paper sx={{ p: 2, mb: 2, color: "error.main", bgcolor: "error.light", opacity: 0.9 }}>
          {err}
        </Paper>
      )}

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
              <TableCell>Statuses</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">No data</TableCell>
              </TableRow>
            ) : filtered.map((r) => {
              const vendorId = r.vendorId ?? r.VendorId ?? "";
              const vendorName = r.vendorName ?? r.Vendor?.name ?? `Vendor ${vendorId}`;
              const pct =
                r.commissionRate != null ? Number(r.commissionRate).toFixed(2) :
                r.rate != null ? (Number(r.rate) * 100).toFixed(2) : ""; // tolerate older shapes
              const statuses = r.statusCounts || {};
              return (
                <TableRow key={vendorId} hover>
                  <TableCell>#{vendorId} — {vendorName}</TableCell>
                  <TableCell align="right">{pct}{pct && "%"}</TableCell>
                  <TableCell align="right">{fmtMoney(r.gross ?? r.grossPaid)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.platformFee ?? r.commission)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.net ?? r.netOwed)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.payableNow)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={`pending: ${fmtNum(statuses.pending || 0)}`} />
                      <Chip size="small" label={`scheduled: ${fmtNum(statuses.scheduled || 0)}`} />
                      <Chip size="small" label={`paid: ${fmtNum(statuses.paid || 0)}`} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {/* Hook up actions later (mark paid/scheduled, open details, etc.) */}
                    <IconButton size="small" disabled><RefreshIcon fontSize="inherit" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}