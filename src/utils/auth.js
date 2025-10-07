// src/utils/auth.js

/** Safe JSON parse */
function safeParse(json, fallback = {}) {
  try {
    return JSON.parse(json ?? "");
  } catch {
    return fallback;
  }
}

/** Normalize any role-ish value to a lowercase string */
export function getRole(rawUser) {
  const u = rawUser ?? getUser();
  const r =
    u?.role ??
    u?.Role ??
    u?.userRole ??
    u?.user_type ??
    u?.userType ??
    "";
  return (typeof r === "string" ? r : String(r || "")).toLowerCase();
}

export function getToken() {
  try {
    return localStorage.getItem("token") || null;
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    return safeParse(localStorage.getItem("user"), {});
  } catch {
    return {};
  }
}

/**
 * Persist auth after login.
 * Call this once, right after a successful login.
 * Example: setAuth({ token: data.token, user: data.user })
 */
export function setAuth({ token, user }) {
  if (token) localStorage.setItem("token", token);
  // normalize role casing up-front so every consumer reads the same value
  if (user && typeof user === "object") {
    const normalized = { ...user, role: getRole(user) };
    localStorage.setItem("user", JSON.stringify(normalized));
  }
}

/** Quick check */
export function isLoggedIn() {
  const token = getToken();
  const u = getUser();
  return Boolean(token && u?.id);
}

/**
 * hasRole("admin") or hasRole(["user","admin"])
 * Blocks archived users too (isDeleted).
 */
export function hasRole(required) {
  const token = getToken();
  if (!token) return false;

  const user = getUser();
  if (!user || user?.isDeleted) return false;

  const role = getRole(user);
  if (!required) return true; // any logged-in user

  const needed = Array.isArray(required) ? required : [required];
  return needed.map((r) => String(r).toLowerCase()).includes(role);
}

export function logoutClient() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
  } catch (_) {}
  // Hard replace avoids back button issues
  window.location.replace("/login");
}