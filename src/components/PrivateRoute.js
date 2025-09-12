import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Usage:
 * <PrivateRoute><UserDashboard/></PrivateRoute>
 * <PrivateRoute role="vendor"><VendorDashboard/></PrivateRoute>
 * <PrivateRoute role="admin"><AdminDashboard/></PrivateRoute>
 */
export default function PrivateRoute({ children, role }) {
  const location = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const user = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") || "{}")
    : {};

  // Not logged in -> send to login and remember where we were going
  if (!token || !user?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If this route requires a role, verify it
  if (role && user?.role !== role) {
    // redirect to a sensible dashboard based on their role
    const fallback =
      user.role === "vendor" ? "/vendor/dashboard" :
      user.role === "admin"  ? "/admin/dashboard"  :
      "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
