
// src/pages/UserDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Stack,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Grid,
  Skeleton,
  Divider,
  Chip,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
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

/* ---------- Skeletons ---------- */
function VendorGridSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <Skeleton variant="rectangular" height={140} />
            <CardContent>
              <Skeleton width="60%" />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Skeleton variant="rounded" width={70} height={22} />
                <Skeleton variant="rounded" width={80} height={22} />
                <Skeleton variant="rounded" width={90} height={22} />
              </Stack>
            </CardContent>
          </Card>
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

  // Add from menu page (kept because other parts of the page use the cart)
  const handleAdd = (it) => {
    addItem({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: 1,
      vendorId: it.VendorId ?? it.vendorId,
      imageUrl: isHttpUrl(it.imageUrl) ? it.imageUrl : null,
    });
    openDrawer();
    toast.success(`${it.name} added to cart`);
  };

  const cuisineChips = (cuisine) =>
    String(cuisine || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Welcome, {user?.name || "User"}
      </Typography>

      {/* ====== VENDOR GRID (click card -> /vendors/:id) ====== */}
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
            <Button size="small" variant="outlined" onClick={() => navigate("/vendors")}>
              See All Vendors
            </Button>
          )}
        </Stack>

        {vendorsLoading ? (
          <VendorGridSkeleton />
        ) : vendors.length === 0 ? (
          <Typography color="text.secondary">No vendors available right now.</Typography>
        ) : (
          <Grid container spacing={2}>
            {vendors.map((v) => {
              const img = isHttpUrl(v.imageUrl) ? v.imageUrl : PLACEHOLDER_IMG;
              const fee = Number(v.deliveryFee || 0);
              const rating = Number(v.ratingAvg || 0);
              const rCount = Number(v.ratingCount || 0);
              const eta = Number(v.etaMins || 0);
              const open = v.isOpen !== false;

              return (
                <Grid item xs={12} sm={6} md={4} key={v.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderRadius: 2,
                      opacity: open ? 1 : 0.6,
                    }}
                  >
                    <CardActionArea
                      onClick={() => (open ? navigate(`/vendors/${v.id}`) : null)}
                      disabled={!open}
                      sx={{ height: "100%" }}
                    >
                      <CardMedia
                        component="img"
                        height="160"
                        image={img}
                        alt={v.name || "Vendor"}
                        sx={{ objectFit: "cover" }}
                      />
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} noWrap>
                          {v.name}
                        </Typography>

                        {/* Rating • ETA • Fee */}
                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          sx={{ mt: 0.5, flexWrap: "wrap" }}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <StarIcon fontSize="small" />
                            <Typography variant="body2">
                              {rating > 0 ? rating.toFixed(1) : "—"}{" "}
                              {rCount > 0 ? `(${rCount})` : ""}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AccessTimeIcon fontSize="small" />
                            <Typography variant="body2">
                              {eta > 0 ? `${eta} mins` : "—"}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <CurrencyRupeeIcon fontSize="small" />
                            <Typography variant="body2">
                              {fee > 0 ? fee.toFixed(0) : "Free delivery"}
                            </Typography>
                          </Stack>
                        </Stack>

                        {/* Cuisine chips */}
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                          {cuisineChips(v.cuisine).map((c) => (
                            <Chip key={c} size="small" label={c} variant="outlined" />
                          ))}
                          {!v.cuisine && (
                            <Chip size="small" label="All cuisines" variant="outlined" />
                          )}
                        </Stack>

                        {(v.description || v.location) && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                            noWrap
                          >
                            {v.description || v.location}
                          </Typography>
                        )}

                        {!open && (
                          <Chip
                            label="Closed"
                            size="small"
                            color="default"
                            variant="outlined"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>

      {/* ====== CART SUMMARY ====== */}
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

      {/* ====== RECENT ORDERS ====== */}
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