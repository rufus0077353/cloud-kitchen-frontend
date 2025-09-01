
import React, { useMemo, useState } from "react";
import {
  Container, Paper, Stack, Typography, TextField, Button, Divider, RadioGroup, FormControlLabel, Radio
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function Checkout() {
  const { items, subtotal, vendorId, clear } = useCart();
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cod"); // "cod" | "mock_online"
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const placeOrder = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!vendorId) {
      toast.error("Missing vendor for cart");
      return;
    }
    if (!address.trim()) {
      toast.error("Please enter delivery address");
      return;
    }

    // backend expects: { vendorId, items: [{ MenuItemId, quantity }], paymentMethod, note, address }
    const payload = {
      vendorId,
      items: items.map(it => ({ MenuItemId: it.id, quantity: it.qty })),
      paymentMethod: method,
      note,
      address
    };

    setPlacing(true);
    try {
      const res = await axios.post(`${API}/api/orders`, payload, { headers });
      const created = res.data;
      toast.success(`Order #${created?.id || ""} placed`);
      clear();
      navigate("/orders");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Checkout</Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ p: 2, flex: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Delivery</Typography>
          <TextField
            label="Address"
            placeholder="Flat/Street, Area, City"
            multiline
            minRows={3}
            fullWidth
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Note (optional)"
            placeholder="Any instruction for the vendor"
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle1" sx={{ mt: 1 }}>Payment</Typography>
          <RadioGroup row value={method} onChange={(e) => setMethod(e.target.value)}>
            <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
            <FormControlLabel value="mock_online" control={<Radio />} label="Online (mock)" />
          </RadioGroup>
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Order Summary</Typography>
          <Stack spacing={1} sx={{ mb: 1 }}>
            {items.map((it) => (
              <Stack key={it.id} direction="row" justifyContent="space-between">
                <Typography variant="body2">{it.name} × {it.qty}</Typography>
                <Typography variant="body2"><Money v={Number(it.price) * Number(it.qty)} /></Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle2">Subtotal</Typography>
            <Typography variant="subtitle2"><Money v={subtotal} /></Typography>
          </Stack>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            fullWidth
            disabled={items.length === 0 || placing}
            onClick={placeOrder}
          >
            {placing ? "Placing…" : "Place Order"}
          </Button>
        </Paper>
      </Stack>
    </Container>
  );
}