import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={{ padding: "1rem", textAlign: "center", opacity: 0.8 }}>
      © {new Date().getFullYear()} Servezy ·{" "}
      <Link to="/terms">Terms</Link> ·{" "}
      <Link to="/privacy">Privacy</Link> ·{" "}
      <Link to="/refund">Refunds</Link> ·{" "}
      <Link to="/contact">Contact</Link>
    </footer>
  );
}