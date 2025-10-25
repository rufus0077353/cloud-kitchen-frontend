import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "@mui/material";
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

export default function UserVendorMenu() {
  const { vendorId } = useParams();
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem, openDrawer } = useCart();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    (async () => {
      try {
        const [vRes, mRes] = await Promise.all([
          fetch(`${API}/api/vendors/${vendorId}`, { headers }),
          fetch(`${API}/api/vendors/${vendorId}/menu`, { headers }),
        ]);
        const v = (await vRes.json().catch(() => null)) || null;
        const m = (await mRes.json().catch(() => []) ) || [];
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

  return (
    <Container sx={{ py: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
        spacing={1.5}
      >
        <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
          {vendor?.name || "Vendor Menu"}
        </Typography>
        <Button component={Link} to="/vendors" variant="outlined">
          Back to Vendors
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }} variant="outlined">
        {loading ? (
          <MenuSkeletonGrid />
        ) : items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography>No items found for this vendor.</Typography>
          </Box>
        ) : (
          <>
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
                      <Button variant="contained" size="small" onClick={() => handleAdd(it)}>
                        Add
                      </Button>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            {/* Optional legacy list below for accessibility / long names */}
            <Divider sx={{ my: 3 }} />
            <List dense>
              {items.map((it) => {
                const thumb = isHttpUrl(it.imageUrl) ? it.imageUrl : PLACEHOLDER_IMG;
                return (
                  <ListItem
                    key={`list-${it.id}`}
                    secondaryAction={
                      <Button variant="text" size="small" onClick={() => handleAdd(it)}>
                        Add
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