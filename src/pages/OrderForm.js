
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
  const { openDrawer } = useCart();

  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [items, setItems] = useState([]); // {MenuItemId, quantity}

  const headers = useMemo(() => ({
    "Content-Type": "application/json", Authorization: `Bearer ${token}`
  }), [token]);

  useEffect(() => {
    (async () => {
      try {
        const [u, v] = await Promise.all([
          fetch(`${API}/api/admin/users`, { headers }),
          fetch(`${API}/api/vendors`, { headers })
        ]);
        setUsers(await u.json().catch(() => []));
        setVendors(await v.json().catch(() => []));
      } catch { toast.error("Failed to load users/vendors"); }
    })();
  }, [API, headers]);

  useEffect(() => {
    if (!selectedVendor) { setMenuItems([]); setItems([]); return; }
    (async () => {
      try {
        const r = await fetch(`${API}/api/menu-items/vendor/${selectedVendor}`, { headers });
        const data = await r.json().catch(() => []);
        setMenuItems(Array.isArray(data) ? data : []);
        setItems([]);
      } catch { toast.error("Failed to load menu"); }
    })();
  }, [API, headers, selectedVendor]);

  const addLine = () => setItems(p => [...p, { MenuItemId: "", quantity: 1 }]);
  const changeLine = (i, field, value) => setItems(p => (p.map((it, idx) => idx===i ? { ...it, [field]: value } : it)));

  const total = useMemo(() => items.reduce((s, it) => {
    const mi = menuItems.find(m => Number(m.id) === Number(it.MenuItemId));
    return s + (mi ? Number(mi.price) * Number(it.quantity || 0) : 0);
  }, 0), [items, menuItems]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return toast.error("Select a user");
    if (!selectedVendor) return toast.error("Select a vendor");
    const cleaned = items.filter(it => Number(it.MenuItemId) && Number(it.quantity) > 0)
                         .map(it => ({ MenuItemId: Number(it.MenuItemId), quantity: Number(it.quantity) }));
    if (cleaned.length === 0) return toast.error("Add at least one item");

    const payload = {
      UserId: Number(selectedUser),
      VendorId: Number(selectedVendor),
      totalAmount: Number(total),
      items: cleaned
    };

    try {
      const res = await fetch(`${API}/api/orders`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.message || "Failed to create order");
      const result = await res.json();
      localStorage.setItem("lastOrderId", result?.order?.id || result?.id || "");
      toast.success("Order created");
      navigate("/orders/success");
    } catch (err) { toast.error(err.message || "Failed to create order"); }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 6 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Create Order (Admin)</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>Browse Vendors</Button>
          <Button variant="outlined" startIcon={<ShoppingCartIcon />} onClick={openDrawer}>Open Cart</Button>
          <Button variant="outlined" startIcon={<ShoppingCartCheckoutIcon />} onClick={() => navigate("/checkout")}>Checkout</Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2 }}>
        <form onSubmit={submit}>
          <FormControl fullWidth margin="normal">
            <InputLabel>User</InputLabel>
            <Select value={selectedUser} label="User" onChange={(e)=>setSelectedUser(e.target.value)} required>
              {users.map(u => (<MenuItem key={u.id} value={u.id}>{u.name} ({u.email})</MenuItem>))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Vendor</InputLabel>
            <Select value={selectedVendor} label="Vendor" onChange={(e)=>setSelectedVendor(e.target.value)} required>
              {vendors.map(v => (<MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>))}
            </Select>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 1 }}>Items</Typography>

          {items.map((it, idx) => (
            <Box key={idx} display="flex" gap={2} alignItems="center" mb={2}>
              <FormControl fullWidth>
                <InputLabel>Menu Item</InputLabel>
                <Select value={it.MenuItemId} label="Menu Item"
                        onChange={(e)=>changeLine(idx, "MenuItemId", e.target.value)} required>
                  {menuItems.map(mi => (
                    <MenuItem key={mi.id} value={mi.id}>{mi.name} (<Money v={mi.price} />)</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField type="number" label="Quantity" value={it.quantity}
                         onChange={(e)=>changeLine(idx, "quantity", Math.max(1, Number(e.target.value || 1)))}
                         inputProps={{ min: 1 }} required sx={{ width: 140 }}/>
            </Box>
          ))}

          {items.length === 0 && (<Typography color="text.secondary" sx={{ mb: 1 }}>No items yet. Click “Add Another Item”.</Typography>)}

          <Button variant="outlined" onClick={addLine}>Add Another Item</Button>

          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }}>
            <Typography variant="h6">Total: <Money v={total} /></Typography>
            <Button type="submit" variant="contained" disabled={items.length === 0}>Submit Order</Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
}