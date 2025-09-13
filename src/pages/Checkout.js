
// src/pages/Checkout.jsx
import React, { useMemo, useState } from "react";
import {
  Container,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";
const hasRzpKey = Boolean(process.env.REACT_APP_RZP_KEY_ID);

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function Checkout() {
  const { items, subtotal, vendorId, clear } = useCart();
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  // default to COD if no Razorpay key is present
  const [method, setMethod] = useState(hasRzpKey ? "mock_online" : "cod"); // "cod" | "mock_online"
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

    // If no frontend key, force COD even if UI says online
    const paymentMethod = hasRzpKey ? method : "cod";

    const payload = {
      VendorId: Number(vendorId),
      items: items.map((it) => ({
        MenuItemId: Number(it.id),
        quantity: Number(it.qty),
      })),
      paymentMethod,
      note,
      address,
    };

    setPlacing(true);
    try {
      // IMPORTANT: backend is mounted under /api
      const res = await axios.post(`${API.replace(/\/+$/, "")}/api/orders`, payload, { headers });
      const created = res.data?.order || res.data; // supports both response shapes

      toast.success(`Order #${created?.id || ""} placed`);

      // If not doing online (or key missing), finish here
      if (!(paymentMethod === "mock_online" && hasRzpKey)) {
        clear();
        navigate("/orders");
      }
      // If you want to start payment immediately after create,
      // do it here (render PayNowButton on an Order page, etc.)
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Checkout
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ p: 2, flex: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Delivery
          </Typography>

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

          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Payment
          </Typography>

          <RadioGroup
            row
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
            {hasRzpKey && (
              <FormControlLabel value="mock_online" control={<Radio />} label="Online (Razorpay Test)" />
            )}
          </RadioGroup>

          {!hasRzpKey && (
            <Typography variant="caption" color="text.secondary">
              Online payment is temporarily disabled (Razorpay key not configured).
            </Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Order Summary
          </Typography>

          <Stack spacing={1} sx={{ mb: 1 }}>
            {items.map((it) => (
              <Stack key={it.id} direction="row" justifyContent="space-between">
                <Typography variant="body2">
                  {it.name} × {it.qty}
                </Typography>
                <Typography variant="body2">
                  <Money v={Number(it.price) * Number(it.qty)} />
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle2">Subtotal</Typography>
            <Typography variant="subtitle2">
              <Money v={subtotal} />
            </Typography>
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