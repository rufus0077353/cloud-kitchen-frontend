import React, { useEffect, useState } from "react";
import {
  Container, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, Chip, Button, Box, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Stack, IconButton, TextField
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const STATUS_COLORS = {
  pending: "default",
  accepted: "primary",
  rejected: "error",
  ready: "warning",
  delivered: "success",
};

export default function VendorOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");
  const [search, setSearch] = useState("");          // NEW: search by user/item
  const [dateFrom, setDateFrom] = useState("");      // NEW: yyyy-mm-dd
  const [dateTo, setDateTo] = useState("");          // NEW: yyyy-mm-dd

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const parseOrders = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.orders)) return data.orders;
    return [];
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || `Failed (${res.status})`;
        toast.error(msg);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(parseOrders(data));
    } catch (e) {
      console.error("load vendor orders error:", e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    const prev = orders;
    const next = prev.map((o) => (o.id === id ? { ...o, status } : o));
    setOrders(next);
    setUpdatingId(id);

    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || "Failed to update";
        setOrders(prev); // rollback
        toast.error(msg);
        return;
      }
      toast.success("Status updated");
      loadOrders();
    } catch (e) {
      console.error("update status error:", e);
      setOrders(prev); // rollback
      toast.error("Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItemsCell = (order) => {
    const fromOrderItems = Array.isArray(order?.OrderItems) ? order.OrderItems : null;
    if (fromOrderItems && fromOrderItems.length) {
      return fromOrderItems.map(oi => `${oi.MenuItem?.name || "Item"} x${oi.quantity}`).join(", ");
    }
    const fromMenuItems = Array.isArray(order?.MenuItems) ? order.MenuItems : null;
    if (fromMenuItems && fromMenuItems.length) {
      return fromMenuItems
        .map(mi => `${mi.name} x${mi.OrderItem?.quantity ?? "-"}`)
        .join(", ");
    }
    return "-";
  };

  // Helpers for search & date filtering
  const matchesSearch = (order, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const userName = (order?.User?.name || "").toLowerCase();
    const itemsStr = renderItemsCell(order).toLowerCase();
    return userName.includes(needle) || itemsStr.includes(needle);
  };

  const withinDateRange = (order) => {
    if (!dateFrom && !dateTo) return true;
    const ts = new Date(order.createdAt).getTime();
    if (Number.isNaN(ts)) return false;

    let ok = true;
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00").getTime();
      ok = ok && ts >= from;
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59").getTime();
      ok = ok && ts <= to;
    }
    return ok;
  };

  // Pipeline: filter by status -> search -> date range -> sort
  const filtered = (Array.isArray(orders) ? orders : [])
    .filter(o => (statusFilter === "all" ? true : o.status === statusFilter))
    .filter(o => matchesSearch(o, search))
    .filter(o => withinDateRange(o));

  const visibleOrders = [...filtered].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime() || 0;
    const bTime = new Date(b.createdAt).getTime() || 0;
    const aTotal = Number(a.totalAmount) || 0;
    const bTotal = Number(b.totalAmount) || 0;

    switch (sortBy) {
      case "created_asc":
        return aTime - bTime;            // oldest first
      case "total_desc":
        return bTotal - aTotal;          // high → low
      case "total_asc":
        return aTotal - bTotal;          // low → high
      case "created_desc":
      default:
        return bTime - aTime;            // newest first
    }
  });

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h5">Vendor Orders</Typography>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
          {/* Search */}
          <TextField
            size="small"
            label="Search (user or item)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Date range */}
          <TextField
            size="small"
            label="From"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <TextField
            size="small"
            label="To"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          {/* Status filter */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="accepted">Accepted</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>

          {/* Sort by */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="sort-by-label">Sort by</InputLabel>
            <Select
              labelId="sort-by-label"
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="created_desc">Newest first</MenuItem>
              <MenuItem value="created_asc">Oldest first</MenuItem>
              <MenuItem value="total_desc">Total: high → low</MenuItem>
              <MenuItem value="total_asc">Total: low → high</MenuItem>
            </Select>
          </FormControl>

          <IconButton onClick={loadOrders} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : visibleOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              visibleOrders.map((o) => {
                const disabled = updatingId === o.id;
                const itemsText = (() => {
                  const fromOrderItems = Array.isArray(o?.OrderItems) ? o.OrderItems : null;
                  if (fromOrderItems && fromOrderItems.length) {
                    return fromOrderItems.map(oi => `${oi.MenuItem?.name || "Item"} x${oi.quantity}`).join(", ");
                  }
                  const fromMenuItems = Array.isArray(o?.MenuItems) ? o.MenuItems : null;
                  if (fromMenuItems && fromMenuItems.length) {
                    return fromMenuItems.map(mi => `${mi.name} x${mi.OrderItem?.quantity ?? "-"}`).join(", ");
                  }
                  return "-";
                })();

                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      {o.id} {disabled && <CircularProgress size={14} sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{o.User?.name || "-"}</TableCell>
                    <TableCell>{itemsText}</TableCell>
                    <TableCell>₹{o.totalAmount}</TableCell>
                    <TableCell>
                      <Chip label={o.status} color={STATUS_COLORS[o.status] || "default"} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {o.status === "pending" && (
                          <>
                            <Button size="small" disabled={disabled}
                              onClick={() => updateStatus(o.id, "accepted")}>
                              Accept
                            </Button>
                            <Button size="small" color="error" disabled={disabled}
                              onClick={() => updateStatus(o.id, "rejected")}>
                              Reject
                            </Button>
                          </>
                        )}
                        {o.status === "accepted" && (
                          <Button size="small" disabled={disabled}
                            onClick={() => updateStatus(o.id, "ready")}>
                            Mark Ready
                          </Button>
                        )}
                        {o.status === "ready" && (
                          <Button size="small" disabled={disabled}
                            onClick={() => updateStatus(o.id, "delivered")}>
                            Mark Delivered
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}