
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function RequireVerified({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setState({ loading: false, ok: false }); return; }

    fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(me => setState({ loading: false, ok: !!me?.emailVerified }))
      .catch(() => setState({ loading: false, ok: false }));
  }, []);

  if (state.loading) return null;  // You can replace with spinner
  if (!state.ok) return <Navigate to="/verify-email" replace />;
  return children;
}