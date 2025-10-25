// src/pages/Checkout.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Box,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";
const hasRzpKey = Boolean(process.env.REACT_APP_RZP_KEY_ID);

// optional envs; default to 0 to avoid surprises
const TAX_RATE = Number(process.env.REACT_APP_TAX_RATE || 0);
const DELIVERY_FEE_DEFAULT = Number(process.env.REACT_APP_DELIVERY_FEE || 0);

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, vendorId, clear } = useCart();

  // form fields
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  // default to COD if no Razorpay key is present
  const [method, setMethod] = useState(hasRzpKey ? "mock_online" : "cod"); // "cod" | "mock_online"
  const [placing, setPlacing] = useState(false);

  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  // restore saved address & method
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem("ck_last_address");
      if (savedAddr) setAddress(savedAddr);
      const savedMethod = localStorage.getItem("ck_last_method");
      if (savedMethod && (savedMethod === "cod" || savedMethod === "mock_online")) {
        // respect key presence
        setMethod(hasRzpKey ? savedMethod : "cod");
      }
    } catch {}
  }, []);

  // persist address & method
  useEffect(() => {
    try {
      localStorage.setItem("ck_last_address", address || "");
    } catch {}
  }, [address]);
  useEffect(() => {
    try {
      localStorage.setItem("ck_last_method", method || "");
    } catch {}
  }, [method]);

  // derived totals
  const { tax, deliveryFee, total } = useMemo(() => {
    const t = Math.max(0, subtotal * TAX_RATE);
    const d = items.length > 0 ? DELIVERY_FEE_DEFAULT : 0;
    return {
      tax: t,
      deliveryFee: d,
      total: subtotal + t + d,
    };
  }, [subtotal, items.length]);

  const placeOrder = async () => {
    if (!token) {
      toast.error("Please log in to place an order.");
      navigate("/login");
      return;
    }
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
      // note: backend is source of truth for totals; we send summary only for reference if needed
      clientSummary: {
        subtotal,
        tax,
        deliveryFee,
        total,
      },
    };

    setPlacing(true);
    try {
      // backend mounted under /api
      const res = await axios.post(
        `${API.replace(/\/+$/, "")}/api/orders`,
        payload,
        { headers, withCredentials: true }
      );

      const created = res.data?.order || res.data; // supports both response shapes
      const orderId = created?.id;
      toast.success(`Order #${orderId || ""} placed`);

      // If offline/COD (or no key), finish here
      if (!(paymentMethod === "mock_online" && hasRzpKey)) {
        clear();
        navigate("/orders");
        return;
      }

      // If online: leave cart intact until payment completes on your payment page
      // You can redirect to a dedicated payment step:
      navigate(`/track/${orderId}`);
    } catch (e) {
      if (e?.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.clear();
        navigate("/login");
        return;
      }
      toast.error(e?.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  // Empty cart screen
  if (items.length === 0) {
    return (
      <Container sx={{ py: 4 }}>
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Your cart is empty
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Add some items from a vendor to continue.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="outlined" onClick={() => navigate("/vendors")}>
              Browse Vendors
            </Button>
            <Button variant="text" onClick={() => navigate("/")}>
              Go to Dashboard
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Checkout
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
        {/* Left column: Delivery & Payment */}
        <Paper sx={{ p: 2, flex: 2 }} variant="outlined">
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
              <FormControlLabel
                value="mock_online"
                control={<Radio />}
                label="Online (Razorpay Test)"
              />
            )}
          </RadioGroup>

          {!hasRzpKey && (
            <Typography variant="caption" color="text.secondary">
              Online payment is temporarily disabled (Razorpay key not configured).
            </Typography>
          )}
        </Paper>

        {/* Right column: Summary */}
        <Paper sx={{ p: 2, flex: 1, minWidth: 300 }} variant="outlined">
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Order Summary
          </Typography>

          <Stack spacing={1} sx={{ mb: 1 }}>
            {items.map((it) => (
              <Stack key={it.id} direction="row" justifyContent="space-between">
                <Typography variant="body2" sx={{ pr: 1 }} noWrap>
                  {it.name} × {it.qty}
                </Typography>
                <Typography variant="body2">
                  <Money v={Number(it.price) * Number(it.qty)} />
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack spacing={0.75}>
            <Row label="Subtotal" value={<Money v={subtotal} />} />
            <Row label={`Tax ${TAX_RATE ? `(${(TAX_RATE * 100).toFixed(0)}%)` : ""}`} value={<Money v={tax} />} />
            <Row label="Delivery fee" value={<Money v={deliveryFee} />} />
            <Divider flexItem />
            <Row label={<Typography variant="subtitle1">Total</Typography>} value={<Typography variant="subtitle1"><Money v={total} /></Typography>} />
          </Stack>

          <Button
            variant="contained"
            sx={{ mt: 2 }}
            fullWidth
            disabled={placing || !address.trim()}
            onClick={placeOrder}
          >
            {placing ? "Placing…" : "Place Order"}
          </Button>

          <Box sx={{ mt: 1 }}>
            {!address.trim() && (
              <Typography variant="caption" color="error">
                Please enter your address to proceed.
              </Typography>
            )}
          </Box>

          <Button
            sx={{ mt: 1 }}
            fullWidth
            variant="text"
            onClick={() => navigate("/vendors")}
          >
            Edit Cart / Continue Shopping
          </Button>
        </Paper>
      </Stack>
    </Container>
  );
}

function Row({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}