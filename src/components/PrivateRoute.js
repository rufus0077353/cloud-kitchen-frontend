import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/** Normalize any role-ish value to a lowercase string */
const normRole = (u) => {
  const r =
    u?.role ??
    u?.Role ??
    u?.userRole ??
    u?.user_type ??
    u?.userType ??
    "";
  return (typeof r === "string" ? r : String(r || "")).toLowerCase();
};

/**
 * Usage:
 * <PrivateRoute><UserDashboard/></PrivateRoute>
 * <PrivateRoute role="vendor"><VendorDashboard/></PrivateRoute>
 * <PrivateRoute role="admin"><AdminDashboard/></PrivateRoute>
 */
export default function PrivateRoute({ children, role }) {
  const location = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const rawUser = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") || "{}")
    : {};
  const userRole = normRole(rawUser);

  // Not logged in -> send to login and remember where we were going
  if (!token || !rawUser?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If a role is required, support string or array (e.g., ["vendor","admin"])
  if (role) {
    const needs = Array.isArray(role) ? role.map(String) : [String(role)];
    const allowed = needs.map((r) => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      const fallback =
        userRole === "vendor" ? "/vendor/dashboard" :
        userRole === "admin"  ? "/admin/dashboard"  :
        "/dashboard";
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
}