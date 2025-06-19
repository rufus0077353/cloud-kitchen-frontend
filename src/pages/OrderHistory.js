
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { Delete, Edit, Logout } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [updatedAmount, setUpdatedAmount] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const fetchOrders = async () => {
    try {
      const res = await fetch("${process.env.REACT_APP/API_BASE_URL}/api/orders/my", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setUpdatedAmount(order.totalAmount);
    setOpen(true);
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP/API_BASE_URL}/api/orders/${editingOrder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ totalAmount: updatedAmount }),
      });
      if (res.ok) {
        setOpen(false);
        fetchOrders();
      }
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await fetch(`${process.env.REACT_APP/API_BASE_URL}/api/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchOrders();
    } catch (err) {
      console.error("Error deleting order:", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <Container>
      <Typography variant="h4" gutterBottom>Order History</Typography>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<Logout />}
        onClick={handleLogout}
        sx={{ float: "right", mb: 2 }}
      >
        Logout
      </Button>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Total Amount</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>₹{order.totalAmount}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(order)}><Edit /></IconButton>
                  <IconButton onClick={() => handleDelete(order.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Edit Order</DialogTitle>
        <DialogContent>
          <TextField
            label="Total Amount"
            value={updatedAmount}
            onChange={(e) => setUpdatedAmount(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderHistory;