// src/components/PaymentBadge.jsx
import React from "react";

export default function PaymentBadge({ status }) {
  const s = (status || "unpaid").toLowerCase();
  const bg =
    s === "paid" ? "#ecfdf5" : s === "failed" ? "#fef2f2" : "#f9fafb";
  const border =
    s === "paid" ? "#a7f3d0" : s === "failed" ? "#fecaca" : "#e5e7eb";
  const color =
    s === "paid" ? "#065f46" : s === "failed" ? "#7f1d1d" : "#374151";

  return (
    <span style={{
      display: "inline-block", padding: "3px 8px", borderRadius: 999,
      border: `1px solid ${border}`, background: bg, color, fontSize: 12
    }}>
      {s}
    </span>
  );
}