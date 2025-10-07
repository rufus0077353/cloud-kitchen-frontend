
// src/components/AdminRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/** Normalize role (handles role/Role/userRole/user_type/userType, case-insensitive) */
const getRole = (user = {}) => {
  const r =
    user.role ??
    user.Role ??
    user.userRole ??
    user.user_type ??
    user.userType ??
    "";
  return String(r || "").trim().toLowerCase();
};

export default function AdminRoute({ children }) {
  const location = useLocation();

  // Pull auth from storage (safe parse)
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  let rawUser = {};
  try {
    rawUser =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "{}")
        : {};
  } catch {}

  const role = getRole(rawUser);

  // Not logged in → go to login (and remember where we were going)
  if (!token || !rawUser?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Logged in but not admin → send to the correct dashboard for their role
  if (role !== "admin") {
    const fallback =
      role === "vendor" ? "/vendor/dashboard" :
      "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  // Admin OK
  return children;
}