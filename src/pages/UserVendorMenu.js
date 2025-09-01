import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box, Container, Typography, Paper, List, ListItem,
  ListItemText, Button, Stack, CircularProgress
} from "@mui/material";

// If you have CartContext set up, this will work; if not, it still builds
let useCartSafe = () => ({ addItem: () => {} });
try {
  // optional import — won’t crash build if you don’t have it wired yet
  // eslint-disable-next-line global-require
  const mod = require("../context/CartContext");
  if (mod && mod.useCart) useCartSafe = mod.useCart;
} catch {}

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function UserVendorMenu() {
  const { vendorId } = useParams();
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCartSafe();

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

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">{vendor?.name || "Vendor Menu"}</Typography>
        <Button component={Link} to="/vendors" variant="outlined">Back to Vendors</Button>
      </Stack>

      {loading ? (
        <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Box>
      ) : (
        <Paper>
          <List>
            {(items || []).map((it) => (
              <ListItem
                key={it.id}
                secondaryAction={
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => addItem({ id: it.id, name: it.name, price: it.price, qty: 1, vendorId })}
                  >
                    Add
                  </Button>
                }
              >
                <ListItemText
                  primary={`${it.name ?? "Item"} — ₹${Number(it.price ?? 0).toFixed(2)}`}
                  secondary={it.description || ""}
                />
              </ListItem>
            ))}
            {(items || []).length === 0 && (
              <ListItem><ListItemText primary="No items found." /></ListItem>
            )}
          </List>
        </Paper>
      )}
    </Container>
  );
}