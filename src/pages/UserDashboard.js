
// src/pages/UserDashboard.js  (READY-PASTE)
import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Button, Container, Typography, Paper,
  Stack, Chip, CircularProgress, List, ListItem, ListItemText,
  ListItemAvatar, Avatar
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";
import { socket } from "../utils/socket";
import { subscribePush } from "../utils/push";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;
const isHttpUrl = (v) => {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const { items, subtotal, addItem, openDrawer } = useCart();

  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const token = localStorage.getItem("token");
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Vendors
  useEffect(() => {
    fetch(`${API_BASE}/api/vendors`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setVendors(Array.isArray(d) ? d : []))
      .catch(() => setVendors([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Menu when vendor changes
  useEffect(() => {
    if (!vendorId) return;
    setLoadingMenu(true);
    fetch(`${API_BASE}/api/vendors/${vendorId}/menu`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMenuItems(Array.isArray(d) ? d : (Array.isArray(d.items) ? d.items : [])))
      .catch(() => setMenuItems([]))
      .finally(() => setLoadingMenu(false));
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Orders
  const fetchOrders = () => {
    setLoadingOrders(true);
    fetch(`${API_BASE}/api/orders/my`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => {
    fetchOrders();
    try { subscribePush?.(); } catch {}
    if (user?.id) socket.emit("user:join", user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (it) => {
    addItem({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: 1,
      vendorId,
      imageUrl: it.imageUrl || null, // 🔹 keep image in cart
    });
    openDrawer();
    toast.success(`${it.name} added to cart`);
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Welcome, {user?.name || "User"}
      </Typography>

      {/* Pick vendor & add items right on the dashboard */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Select a Vendor</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {vendors.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              color={String(v.id) === String(vendorId) ? "primary" : "default"}
              onClick={() => setVendorId(v.id)}
              clickable
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>

        {vendorId && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>Menu Items</Typography>
            {loadingMenu ? (
              <CircularProgress size={24} />
            ) : menuItems.length === 0 ? (
              <Typography>No items found for this vendor.</Typography>
            ) : (
              <List>
                {menuItems.map((it) => (
                  <ListItem
                    key={it.id}
                    secondaryAction={
                      <Button variant="contained" size="small" onClick={() => handleAdd(it)}>
                        Add to Cart
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      {isHttpUrl(it.imageUrl) ? (
                        <Avatar
                          variant="rounded"
                          src={it.imageUrl}
                          alt={it.name || "Item"}
                          sx={{ width: 48, height: 48 }}
                          imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 48, height: 48 }}>
                          {String(it.name || "?").slice(0, 1).toUpperCase()}
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${it.name} — ₹${Number(it.price || 0).toFixed(2)}`}
                      secondary={it.description || ""}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>

      {/* Cart summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Cart Summary</Typography>
        {items.length === 0 ? (
          <Typography color="text.secondary">Your cart is empty.</Typography>
        ) : (
          <>
            <List dense>
              {items.map((it) => (
                <ListItem
                  key={it.id}
                  disableGutters
                  secondaryAction={<Money v={Number(it.price) * Number(it.qty)} />}
                >
                  <ListItemAvatar sx={{ mr: 1 }}>
                    {isHttpUrl(it.imageUrl) ? (
                      <Avatar
                        variant="rounded"
                        src={it.imageUrl}
                        alt={it.name || "Item"}
                        sx={{ width: 36, height: 36 }}
                        imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                      />
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 36, height: 36 }}>
                        {String(it.name || "?").slice(0, 1).toUpperCase()}
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText primary={`${it.name} × ${it.qty}`} />
                </ListItem>
              ))}
            </List>
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="subtitle1">Subtotal</Typography>
              <Typography variant="subtitle1"><Money v={subtotal} /></Typography>
            </Box>
            <Stack direction="row" spacing={2} mt={2}>
              <Button variant="outlined" onClick={openDrawer}>Open Cart</Button>
              <Button
                variant="contained"
                onClick={() => navigate("/checkout")}
                disabled={items.length === 0}
              >
                Go to Checkout
              </Button>
            </Stack>
          </>
        )}
      </Paper>

      {/* Recent Orders */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Your Orders</Typography>
        {loadingOrders ? (
          <CircularProgress size={24} />
        ) : orders.length === 0 ? (
          <Typography>No orders yet.</Typography>
        ) : (
          <List>
            {orders.map((o) => (
              <ListItem
                key={o.id}
                disableGutters
                secondaryAction={<Typography>₹{Number(o.totalAmount || 0).toFixed(2)}</Typography>}
              >
                <ListItemText
                  primary={`#${o.id} — ${(o.status || "pending").toUpperCase()}`}
                  secondary={new Date(o.createdAt || o.created_at || Date.now()).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}