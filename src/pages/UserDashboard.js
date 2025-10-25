
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Grid,
  Skeleton,
  Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";
import { socket } from "../utils/socket";
import { subscribePush } from "../utils/push";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";
const PLACEHOLDER_IMG = "/images/placeholder-food.png";

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

function VendorChipsSkeleton() {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={100} height={32} />
      ))}
    </Stack>
  );
}

function MenuSkeleton() {
  return (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid key={i} item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Skeleton variant="rounded" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </Box>
              <Skeleton variant="rounded" width={96} height={36} />
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const { items, subtotal, addItem, openDrawer } = useCart();

  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

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
    setVendorsLoading(true);
    fetch(`${API_BASE}/api/vendors`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setVendors(Array.isArray(d) ? d : []))
      .catch(() => setVendors([]))
      .finally(() => setVendorsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu when vendor changes
  useEffect(() => {
    if (!vendorId) return;
    setLoadingMenu(true);
    fetch(`${API_BASE}/api/vendors/${vendorId}/menu`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setMenuItems(Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : [])
      )
      .catch(() => setMenuItems([]))
      .finally(() => setLoadingMenu(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

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
    try {
      subscribePush?.();
    } catch {}
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
      imageUrl: isHttpUrl(it.imageUrl) ? it.imageUrl : null,
    });
    openDrawer();
    toast.success(`${it.name} added to cart`);
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Welcome, {user?.name || "User"}
      </Typography>

      {/* SELECT A VENDOR */}
      <Paper sx={{ p: 3, mb: 3 }} elevation={0} variant="outlined">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">Select a Vendor</Typography>
          {vendors.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setVendorId("")}
              disabled={!vendorId}
            >
              Clear Selection
            </Button>
          )}
        </Stack>

        {vendorsLoading ? (
          <VendorChipsSkeleton />
        ) : vendors.length === 0 ? (
          <Typography color="text.secondary">No vendors available right now.</Typography>
        ) : (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {vendors.map((v) => {
              const selected = String(v.id) === String(vendorId);
              return (
                <Chip
                  key={v.id}
                  label={v.name}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => setVendorId(v.id)}
                  clickable
                  sx={{
                    mb: 1,
                    borderRadius: 999,
                  }}
                />
              );
            })}
          </Stack>
        )}

        {/* MENU LIST */}
        {vendorId && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Menu Items
            </Typography>

            {loadingMenu ? (
              <MenuSkeleton />
            ) : menuItems.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{ p: 3, borderStyle: "dashed", textAlign: "center" }}
              >
                <Typography>No items found for this vendor.</Typography>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {menuItems.map((it) => {
                  const thumb = isHttpUrl(it.imageUrl) ? it.imageUrl : PLACEHOLDER_IMG;
                  return (
                    <Grid key={it.id} item xs={12} sm={6} md={4}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <Avatar
                          variant="rounded"
                          src={thumb}
                          alt={it.name || "Item"}
                          sx={{ width: 56, height: 56, flexShrink: 0 }}
                          imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {it.name ?? "Item"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            ₹{Number(it.price ?? 0).toFixed(2)}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleAdd(it)}
                        >
                          Add
                        </Button>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}
      </Paper>

      {/* CART SUMMARY */}
      <Paper sx={{ p: 3, mb: 3 }} elevation={0} variant="outlined">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography variant="h6">Cart Summary</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={openDrawer}>
              Open Cart
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate("/checkout")}
              disabled={items.length === 0}
            >
              Go to Checkout
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {items.length === 0 ? (
          <Typography color="text.secondary">
            Your cart is empty. Pick a vendor to start ordering.
          </Typography>
        ) : (
          <>
            <List dense>
              {items.map((it) => {
                const thumb = isHttpUrl(it.imageUrl) ? it.imageUrl : PLACEHOLDER_IMG;
                return (
                  <ListItem
                    key={it.id}
                    disableGutters
                    secondaryAction={<Money v={Number(it.price) * Number(it.qty)} />}
                  >
                    <ListItemAvatar sx={{ mr: 1 }}>
                      <Avatar
                        variant="rounded"
                        src={thumb}
                        alt={it.name || "Item"}
                        sx={{ width: 36, height: 36 }}
                        imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                      />
                    </ListItemAvatar>
                    <ListItemText primary={`${it.name} × ${it.qty}`} />
                  </ListItem>
                );
              })}
            </List>
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="subtitle1">Subtotal</Typography>
              <Typography variant="subtitle1">
                <Money v={subtotal} />
              </Typography>
            </Box>
          </>
        )}
      </Paper>

      {/* RECENT ORDERS */}
      <Paper sx={{ p: 3 }} elevation={0} variant="outlined">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">Your Orders</Typography>
          <Button variant="outlined" onClick={() => navigate("/orders")}>
            View All Orders
          </Button>
        </Stack>

        {loadingOrders ? (
          <Stack direction="row" gap={1} alignItems="center">
            <CircularProgress size={20} /> <span>Loading…</span>
          </Stack>
        ) : orders.length === 0 ? (
          <Typography color="text.secondary">No orders yet.</Typography>
        ) : (
          <List>
            {orders.slice(0, 8).map((o) => (
              <ListItem
                key={o.id}
                disableGutters
                secondaryAction={
                  <Typography>₹{Number(o.totalAmount || 0).toFixed(2)}</Typography>
                }
              >
                <ListItemText
                  primary={`#${o.id} — ${(o.status || "pending").toUpperCase()}`}
                  secondary={new Date(
                    o.createdAt || o.created_at || Date.now()
                  ).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}