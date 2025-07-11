
// src/pages/OrderForm.js
import React, { useState, useEffect } from "react";
import {
  Container, Typography, TextField, MenuItem, Button,
  Select, InputLabel, FormControl, Box
} from "@mui/material";
import { useNavigate } from "react-router-dom";



const OrderForm = () => {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  

  useEffect(() => {
    fetch(`${REACT_APP_API_BASE_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => setUsers(data));

    fetch(`${REACT_APP_API_BASE_URL}/api/vendors`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => setVendors(data));
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      fetch(`${REACT_APP_API_BASE_URL}/api/menu-items/vendor/${selectedVendor}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      })
        .then(res => res.json())
        .then(data => setMenuItems(data));
    }
  }, [selectedVendor]);

  const handleAddItem = () => {
    setItems([...items, { menuItemId: "", quantity: 1 }]);
  };

  const handleChangeItem = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const totalAmount = items.reduce((sum, item) => {
      const menuItem = menuItems.find(mi => mi.id === parseInt(item.menuItemId));
      return sum + (menuItem ? menuItem.price * item.quantity : 0);
    }, 0);

    const payload = {
      UserId: selectedUser,
      VendorId: selectedVendor,
      totalAmount,
      items
    };

    const res = await fetch(`${REACT_APP_API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const result = await res.json();
      localStorage.setItem("lastOrderId", result.order.id);
      navigate("/order-success");
    } else {
      alert("Failed to create order");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5 }}>
      <Box display="flex" justifyContent="space-between">
        <Typography variant="h4">Create Order</Typography>
        <Button variant="outlined" color="error" onClick={handleLogout}>Logout</Button>
      </Box>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel>User</InputLabel>
          <Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} required>
            {users.map(user => (
              <MenuItem key={user.id} value={user.id}>{user.name} ({user.email})</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Vendor</InputLabel>
          <Select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)} required>
            {vendors.map(vendor => (
              <MenuItem key={vendor.id} value={vendor.id}>{vendor.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="h6" mt={2}>Items</Typography>
        {items.map((item, index) => (
          <Box key={index} display="flex" gap={2} alignItems="center" mb={2}>
            <FormControl fullWidth>
              <InputLabel>Menu Item</InputLabel>
              <Select
                value={item.menuItemId}
                onChange={(e) => handleChangeItem(index, "menuItemId", e.target.value)}
                required
              >
                {menuItems.map(menuItem => (
                  <MenuItem key={menuItem.id} value={menuItem.id}>
                    {menuItem.name} (${menuItem.price})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="number"
              label="Quantity"
              value={item.quantity}
              onChange={(e) => handleChangeItem(index, "quantity", parseInt(e.target.value))}
              inputProps={{ min: 1 }}
              required
            />
          </Box>
        ))}

        <Button variant="outlined" onClick={handleAddItem}>Add Another Item</Button>

        <Button type="submit" variant="contained" color="primary" sx={{ mt: 3 }}>
          Submit Order
        </Button>
      </form>
    </Container>
  );
};

export default OrderForm;