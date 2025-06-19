// src/pages/CreateOrder.js
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  MenuItem,
  IconButton,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";

const CreateOrder = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [items, setItems] = useState([{ menuItemId: "", quantity: 1 }]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [message, setMessage] = useState("");

  const fetchMenuItems = async () => {
    const res = await fetch("${process.env.REACT_APP/API_BASE_URL}/api/menu-items");
    const data = await res.json();
    setMenuItems(data);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const calculateTotal = () => {
    let total = 0;
    for (let item of items) {
      const menuItem = menuItems.find((m) => m.id === parseInt(item.menuItemId));
      if (menuItem) {
        total += menuItem.price * item.quantity;
      }
    }
    setTotalAmount(total);
  };

  useEffect(() => {
    calculateTotal();
  }, [items]);

  const handleAddItem = () => {
    setItems([...items, { menuItemId: "", quantity: 1 }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("${process.env.REACT_APP/API_BASE_URL}/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ UserId: userId, VendorId: vendorId, totalAmount, items }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Order created successfully");
      } else {
        setMessage(data.message || "Error creating order");
      }
    } catch (err) {
      setMessage("Server error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Box sx={{ maxWidth: 600, margin: "auto", mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Create Order</Typography>
        <IconButton onClick={handleLogout} title="Logout">
          <LogoutIcon />
        </IconButton>
      </Box>

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          margin="normal"
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <TextField
          fullWidth
          margin="normal"
          label="Vendor ID"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          required
        />

        {items.map((item, index) => (
          <Box key={index} sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField
              select
              label="Menu Item"
              value={item.menuItemId}
              onChange={(e) => handleItemChange(index, "menuItemId", e.target.value)}
              fullWidth
              required
            >
              {menuItems.map((menuItem) => (
                <MenuItem key={menuItem.id} value={menuItem.id}>
                  {menuItem.name} - ₹{menuItem.price}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Quantity"
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value))}
              required
            />
          </Box>
        ))}

        <Button variant="outlined" onClick={handleAddItem}>
          Add Item
        </Button>

        <Typography mt={2}>Total Amount: ₹{totalAmount}</Typography>

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
        >
          Submit Order
        </Button>
      </form>

      {message && (
        <Typography mt={2} color="secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default CreateOrder;