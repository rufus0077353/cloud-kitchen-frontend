// src/pages/OrderForm.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Container, Typography, TextField, MenuItem, Button,
  Select, InputLabel, FormControl, Box, Paper, Stack, Divider
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function OrderForm() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const { openDrawer } = useCart(); // optional: lets you open the cart from here

  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  // Keep the casing aligned to backend: MenuItemId + quantity
  const [items, setItems] = useState([]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  // load users & vendors
  useEffect(() => {
    (async () => {
      try {
        const [u, v] = await Promise.all([
          fetch(`${API}/api/admin/users`, { headers }),
          fetch(`${API}/api/vendors`, { headers }),
        ]);
        const uData = await u.json().catch(() => []);
        const vData = await v.json().catch(() => []);
        setUsers(Array.isArray(uData) ? uData : []);
        setVendors(Array.isArray(vData) ? vData : []);
      } catch {
        toast.error("Failed to load users/vendors");
      }
    })();
  }, [API, headers]);

  // load menu for selected vendor
  useEffect(() => {
    if (!selectedVendor) {
      setMenuItems([]);
      setItems([]);
      return;
    }
    (async () => {
      try {
        // Your API variant: either /api/menu-items/vendor/:id or /api/vendors/:id/menu
        // Keeping your original route:
        const res = await fetch(`${API}/api/menu-items/vendor/${selectedVendor}`, { headers });
        const data = await res.json().catch(() => []);
        setMenuItems(Array.isArray(data) ? data : []);
        setItems([]); // reset selections when vendor changes
      } catch {
        setMenuItems([]);
        toast.error("Failed to load menu");
      }
    })();
  }, [API, headers, selectedVendor]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { MenuItemId: "", quantity: 1 }]);
  };

  const handleChangeItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, it) => {
      const mi = menuItems.find((m) => Number(m.id) === Number(it.MenuItemId));
      return sum + (mi ? Number(mi.price) * Number(it.quantity || 0) : 0);
    }, 0);
  }, [items, menuItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedUser) return toast.error("Please select a user");
    if (!selectedVendor) return toast.error("Please select a vendor");

    const cleaned = items
      .filter((it) => Number(it.MenuItemId) && Number(it.quantity) > 0)
      .map((it) => ({
        MenuItemId: Number(it.MenuItemId),
        quantity: Number(it.quantity),
      }));

    if (cleaned.length === 0) {
      return toast.error("Add at least one item");
    }

    const payload = {
      UserId: Number(selectedUser),
      VendorId: Number(selectedVendor),
      totalAmount: Number(totalAmount),
      items: cleaned,
    };

    try {
      const res = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.message || "Failed to create order";
        throw new Error(msg);
      }

      const result = await res.json();
      // your routes define: /orders/success
      localStorage.setItem("lastOrderId", result?.order?.id || result?.id || "");
      toast.success("Order created");
      navigate("/orders/success");
    } catch (err) {
      toast.error(err.message || "Failed to create order");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 6 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Create Order (Admin)</Typography>
        <Button variant="outlined" color="error" onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      {/* Cart-first shortcuts (optional but handy) */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button
            variant="contained"
            startIcon={<StorefrontIcon />}
            onClick={() => navigate("/vendors")}
          >
            Browse Vendors & Add Items
          </Button>
          <Button
            variant="outlined"
            startIcon={<ShoppingCartIcon />}
            onClick={openDrawer}
          >
            Open Cart
          </Button>
          <Button
            variant="outlined"
            startIcon={<ShoppingCartCheckoutIcon />}
            onClick={() => navigate("/checkout")}
          >
            Go to Checkout
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel>User</InputLabel>
            <Select
              value={selectedUser}
              label="User"
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Vendor</InputLabel>
            <Select
              value={selectedVendor}
              label="Vendor"
              onChange={(e) => setSelectedVendor(e.target.value)}
              required
            >
              {vendors.map((vendor) => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 1 }}>
            Items
          </Typography>

          {items.map((item, index) => (
            <Box key={index} display="flex" gap={2} alignItems="center" mb={2}>
              <FormControl fullWidth>
                <InputLabel>Menu Item</InputLabel>
                <Select
                  value={item.MenuItemId}
                  label="Menu Item"
                  onChange={(e) => handleChangeItem(index, "MenuItemId", e.target.value)}
                  required
                >
                  {menuItems.map((mi) => (
                    <MenuItem key={mi.id} value={mi.id}>
                      {mi.name} (<Money v={mi.price} />)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                type="number"
                label="Quantity"
                value={item.quantity}
                onChange={(e) => handleChangeItem(index, "quantity", Math.max(1, Number(e.target.value || 1)))}
                inputProps={{ min: 1 }}
                required
                sx={{ width: 140 }}
              />
            </Box>
          ))}

          {items.length === 0 && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No items yet. Click “Add Another Item.”
            </Typography>
          )}

          <Button variant="outlined" onClick={handleAddItem}>
            Add Another Item
          </Button>

          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }}>
            <Typography variant="h6">Total: <Money v={totalAmount} /></Typography>
            <Button type="submit" variant="contained" color="primary" disabled={items.length === 0}>
              Submit Order
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
}