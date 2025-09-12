import { useState } from "react";
import { Button } from "@mui/material";
import { toast } from "react-toastify";
import loadRazorpay from "../utils/loadRazorpay";
import api from "../utils/api";

export default function PayNowButton({ appOrder, user, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);
      await loadRazorpay();

      // 1) Create RZP order on backend
      const amountInPaise = Math.round(appOrder.totalAmount * 100);
      const { data } = await api.post("/payments/create", {
        orderId: appOrder.id,
        amountInPaise
      });
      const { id: rzpOrderId, amount, currency } = data.rzpOrder;

      // 2) Open checkout
      const rzp = new window.Razorpay({
        key: process.env.REACT_APP_RZP_KEY_ID,
        name: "Servezy",
        description: `Payment for Order #${appOrder.id}`,
        order_id: rzpOrderId,
        amount,
        currency: currency || "INR",
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || ""
        },
        handler: async (resp) => {
          try {
            // 3) Verify signature on backend
            await api.post("/payments/verify", { ...resp, appOrderId: appOrder.id });
            toast.success("Payment successful");
            onSuccess?.(resp); // parent can navigate/refresh
          } catch (e) {
            console.error(e);
            toast.error("Payment verification failed");
          }
        },
        modal: { ondismiss: () => toast.info("Payment cancelled") }
      });

      rzp.on("payment.failed", (resp) => {
        console.error(resp?.error);
        toast.error(resp?.error?.description || "Payment failed");
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Unable to start payment");
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
      {loading ? "Processing..." : `Pay ₹${Number(appOrder.totalAmount).toFixed(2)}`}
    </Button>
  );
}