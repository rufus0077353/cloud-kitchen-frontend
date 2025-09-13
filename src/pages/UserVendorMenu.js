// src/pages/UserVendorMenu.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box, Container, Typography, Paper, List, ListItem,
  ListItemText, Button, Stack, CircularProgress,
  Avatar, ListItemAvatar
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
        const v = await vRes.json().catch(() => null);
        const m = await mRes.json().catch(() => []);
        setVendor(v || null);
        setItems(Array.isArray(m) ? m : (Array.isArray(m.items) ? m.items : []));
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
      imageUrl: isHttpUrl(it.imageUrl) ? it.imageUrl : null, // keep image in cart if valid
    });
    openDrawer(); // show cart immediately
  };

  return (
    <Container sx={{ py: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">{vendor?.name || "Vendor Menu"}</Typography>
        <Button component={Link} to="/vendors" variant="outlined">
          Back to Vendors
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <List>
            {(items || []).map((it) => {
              const thumb = isHttpUrl(it.imageUrl) ? it.imageUrl : PLACEHOLDER_IMG;
              return (
                <ListItem
                  key={it.id}
                  secondaryAction={
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleAdd(it)}
                    >
                      Add to Cart
                    </Button>
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      src={thumb}
                      alt={it.name || "Item"}
                      variant="rounded"
                      sx={{ width: 56, height: 56 }}
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
            {(items || []).length === 0 && (
              <ListItem>
                <ListItemText primary="No items found." />
              </ListItem>
            )}
          </List>
        </Paper>
      )}
    </Container>
  );
}