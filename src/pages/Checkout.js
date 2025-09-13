
import React, { useMemo, useState } from "react";
import {
  Container, Paper, Stack, Typography, TextField, Button, Divider, RadioGroup, FormControlLabel, Radio
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useCart } from "../context/CartContext";
import PayNowButton from "../components/PayNowButton";

const API = process.env.REACT_APP_API_BASE_URL || ""; // should already include /api

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, vendorId, clear } = useCart();

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("cod"); // "cod" | "online"
  const [placing, setPlacing] = useState(false);

  // when an online order is created, we store it here to render PayNowButton
  const [createdOrder, setCreatedOrder] = useState(null);

  // auth + user
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const validate = () => {
    if (!items?.length) { toast.error("Your cart is empty"); return false; }
    if (!vendorId)      { toast.error("Missing vendor for cart"); return false; }
    if (!address.trim()){ toast.error("Please enter delivery address"); return false; }
    return true;
  };

  // Create Servezy order in DB (status: PENDING_PAYMENT for online, or COD)
  const createAppOrder = async () => {
    // IMPORTANT: align with your backend DTO
    const payload = {
      VendorId: Number(vendorId),
      items: items.map(it => ({ MenuItemId: Number(it.id), quantity: Number(it.qty) })),
      address,
      note,
      paymentMethod: method, // backend can use this to set initial status
    };
    const res = await axios.post(`${API}/api/orders`, payload, { headers });
    return res.data; // assume { id, totalAmount, ... }
  };

  const placeOrder = async () => {
    if (!validate()) return;

    setPlacing(true);
    try {
      const created = await createAppOrder();

      if (method === "cod") {
        toast.success(`Order #${created?.id || ""} placed (COD)`);
        clear();
        navigate("/orders");
        return;
      }

      // Online path: show Pay button
      setCreatedOrder(created);
      toast.info("Order created. Continue to payment.");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const handlePaymentSuccess = () => {
    // after verify in PayNowButton
    clear();
    navigate("/orders"); // or navigate(`/orders/${createdOrder.id}/success`)
  };

  const totalAmount = useMemo(() => {
    // if backend recalculates, this is just for UI display
    return Number(subtotal || 0);
  }, [subtotal]);

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Checkout</Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* Left: Delivery & Payment selection */}
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
          <RadioGroup
            row
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setCreatedOrder(null); // reset if toggled after creation
            }}
          >
            <FormControlLabel value="cod" control={<Radio />} label="Cash on Delivery" />
            <FormControlLabel value="online" control={<Radio />} label="Online (Razorpay Test)" />
          </RadioGroup>
        </Paper>

        {/* Right: Summary / Pay */}
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
            <Typography variant="subtitle2"><Money v={totalAmount} /></Typography>
          </Stack>

          {/* Primary action: create order (COD) or create+show Razorpay */}
          {!createdOrder ? (
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              fullWidth
              disabled={items.length === 0 || placing}
              onClick={placeOrder}
            >
              {placing ? "Placing…" : method === "cod" ? "Place Order (COD)" : "Proceed to Pay"}
            </Button>
          ) : (
            // After order is created for ONLINE, render the Razorpay button
            <PayNowButton appOrder={createdOrder} user={user} onSuccess={handlePaymentSuccess} />
          )}
        </Paper>
      </Stack>
    </Container>
  );
}