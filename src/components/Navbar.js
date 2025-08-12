
// src/components/Navbar.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { socket } from "../utils/socket";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");
  const [pendingCount, setPendingCount] = useState(0);
  const [vendorId, setVendorId] = useState(
    localStorage.getItem("vendorId") || null
  );

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  // ---- load pending count for vendors ----
  const fetchPending = async () => {
    if (!token || user?.role !== "vendor") return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (!res.ok) {
        setPendingCount(0);
        return;
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const count = arr.filter((o) => o.status === "pending").length;
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  };

  // ---- join vendor room once we know vendorId ----
  useEffect(() => {
    if (user?.role !== "vendor" || !token) return;

    const ensureVendorId = async () => {
      // if vendorId already stored from login, use it
      if (vendorId) {
        socket.emit("vendor:join", vendorId);
        return;
      }
      // fallback: fetch /api/vendors/me to discover id
      try {
        const r = await fetch(`${API_BASE}/api/vendors/me`, { headers });
        if (r.ok) {
          const me = await r.json();
          if (me?.vendorId) {
            localStorage.setItem("vendorId", me.vendorId);
            setVendorId(me.vendorId);
            socket.emit("vendor:join", me.vendorId);
          }
        }
      } catch {}
    };

    ensureVendorId();
    fetchPending();
    // also refresh when route changes back to vendor pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, token]);

  // ---- live updates: on new or status change, refresh count ----
  useEffect(() => {
    if (user?.role !== "vendor") return;

    const onNew = () => fetchPending();
    const onStatus = () => fetchPending();

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("vendorId");
    navigate("/login");
  };

  // highlight active link (subtle)
  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav style={styles.nav}>
      <div style={styles.leftSide}>
        <Link to={token ? (user?.role === "vendor" ? "/vendor/dashboard" :
                            user?.role === "admin" ? "/admin/dashboard" : "/dashboard") : "/login"}
              style={{ ...styles.logoLink }}>
          <div style={styles.logo}>Servezy</div>
        </Link>
      </div>

      <div style={styles.links}>
        {token && user && (
          <>
            {user.role === "admin" && (
              <>
                <Link to="/admin/dashboard" style={{ ...styles.link, ...(isActive("/admin/dashboard") ? styles.active : {}) }}>Dashboard</Link>
                <Link to="/admin/users" style={{ ...styles.link, ...(isActive("/admin/users") ? styles.active : {}) }}>Users</Link>
              </>
            )}

            {user.role === "vendor" && (
              <>
                <Link to="/vendor/dashboard" style={{ ...styles.link, ...(isActive("/vendor/dashboard") ? styles.active : {}) }}>
                  Vendor Panel
                </Link>

                <div style={{ position: "relative" }}>
                  <Link to="/vendor/orders" style={{ ...styles.link, ...(isActive("/vendor/orders") ? styles.active : {}) }}>
                    Orders
                  </Link>
                  {pendingCount > 0 && (
                    <span style={styles.badge} aria-label={`${pendingCount} pending orders`}>
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </div>
              </>
            )}

            {user.role === "user" && (
              <>
                <Link to="/dashboard" style={{ ...styles.link, ...(isActive("/dashboard") ? styles.active : {}) }}>
                  Home
                </Link>
                <Link to="/orders" style={{ ...styles.link, ...(isActive("/orders") ? styles.active : {}) }}>
                  My Orders
                </Link>
              </>
            )}

            <button onClick={handleLogout} style={styles.button}>Logout</button>
          </>
        )}
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1.25rem",
    background: "#333",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  leftSide: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logoLink: {
    textDecoration: "none",
  },
  logo: {
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: 0.5,
    color: "#fff",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  link: {
    color: "white",
    textDecoration: "none",
    padding: "6px 8px",
    borderRadius: 6,
    transition: "background 0.2s ease",
  },
  active: {
    background: "rgba(255,255,255,0.12)",
  },
  button: {
    background: "#e74c3c",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    background: "#ff5252",
    color: "#fff",
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    borderRadius: 10,
    fontSize: 11,
    lineHeight: "18px",
    textAlign: "center",
    fontWeight: 700,
    boxShadow: "0 0 0 2px #333",
  },
};

export default Navbar;