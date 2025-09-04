
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Stack, Select, MenuItem, TextField, Button,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Paper, Divider, Alert
} from '@mui/material';
import { socket } from '../utils/socket';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';
const DEFAULT_RATE = Number(process.env.REACT_APP_PLATFORM_RATE || 0.10); // 10%

const inr = (n) => `₹${Number(n || 0).toFixed(2)}`;
const STATUS_COLORS = {
  pending:'default', accepted:'primary', ready:'warning',
  delivered:'success', rejected:'error', canceled:'default', cancelled:'default'
};

export default function AdminOrders() {
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const commissionFor = (o) => {
    const explicit = o?.commissionAmount ?? o?.platformCommission ?? o?.platformFee;
    if (explicit != null) return Number(explicit) || 0;
    const rate =
      (o?.commissionRate != null ? Number(o.commissionRate) : null) ??
      (o?.Vendor?.commissionRate != null ? Number(o.Vendor.commissionRate) : null) ??
      DEFAULT_RATE;
    const total = Number(o?.totalAmount || 0);
    return Math.max(0, total * (isFinite(rate) ? rate : DEFAULT_RATE));
  };

  const isRevenueOrder = (o) =>
    !['rejected','canceled','cancelled'].includes((o?.status || '').toLowerCase());

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      // --- Build filters once ---
      const params = new URLSearchParams();
      if (status)  params.set('status', status);
      if (vendorId) params.set('VendorId', vendorId);   // uppercase supported by backend
      if (userId)   params.set('UserId', userId);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo)   params.set('endDate', dateTo);

      const getUrl = `${API_BASE}/api/admin/orders?${params.toString()}`;

      // --- Try GET first ---
      let res = await fetch(getUrl, { headers, credentials: 'include' });

      // If GET fails (404/405/500/403/etc.), try POST with JSON body as a fallback
      if (!res.ok) {
        // collect readable reason
        const text = await res.text().catch(() => '');
        console.warn('[AdminOrders] GET failed:', res.status, text);

        const postUrl = `${API_BASE}/api/admin/orders`;
        const body = {
          status: status || undefined,
          VendorId: vendorId || undefined,
          UserId: userId || undefined,
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
        };

        res = await fetch(postUrl, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const fallbackText = await res.text().catch(() => '');
          setRows([]);
          setErr(
            `Admin orders request failed.
Tried GET ${getUrl} and POST ${postUrl}.
Last response: ${res.status} ${res.statusText}
${fallbackText || '(no response text)'}`
          );
          return;
        }
      }

      // Parse JSON safely
      let data = null;
      try {
        data = await res.json();
      } catch {
        const raw = await res.text().catch(() => '');
        setRows([]);
        setErr(
          `Server returned non-JSON for admin orders.
Status: ${res.status} ${res.statusText}
Payload (first 400 chars): ${raw.slice(0, 400)}`
        );
        return;
      }

      if (!Array.isArray(data)) {
        if (data && data.message) {
          setErr(`Backend error: ${data.message}`);
        } else {
          setErr('Unexpected response shape (not an array).');
        }
        setRows([]);
        return;
      }

      setRows(data);
    } catch (e) {
      console.error(e);
      setErr(`Network error: ${e?.message || e}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    const onNew = load, onStatus = load, onPayment = load;
    socket.on('order:new', onNew);
    socket.on('order:status', onStatus);
    socket.on('order:payment', onPayment);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:status', onStatus);
      socket.off('order:payment', onPayment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const eligible = rows.filter(o =>
      isRevenueOrder(o) && String(o?.paymentStatus || '').toLowerCase() === 'paid'
    );
    const count = eligible.length;
    const gross = eligible.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const commission = eligible.reduce((s, o) => s + commissionFor(o), 0);
    const payout = gross - commission;
    return { count, gross, commission, payout };
  }, [rows]);

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>All Orders</Typography>

      {err ? (
        <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {err}
        </Alert>
      ) : null}

      <Stack direction={{ xs:'column', sm:'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Select size="small" displayEmpty value={status} onChange={e=>setStatus(e.target.value)}>
          <MenuItem value=""><em>All statuses</em></MenuItem>
          <MenuItem value="pending">pending</MenuItem>
          <MenuItem value="accepted">accepted</MenuItem>
          <MenuItem value="ready">ready</MenuItem>
          <MenuItem value="delivered">delivered</MenuItem>
          <MenuItem value="rejected">rejected</MenuItem>
          <MenuItem value="canceled">canceled</MenuItem>
        </Select>
        <TextField size="small" label="VendorId" value={vendorId} onChange={e=>setVendorId(e.target.value)} />
        <TextField size="small" label="UserId" value={userId} onChange={e=>setUserId(e.target.value)} />
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink:true }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink:true }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        <Button variant="contained" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</Button>
      </Stack>

      <Paper sx={{ p:2, mb:2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Earnings (Paid & non-canceled in current view)
        </Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
          <Box>
            <Typography variant="body2" color="text.secondary">Orders</Typography>
            <Typography variant="h6">{summary.count}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Gross Sales</Typography>
            <Typography variant="h6">{inr(summary.gross)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Commission</Typography>
            <Typography variant="h6">{inr(summary.commission)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Vendor Payout</Typography>
            <Typography variant="h6">{inr(summary.payout)}</Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              Rate fallback: {(DEFAULT_RATE * 100).toFixed(0)}%
            </Typography>
          </Box>
        </Stack>
      </Paper>

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
            <TableCell>Items</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(o => {
            const commission = commissionFor(o);
            return (
              <TableRow key={o.id} hover>
                <TableCell>{o.id}</TableCell>
                <TableCell>{o.Vendor?.name} ({o.Vendor?.cuisine})</TableCell>
                <TableCell>{o.User?.name} ({o.User?.email})</TableCell>
                <TableCell>
                  <Chip size="small" label={o.status} color={STATUS_COLORS[o.status] || 'default'} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={String(o.paymentStatus || 'unpaid')} />
                    <Chip size="small" variant="outlined" label={(o.paymentMethod === 'mock_online') ? 'Online' : 'COD'} />
                  </Stack>
                </TableCell>
                <TableCell align="right">{inr(o.totalAmount)}</TableCell>
                <TableCell align="right">{inr(commission)}</TableCell>
                <TableCell>
                  <ul style={{ margin:0, paddingLeft:16 }}>
                    {(o.MenuItems || o.OrderItems || []).map((row, idx) => {
                      const name = row.name || row.MenuItem?.name;
                      const price = row.price || row.MenuItem?.price;
                      const qty = row?.OrderItem?.quantity || row.quantity || 1;
                      return <li key={idx}>{qty}× {name} — ₹{price}</li>;
                    })}
                  </ul>
                </TableCell>
                <TableCell>{new Date(o.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}