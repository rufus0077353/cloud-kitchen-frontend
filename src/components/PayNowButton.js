
// src/components/PayNowButton.jsx
import { useState } from "react";
import { Button } from "@mui/material";
import { toast } from "react-toastify";
import loadRazorpay from "../utils/loadRazorpay";
import api from "../utils/api";

export default function PayNowButton({ appOrder, user, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      // ---- basic validations ----
      if (!appOrder?.id) {
        toast.error("Missing order details. Please try placing the order again.");
        return;
      }
      const total = Number(appOrder.totalAmount || 0);
      if (!Number.isFinite(total) || total <= 0) {
        toast.error("Invalid amount for payment.");
        return;
      }

      const key = process.env.REACT_APP_RZP_KEY_ID;
      if (!key) {
        toast.error("Missing Razorpay Key ID. Set REACT_APP_RZP_KEY_ID in your frontend .env");
        return;
      }

      setLoading(true);
      await loadRazorpay();

      // ---- 1) Create Razorpay order on backend ----
      const amountInPaise = Math.round(total * 100);
      const { data } = await api.post("/payments/create", {
        orderId: appOrder.id,
        amountInPaise,
      });

      // Support either { rzpOrder } or { order } response shapes
      const rzpOrder = data?.rzpOrder || data?.order || data;
      if (!rzpOrder?.id) {
        throw new Error("Failed to create Razorpay order");
      }
      const { id: rzpOrderId, amount, currency } = rzpOrder;

      // ---- 2) Open Razorpay Checkout ----
      const rzp = new window.Razorpay({
        key,
        name: "Servezy",
        description: `Payment for Order #${appOrder.id}`,
        order_id: rzpOrderId,
        amount,
        currency: currency || "INR",
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        modal: { ondismiss: () => toast.info("Payment cancelled") },
        handler: async (resp) => {
          try {
            // ---- 3) Verify signature on backend ----
            await api.post("/payments/verify", {
              ...resp,
              appOrderId: appOrder.id,
            });
            toast.success("Payment successful");
            onSuccess?.(resp);
          } catch (e) {
            console.error(e);
            toast.error(
              e?.response?.data?.message || "Payment verification failed. Please contact support."
            );
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        console.error(resp?.error);
        toast.error(resp?.error?.description || "Payment failed");
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Unable to start payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      fullWidth
      size="large"
      variant="contained"
      onClick={handlePay}
      disabled={loading}
    >
      {loading ? "Processing..." : `Pay ₹${Number(appOrder?.totalAmount || 0).toFixed(2)}`}
    </Button>
  );
}