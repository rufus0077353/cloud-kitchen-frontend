// src/pages/UserVendorMenu.js
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  Stack,
  CircularProgress,
  Avatar,
  ListItemAvatar,
  Grid,
  Skeleton,
  Divider,
  Chip,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";
const PLACEHOLDER_IMG = "/images/placeholder-food.png";

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
function HeaderSkeleton() {
  return (
    <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
      <Stack direction="row" spacing={2} alignItems="center">
        <Skeleton variant="rounded" width={64} height={64} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="40%" />
          <Skeleton width="60%" />
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={90} height={24} />
            <Skeleton variant="rounded" width={100} height={24} />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function MenuSkeletonGrid() {
  return (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid key={i} item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Skeleton variant="rounded" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="70%" />
                <Skeleton width="40%" />
              </Box>
              <Skeleton variant="rounded" width={92} height={36} />
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

/* ---------- Helper ---------- */
const splitCuisines = (cuisine) =>
  String(cuisine || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

export default function UserVendorMenu() {
  // support either /vendors/:vendorId or /vendors/:id
  const { vendorId: idA, id: idB } = useParams();
  const vendorId = idA ?? idB;
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const { addItem, openDrawer } = useCart();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    (async () => {
      try {
        setLoading(true);
        const [vRes, mRes] = await Promise.all([
          fetch(`${API}/api/vendors/${vendorId}`, { headers }),
          fetch(`${API}/api/vendors/${vendorId}/menu`, { headers }),
        ]);
        const v = (await vRes.json().catch(() => null)) || null;
        const m = (await mRes.json().catch(() => [])) || [];
        setVendor(v);
        setItems(Array.isArray(m) ? m : Array.isArray(m.items) ? m.items : []);
      } catch {
        setVendor(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId]);

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
  };

  const img = isHttpUrl(vendor?.imageUrl) ? vendor.imageUrl : PLACEHOLDER_IMG;
  const rating = Number(vendor?.ratingAvg || 0);
  const rCount = Number(vendor?.ratingCount || 0);
  const eta = Number(vendor?.etaMins || 0);
  const fee = Number(vendor?.deliveryFee || 0);
  const open = vendor?.isOpen !== false; // default true

  return (
    <Container sx={{ py: 3 }}>
      {/* Top actions */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          variant="text"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Button component={Link} to="/vendors" variant="outlined">
          All Vendors
        </Button>
      </Stack>

      {/* Vendor Header */}
      {loading ? (
        <HeaderSkeleton />
      ) : (
        <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={img}
              alt={vendor?.name || "Vendor"}
              variant="rounded"
              sx={{ width: 64, height: 64, flexShrink: 0 }}
              imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  noWrap
                  sx={{ maxWidth: { xs: "70%", sm: "75%" } }}
                >
                  {vendor?.name || "Vendor"}
                </Typography>
                {!open && (
                  <Chip size="small" color="default" variant="outlined" label="Closed" />
                )}
              </Stack>

              {/* Rating • ETA • Fee */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
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

              {/* Cuisine pills */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                {splitCuisines(vendor?.cuisine).map((c) => (
                  <Chip key={c} size="small" label={c} variant="outlined" />
                ))}
                {!vendor?.cuisine && (
                  <Chip size="small" label="All cuisines" variant="outlined" />
                )}
              </Stack>

              {/* Optional description/location */}
              {(vendor?.description || vendor?.location) && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                  noWrap
                >
                  {vendor?.description || vendor?.location}
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Menu */}
      <Paper sx={{ p: 2 }} variant="outlined">
        {loading ? (
          <MenuSkeletonGrid />
        ) : items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography>No items found for this vendor.</Typography>
          </Box>
        ) : (
          <>
            {/* Grid cards */}
            <Grid container spacing={2}>
              {items.map((it) => {
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
                        src={thumb}
                        alt={it.name || "Item"}
                        variant="rounded"
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
                        disabled={open === false}
                      >
                        {open ? "Add" : "Closed"}
                      </Button>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            {/* Optional simple list (long names / accessibility) */}
            <Divider sx={{ my: 3 }} />
            <List dense>
              {items.map((it) => {
                const thumb = isHttpUrl(it.imageUrl) ? it.imageUrl : PLACEHOLDER_IMG;
                return (
                  <ListItem
                    key={`list-${it.id}`}
                    secondaryAction={
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleAdd(it)}
                        disabled={open === false}
                      >
                        {open ? "Add" : "Closed"}
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={thumb}
                        alt={it.name || "Item"}
                        variant="rounded"
                        imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${it.name ?? "Item"} — ₹${Number(it.price ?? 0).toFixed(2)}`}
                      secondary={it.description || ""}
                    />
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </Paper>
    </Container>
  );
}