// src/components/PayNowButton.jsx
import { useState } from "react";
import { Button } from "@mui/material";
import { toast } from "react-toastify";
import loadRazorpay from "../utils/loadRazorpay";
import api from "../utils/api";

export default function PayNowButton({ appOrder, user, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    // --- quick guards ---
    if (!appOrder?.id) {
      toast.error("Missing order details. Please place the order again.");
      return;
    }
    const total = Number(appOrder.totalAmount || 0);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Invalid amount for payment.");
      return;
    }
    const key = process.env.REACT_APP_RZP_KEY_ID;
    if (!key) {
      toast.error("Missing Razorpay Key ID (REACT_APP_RZP_KEY_ID).");
      return;
    }

    try {
      setLoading(true);

      // 0) Load SDK
      await loadRazorpay();
      if (!window.Razorpay) {
        toast.error("Razorpay SDK not available.");
        return;
      }

      // 1) Create Razorpay order on backend (api.js already prefixes /api)
      const amountInPaise = Math.round(total * 100);
      const { data, status } = await api.post("/payments/create", {
        orderId: appOrder.id,
        amountInPaise,
      });

      // Helpful messages if payments are not enabled server-side
      if (status === 404 || status === 501) {
        toast.error("Online payments are not enabled on the server.");
        return;
      }

      // Support either { rzpOrder } or { order } or raw object
      const rzpOrder = data?.rzpOrder || data?.order || data;
      if (!rzpOrder?.id) {
        toast.error("Failed to create payment order on server.");
        return;
      }

      // 2) Open Razorpay Checkout
      const rzp = new window.Razorpay({
        key,
        name: "Servezy",
        description: `Payment for Order #${appOrder.id}`,
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        modal: { ondismiss: () => toast.info("Payment cancelled") },
        handler: async (resp) => {
          try {
            // 3) Verify signature on backend
            await api.post("/payments/verify", {
              ...resp,
              appOrderId: appOrder.id,
            });
            toast.success("Payment successful");
            onSuccess?.(resp);
          } catch (e) {
            console.error(e);
            toast.error(
              e?.response?.data?.message ||
                "Payment verification failed. Please contact support."
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
      const s = err?.response?.status;
      toast.error(
        s === 404 || s === 501
          ? "Online payments are not enabled on the server."
          : err?.message || "Unable to start payment"
      );
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