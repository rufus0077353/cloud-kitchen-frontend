// src/components/CartDrawer.jsx
import React from "react";
import {
  Drawer, Box, Typography, IconButton, Divider, Stack, TextField, Button
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function CartDrawer({ open, onClose }) {
  const { items, setQty, remove, subtotal, totalQty } = useCart();
  const navigate = useNavigate();

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: 330, sm: 380 }, p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Your Cart</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Your cart is empty.</Typography>
          ) : items.map((it) => (
            <Stack key={it.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" noWrap>{it.name}</Typography>
                <Typography variant="caption" color="text.secondary"><Money v={it.price} /> each</Typography>
              </Box>
              <TextField
                size="small"
                type="number"
                value={it.qty}
                onChange={(e) => setQty(it.id, e.target.value)}
                inputProps={{ min: 1, style: { width: 60, textAlign: "center" } }}
              />
              <Typography sx={{ width: 80, textAlign: "right" }}>
                <Money v={Number(it.price) * Number(it.qty)} />
              </Typography>
              <IconButton color="error" onClick={() => remove(it.id)}><DeleteIcon /></IconButton>
            </Stack>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Items</Typography>
          <Typography variant="body2">{totalQty}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Subtotal</Typography>
          <Typography variant="subtitle1"><Money v={subtotal} /></Typography>
        </Stack>

        <Button
          variant="contained"
          disabled={items.length === 0}
          onClick={() => { onClose?.(); navigate("/checkout"); }}
        >
          Go to Checkout
        </Button>
      </Box>
    </Drawer>
  );
}