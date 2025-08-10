import React, { useEffect, useState } from "react";
import {
  Container, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, Chip, Button, Box
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
  const token = localStorage.getItem("token");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (!res.ok) {
        const msg = (await res.json().catch(()=>({}))).message || `Failed (${res.status})`;
        toast.error(msg);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("load vendor orders error:", e);
      setOrders([]);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(()=>({}))).message || "Failed to update";
        toast.error(msg);
        return;
      }
      toast.success("Status updated");
      loadOrders();
    } catch (e) {
      console.error("update status error:", e);
      toast.error("Network error");
    }
  };

  useEffect(() => { loadOrders(); }, []);

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
            {(Array.isArray(orders) ? orders : []).map((o) => {
              const items = Array.isArray(o.OrderItems) ? o.OrderItems : [];
              return (
                <TableRow key={o.id}>
                  <TableCell>{o.id}</TableCell>
                  <TableCell>{o.User?.name || "-"}</TableCell>
                  <TableCell>
                    {items.length === 0 ? "-" :
                      items.map(oi => `${oi.MenuItem?.name || "Item"} x${oi.quantity}`).join(", ")
                    }
                  </TableCell>
                  <TableCell>₹{o.totalAmount}</TableCell>
                  <TableCell>
                    <Chip label={o.status} color={STATUS_COLORS[o.status] || "default"} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {o.status === "pending" && (
                        <>
                          <Button size="small" onClick={() => updateStatus(o.id, "accepted")}>Accept</Button>
                          <Button size="small" color="error" onClick={() => updateStatus(o.id, "rejected")}>Reject</Button>
                        </>
                      )}
                      {o.status === "accepted" && (
                        <Button size="small" onClick={() => updateStatus(o.id, "ready")}>Mark Ready</Button>
                      )}
                      {o.status === "ready" && (
                        <Button size="small" onClick={() => updateStatus(o.id, "delivered")}>Mark Delivered</Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {(!orders || orders.length === 0) && (
              <TableRow><TableCell colSpan={6} align="center">No orders yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}