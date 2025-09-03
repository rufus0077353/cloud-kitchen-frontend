// src/utils/auth.js
export function getToken() {
  return localStorage.getItem("token") || null;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

/**
 * hasRole("admin") or hasRole(["user","admin"])
 * Blocks archived users too (isDeleted).
 */
export function hasRole(required) {
  const token = getToken();
  if (!token) return false;

  const user = getUser();
  if (user?.isDeleted) return false;

  const role = String(user?.role || "").toLowerCase();
  if (!required) return true;

  const needed = Array.isArray(required) ? required : [required];
  return needed.map((r) => String(r).toLowerCase()).includes(role);
}
