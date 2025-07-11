
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider
} from "@mui/material";

const API = process.env.REACT_APP_API_BASE_URL;


const OrderSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;

  

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleDelete = async () => {
    try {
      await fetch(`${API}/api/orders/${order.id}`, {
        method: "DELETE"
      });
      alert("Order deleted");
      navigate("/dashboard");
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  const handleUpdate = async () => {
    const updatedAmount = prompt("Enter new total amount:");
    try {
      await fetch(`${API}/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount: updatedAmount, items: order.items })
      });
      alert("Order updated");
    } catch (err) {
      console.error("Update error", err);
    }
  };

  if (!order) return <Typography>No order data found</Typography>;

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          🎉 Order Successful!
        </Typography>
        <Typography variant="body1">
          <strong>Order ID:</strong> {order.id}
        </Typography>
        <Typography variant="body1">
          <strong>Total Amount:</strong> ₹{order.totalAmount}
        </Typography>

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6">Ordered Items:</Typography>
        <List>
          {order.items.map((item, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={`Item: ${item.MenuItemId}`}
                secondary={`Quantity: ${item.quantity}`}
              />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
          <Button variant="contained" color="primary" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
          <Button variant="contained" color="warning" onClick={handleUpdate}>
            Update Order
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete Order
          </Button>
          <Button variant="outlined" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default OrderSuccess;