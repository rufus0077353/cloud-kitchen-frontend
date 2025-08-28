
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Stack, Select, MenuItem, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import { socket } from '../utils/socket';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

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

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (vendorId) params.set('VendorId', vendorId);
    if (userId) params.set('UserId', userId);
    if (dateFrom) params.set('startDate', dateFrom);
    if (dateTo) params.set('endDate', dateTo);

    const res = await fetch(`${API_BASE}/api/admin/orders?` + params.toString(), { headers });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* initial */ }, []); // eslint-disable-line

  useEffect(() => {
    const onNew = () => load();
    const onStatus = () => load();
    socket.on('order:new', onNew);
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:status', onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>All Orders</Typography>

      <Stack direction={{ xs:'column', sm:'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Select size="small" displayEmpty value={status} onChange={e=>setStatus(e.target.value)}>
          <MenuItem value=""><em>All statuses</em></MenuItem>
          <MenuItem value="pending">pending</MenuItem>
          <MenuItem value="accepted">accepted</MenuItem>
          <MenuItem value="ready">ready</MenuItem>
          <MenuItem value="delivered">delivered</MenuItem>
          <MenuItem value="rejected">rejected</MenuItem>
        </Select>
        <TextField size="small" label="VendorId" value={vendorId} onChange={e=>setVendorId(e.target.value)} />
        <TextField size="small" label="UserId" value={userId} onChange={e=>setUserId(e.target.value)} />
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink:true }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink:true }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        <Button variant="contained" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</Button>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Vendor</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell>Items</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(o => (
            <TableRow key={o.id} hover>
              <TableCell>{o.id}</TableCell>
              <TableCell>{o.Vendor?.name} ({o.Vendor?.cuisine})</TableCell>
              <TableCell>{o.User?.name} ({o.User?.email})</TableCell>
              <TableCell><Chip size="small" label={o.status}/></TableCell>
              <TableCell align="right">₹{Number(o.totalAmount || 0).toFixed(2)}</TableCell>
              <TableCell>
                <ul style={{ margin:0, paddingLeft:16 }}>
                  {(o.MenuItems || o.OrderItems || []).map((row, idx) => {
                    // Support either shape (include via through OR via OrderItem include)
                    const name = row.name || row.MenuItem?.name;
                    const price = row.price || row.MenuItem?.price;
                    const qty = row?.OrderItem?.quantity || row.quantity || 1;
                    return <li key={idx}>{qty}× {name} — ₹{price}</li>;
                  })}
                </ul>
              </TableCell>
              <TableCell>{new Date(o.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}