
// src/components/PrivateRoute.js
import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";

/** Safe base64url → JSON decoder for JWT payloads (no signature check). */
const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
};

const getToken = () => {
  try { return localStorage.getItem("token") || null; } catch { return null; }
};
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
};
const setStoredUser = (u) => {
  try { localStorage.setItem("user", JSON.stringify(u || {})); } catch {}
};

/** Normalize any role-ish field to lowercase. */
const normRole = (u = {}) => {
  const r =
    u.role ??
    u.Role ??
    u.userRole ??
    u.user_type ??
    u.userType ??
    u.type ??
    "";
  return String(r || "").trim().toLowerCase();
};

/** Normalize any id-ish field to a stable `id`. */
const normId = (u = {}) => {
  return (
    u.id ??
    u.userId ??
    u._id ??
    u.sub ??
    null
  );
};

export default function PrivateRoute({ children, role }) {
  const location = useLocation();
  const token = getToken();
  let user = getStoredUser();

  // Hydrate from JWT payload if local user is missing id/role
  user = useMemo(() => {
    const hasId = Boolean(normId(user));
    const hasRole = Boolean(normRole(user));
    if (hasId && hasRole) return user;

    if (!token) return user;

    const p = decodeJwtPayload(token) || {};
    const merged = {
      ...user,
      id: normId(user) ?? normId(p),
      role: normRole(user) || normRole(p) || "",
      // copy common profile fields if you want them available
      email: user.email ?? p.email,
      name: user.name ?? p.name,
    };

    // Persist normalized user so future navigations don't bounce
    if (merged.id && merged.role) setStoredUser(merged);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const userId = normId(user);
  const userRole = normRole(user);

  // Not logged in → send to login (preserve where we were going)
  if (!token || !userId) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Optional: block archived/disabled users if present
  if (user?.isDeleted === true || user?.disabled === true) {
    return <Navigate to="/not-authorized" replace />;
  }

  // Role check: role can be a string or an array (e.g., ["vendor","admin"])
  if (role) {
    const required = (Array.isArray(role) ? role : [role]).map((r) => String(r).toLowerCase());
    if (!required.includes(userRole)) {
      const fallback =
        userRole === "vendor" ? "/vendor/dashboard" :
        userRole === "admin"  ? "/admin/dashboard"  :
        "/dashboard";
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
}