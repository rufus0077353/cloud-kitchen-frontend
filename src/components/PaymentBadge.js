
import React from "react";

export default function PaymentBadge({ status }) {
  const raw = (status || "unpaid").toString().toLowerCase();
  const s = ["paid","unpaid","processing","failed","refunded"].includes(raw) ? raw : "unpaid";

  const theme = {
    paid:       { bg: "#ecfdf5", border: "#a7f3d0", color: "#065f46" },
    processing: { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
    failed:     { bg: "#fef2f2", border: "#fecaca", color: "#7f1d1d" },
    refunded:   { bg: "#eff6ff", border: "#bfdbfe", color: "#1e3a8a" },
    unpaid:     { bg: "#f9fafb", border: "#e5e7eb", color: "#374151" },
  }[s];

  const label = s[0].toUpperCase() + s.slice(1);

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        background: theme.bg,
        color: theme.color,
        fontSize: 12,
        lineHeight: "16px",
      }}
      aria-label={`Payment ${label}`}
      title={`Payment ${label}`}
    >
      {label}
    </span>
  );
}