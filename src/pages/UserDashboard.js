import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";

import {
  Container,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
  Box,
  AppBar,
  Toolbar,
 // eslint-disable-next-line no-unused-vars
  getFormControlUtilityClasses
} from "@mui/material";


const API = process.env.REACT_APP_API_BASE_URL;

const UserDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([{ MenuItemId: "", quantity: 1 }]);
  const [totalAmount, setTotalAmount] = useState(0);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchOrders = async () => {
    const res = await fetch(`${API}/api/orders/my`, { headers });
    const data = await res.json();
    setOrders(data);
  };

  const fetchVendors = async () => {
    const res = await fetch(`${API}/api/vendors`);
    const data = await res.json();
    setVendors(data);
  };

  const fetchMenuItems = async (vendorId) => {
    const res = await fetch(`${API}/api/menu-items?vendorId=${vendorId}`);
    const data = await res.json();
    setMenuItems(data);
  };

  useEffect(() => {
    fetchOrders();
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVendorChange = (e) => {
    const selectedId = e.target.value;
    setVendorId(selectedId);
    fetchMenuItems(selectedId);
    setItems([{ MenuItemId: "", quantity: 1 }]);
    setTotalAmount(0);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
    calculateTotal(updatedItems);
  };

  const calculateTotal = (orderItems) => {
    let total = 0;
    orderItems.forEach((item) => {
      const menuItem = menuItems.find((mi) => mi.id === parseInt(item.MenuItemId));
      if (menuItem) {
        total += menuItem.price * item.quantity;
      }
    });
    setTotalAmount(total);
  };

  const addItem = () => {
    setItems([...items, { MenuItemId: "", quantity: 1 }]);
  };

  const handleSubmit = async () => {
    const payload = {
      UserId: user.id,
      VendorId: parseInt(vendorId),
      totalAmount,
      items: items.map((item) => ({
        MenuItemId: parseInt(item.MenuItemId),
        quantity: parseInt(item.quantity),
      })),
    };

    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchOrders();
      alert("Order created successfully!");
    } else {
      alert("Failed to create order");
    }
  };

  const deleteOrder = async (orderId) => {
    const res = await fetch(`${API}/api/orders/${orderId}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setOrders(orders.filter((order) => order.id !== orderId));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <Container>
      <AppBar position="static">
        <Toolbar>
          <Navbar role="user"/>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Welcome, {user.name}
          </Typography>
          
        </Toolbar>
      </AppBar>

      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Place New Order
        </Typography>
        <TextField
          select
          label="Select Vendor"
          fullWidth
          value={vendorId}
          onChange={handleVendorChange}
          margin="normal"
        >
          {vendors.map((v) => (
            <MenuItem key={v.id} value={v.id}>
              {v.name} - {v.cuisine}
            </MenuItem>
          ))}
        </TextField>

        {items.map((item, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mt={2}>
            <TextField
              select
              label="Menu Item"
              value={item.MenuItemId}
              onChange={(e) => handleItemChange(index, "MenuItemId", e.target.value)}
              style={{ flex: 1 }}
            >
              {menuItems.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} - ₹{m.price}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Quantity"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
              style={{ width: 100 }}
            />
          </Box>
        ))}

        <Box mt={2}>
          <Button variant="outlined" onClick={addItem}>
            Add Another Item
          </Button>
        </Box>

        <Box mt={2}>
          <Typography>Total: ₹{totalAmount}</Typography>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Submit Order
          </Button>
        </Box>
      </Box>

      <Box mt={5}>
        <Typography variant="h5" gutterBottom>
          Your Orders
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.Vendor?.name}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>₹{order.totalAmount}</TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Container>
  );
};

export default UserDashboard;