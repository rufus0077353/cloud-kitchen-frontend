// src/components/PrivateRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/** ✅ Normalize role to lowercase safely from any field */
const getRole = (user = {}) => {
  const r =
    user.role ||
    user.Role ||
    user.userRole ||
    user.user_type ||
    user.userType ||
    "";
  return String(r || "").trim().toLowerCase();
};

/**
 * Usage:
 * <PrivateRoute><UserDashboard/></PrivateRoute>
 * <PrivateRoute role="vendor"><VendorDashboard/></PrivateRoute>
 * <PrivateRoute role="admin"><AdminDashboard/></PrivateRoute>
 */
export default function PrivateRoute({ children, role }) {
  const location = useLocation();

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const rawUser =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "{}")
      : {};

  const userRole = getRole(rawUser);

  // 🚫 Not logged in -> redirect to login
  if (!token || !rawUser?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // ✅ Allow role to be string or array
  if (role) {
    const requiredRoles = Array.isArray(role)
      ? role.map((r) => String(r).toLowerCase())
      : [String(role).toLowerCase()];

    // ❌ If user's role doesn’t match required role(s)
    if (!requiredRoles.includes(userRole)) {
      const fallback =
        userRole === "vendor"
          ? "/vendor/dashboard"
          : userRole === "admin"
          ? "/admin/dashboard"
          : "/dashboard";
      return <Navigate to={fallback} replace />;
    }
  }

  // ✅ Authorized — show component
  return children;
}