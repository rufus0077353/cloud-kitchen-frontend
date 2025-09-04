// src/pages/AdminOrders.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Stack, Select, MenuItem, TextField, Button,
  Table, TableHead, TableRow, TableCell, TableBody, Chip,
  Pagination, FormControl, InputLabel, CircularProgress
} from "@mui/material";
import { socket } from "../utils/socket";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";
const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function AdminOrders() {
  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [userId, setUserId] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);

  const load = async (toPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(toPage));
      params.set("pageSize", String(pageSize));
      if (status) params.set("status", status);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (vendorId) params.set("vendorId", vendorId);
      if (userId) params.set("userId", userId);

      const res = await fetch(`${API_BASE}/api/orders/admin?${params.toString()}`, { headers });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && Array.isArray(data.items)) {
        setRows(data.items);
        setTotal(Number(data.total || 0));
        setTotalPages(Number(data.totalPages || 1));
        setPage(Number(data.page || toPage));
      } else if (Array.isArray(data)) {
        // extremely defensive: if someone proxied to old shape (array)
        setRows(data);
        setTotal(data.length);
        setTotalPages(1);
        setPage(1);
      } else {
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, paymentStatus, vendorId, userId, pageSize]);

  useEffect(() => {
    const onNew = () => load();
    const onStatus = () => load();
    const onPayment = () => load();
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    socket.on("order:payment", onPayment);
    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
      socket.off("order:payment", onPayment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => load(1);
  const paymentChipColor = (ps) =>
    ps === "paid" ? "success" : ps === "failed" ? "error" : "default";

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        All Orders (Admin)
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: "center" }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="status-select">Status</InputLabel>
          <Select
            labelId="status-select"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            displayEmpty
          >
            <MenuItem value=""><em>All statuses</em></MenuItem>
            <MenuItem value="pending">pending</MenuItem>
            <MenuItem value="accepted">accepted</MenuItem>
            <MenuItem value="ready">ready</MenuItem>
            <MenuItem value="delivered">delivered</MenuItem>
            <MenuItem value="rejected">rejected</MenuItem>
            <MenuItem value="canceled">canceled</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="payment-select">Payment</InputLabel>
          <Select
            labelId="payment-select"
            label="Payment"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            displayEmpty
          >
            <MenuItem value=""><em>All payments</em></MenuItem>
            <MenuItem value="paid">paid</MenuItem>
            <MenuItem value="unpaid">unpaid</MenuItem>
            <MenuItem value="failed">failed</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="VendorId"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        />
        <TextField
          size="small"
          label="UserId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="pagesize">Rows</InputLabel>
          <Select
            labelId="pagesize"
            label="Rows"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </FormControl>

        <Button variant="contained" onClick={handleApply} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </Button>
      </Stack>

      <Box sx={{ position: "relative" }}>
        {loading && (
          <Stack alignItems="center" sx={{ my: 2 }}>
            <CircularProgress size={22} />
          </Stack>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Commission</TableCell>
              <TableCell align="right">Net to Vendor</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((o) => {
              const total = Number(o.totalAmount || 0);
              const commission = Number(o.commissionAmount || 0);
              const net = +(total - commission).toFixed(2);
              const pm = o.paymentMethod === "mock_online" ? "Online" : (o.paymentMethod || "COD");
              const pst = o.paymentStatus || "unpaid";
              return (
                <TableRow key={o.id} hover>
                  <TableCell>{o.id}</TableCell>
                  <TableCell>{o.Vendor?.name || "-"} {o.Vendor?.cuisine ? `(${o.Vendor.cuisine})` : ""}</TableCell>
                  <TableCell>{o.User?.name || "-"} {o.User?.email ? `(${o.User.email})` : ""}</TableCell>
                  <TableCell>
                    <Chip size="small" label={o.status} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" variant="outlined" label={pm} />
                      <Chip size="small" color={paymentChipColor(pst)} label={pst} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{inr(total)}</TableCell>
                  <TableCell align="right">{inr(commission)}</TableCell>
                  <TableCell align="right">{inr(net)}</TableCell>
                  <TableCell>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center">No orders</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {total} total • page {page} / {totalPages}
          </Typography>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => {
              setPage(p);
              load(p);
            }}
            size="small"
            color="primary"
            showFirstButton
            showLastButton
          />
        </Stack>
      </Box>
    </Box>
  );
}