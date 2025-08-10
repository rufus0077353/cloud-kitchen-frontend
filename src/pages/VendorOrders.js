
import React, { useEffect, useState } from "react";
import {
  Container, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, Chip, Button, Box, CircularProgress
} from "@mui/material";
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
  const [updatingId, setUpdatingId] = useState(null); // row-level loading

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
    // optimistic update
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
      // pull latest snapshot
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
    // Support either OrderItems include or MenuItems through pivot
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

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>Vendor Orders</Typography>

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
            ) : (Array.isArray(orders) ? orders : []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No orders yet</TableCell>
              </TableRow>
            ) : (
              (Array.isArray(orders) ? orders : []).map((o) => {
                const disabled = updatingId === o.id;
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      {o.id} {disabled && <CircularProgress size={14} sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{o.User?.name || "-"}</TableCell>
                    <TableCell>{renderItemsCell(o)}</TableCell>
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