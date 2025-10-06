import React, { useEffect, useState, useMemo } from "react";
import {
  Container, Typography, Box, Table, TableHead, TableBody, TableRow,
  TableCell, Paper, TableContainer, Button, CircularProgress, Stack, TextField
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import { connectSocket, socket } from "../utils/socket";
import { toast } from "react-toastify";
import { connect } from "socket.io-client";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000/api";

export default function PayoutsDashboard({ role = "vendor", token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const isAdmin = role === "admin";

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin
        ? `${API_BASE}/orders/payouts/summary/all`
        : `${API_BASE}/orders/payouts/summary`;

      const qs = [];
      if (dateRange.from) qs.push(`from=${dateRange.from}`);
      if (dateRange.to) qs.push(`to=${dateRange.to}`);
      const url = qs.length ? `${endpoint}?${qs.join("&")}` : endpoint;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("payout fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    connectSocket();

    const handlePayoutUpdate = (p) => {
        toast.info(`Payout updated for Order  #${p?.orderId || "?"}`);
        fetchData();
    };

    const handlePaymmentsRefresh = () => {
        toast.info("Payouts data refreshed");
        fetchData();
    };
    
    //Register socket listeners
    socket.on("payout:updated", handlePayoutUpdate);
    socket.on("payments:refresh", handlePaymmentsRefresh);

    // Cleanup
    return () => {
      socket.off("payout:updated", handlePayoutUpdate);
      socket.off("payments:refresh", handlePaymmentsRefresh);
    };
  }, []);

    
    

  const exportCSV = () => {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [data];
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight="bold">
          {isAdmin ? "Admin Payout Summary" : "Vendor Payout Summary"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={fetchData} startIcon={<RefreshIcon />} variant="outlined">Refresh</Button>
          <Button onClick={exportCSV} startIcon={<DownloadIcon />} variant="contained" color="success">Export CSV</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 2, mb: 2 }}>
        <TextField
          type="date"
          label="From"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateRange.from}
          onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
        />
        <TextField
          type="date"
          label="To"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateRange.to}
          onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
        />
        <Button variant="contained" onClick={fetchData}>Filter</Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : !data ? (
        <Typography color="text.secondary">No data</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {isAdmin ? (
                  <>
                    <TableCell>Vendor</TableCell>
                    <TableCell align="right">Paid Orders</TableCell>
                    <TableCell align="right">Gross Paid</TableCell>
                    <TableCell align="right">Commission</TableCell>
                    <TableCell align="right">Net Owed</TableCell>
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
                Array.isArray(data) && data.length ? data.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.vendorName}</TableCell>
                    <TableCell align="right">{row.paidOrders}</TableCell>
                    <TableCell align="right">₹{row.grossPaid}</TableCell>
                    <TableCell align="right">₹{row.commission}</TableCell>
                    <TableCell align="right">₹{row.netOwed}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">No records</TableCell></TableRow>
                )
              ) : (
                Object.entries(data).map(([k,v]) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell align="right">{typeof v === "number" ? `₹${v}` : JSON.stringify(v)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}       
