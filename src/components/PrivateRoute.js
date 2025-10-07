
// src/components/PrivateRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/** Normalize role to lowercase safely from any field */
const getRole = (user = {}) => {
  const r =
    user.role ??
    user.Role ??
    user.userRole ??
    user.user_type ??
    user.userType ??
    user.roleName ??
    "";
  return String(r || "").trim().toLowerCase();
};

/** Find a user id across common shapes */
const getUserId = (user = {}) =>
  user.id ?? user.Id ?? user.userId ?? user._id ?? null;

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

  let rawUser = {};
  try {
    rawUser =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "{}")
        : {};
  } catch {
    rawUser = {};
  }

  const userId = getUserId(rawUser);
  const userRole = getRole(rawUser);

  // 🚫 Not logged in -> redirect to login (remember target)
  // Rely on token OR a recognizable user id (some backends store minimal user without id)
  if (!token || !userId) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // ✅ Allow role to be string or array
  if (role) {
    const requiredRoles = (Array.isArray(role) ? role : [role])
      .map((r) => String(r).toLowerCase());

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