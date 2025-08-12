
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

  const [vendorId, setVendorId] = useState(localStorage.getItem("vendorId") || null);
  const [vendorPendingCount, setVendorPendingCount] = useState(0);
  const [userActiveCount, setUserActiveCount] = useState(0);

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const isVendor = token && user?.role === "vendor";
  const isUser = token && user?.role === "user";

  // ---------- helpers ----------
  const isActive = (path) => location.pathname.startsWith(path);

  const fetchVendorPending = async () => {
    if (!isVendor) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (!res.ok) return setVendorPendingCount(0);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setVendorPendingCount(arr.filter((o) => o.status === "pending").length);
    } catch {
      setVendorPendingCount(0);
    }
  };

  const fetchUserActive = async () => {
    if (!isUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/my`, { headers });
      if (!res.ok) return setUserActiveCount(0);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const active = arr.filter((o) =>
        ["pending", "accepted", "ready"].includes(o.status)
      ).length;
      setUserActiveCount(active);
    } catch {
      setUserActiveCount(0);
    }
  };

  // ---------- room joins ----------
  useEffect(() => {
    if (!token) return;

    // User room join
    if (user?.id) {
      socket.emit("user:join", user.id);
    }

    // Vendor room join (discover vendorId if needed)
    const joinVendor = async () => {
      if (!isVendor) return;
      if (vendorId) {
        socket.emit("vendor:join", vendorId);
        return;
      }
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

    joinVendor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, isVendor]);

  // ---------- initial counts ----------
  useEffect(() => {
    fetchVendorPending();
    fetchUserActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, isUser]);

  // ---------- live updates via sockets ----------
  useEffect(() => {
    const onNew = (fullOrder) => {
      // If vendor: any new order for them could be pending
      if (isVendor && Number(fullOrder?.VendorId) === Number(vendorId)) {
        fetchVendorPending();
      }
      // If user: only update if it belongs to them
      if (isUser && Number(fullOrder?.UserId) === Number(user?.id)) {
        fetchUserActive();
      }
    };

    const onStatus = (payload) => {
      // vendor side (their orders changed)
      if (isVendor) fetchVendorPending();
      // user side (their orders changed)
      if (isUser && Number(payload?.UserId) === Number(user?.id)) {
        fetchUserActive();
      }
    };

    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, isUser, vendorId, user?.id]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("vendorId");
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.leftSide}>
        <Link
          to={
            token
              ? user?.role === "vendor"
                ? "/vendor/dashboard"
                : user?.role === "admin"
                ? "/admin/dashboard"
                : "/dashboard"
              : "/login"
          }
          style={styles.logoLink}
        >
          <div style={styles.logo}>Servezy</div>
        </Link>
      </div>

      <div style={styles.links}>
        {token && user && (
          <>
            {user.role === "admin" && (
              <>
                <Link
                  to="/admin/dashboard"
                  style={{ ...styles.link, ...(isActive("/admin/dashboard") ? styles.active : {}) }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/users"
                  style={{ ...styles.link, ...(isActive("/admin/users") ? styles.active : {}) }}
                >
                  Users
                </Link>
              </>
            )}

            {user.role === "vendor" && (
              <>
                <Link
                  to="/vendor/dashboard"
                  style={{ ...styles.link, ...(isActive("/vendor/dashboard") ? styles.active : {}) }}
                >
                  Vendor Panel
                </Link>

                <div style={{ position: "relative" }}>
                  <Link
                    to="/vendor/orders"
                    style={{ ...styles.link, ...(isActive("/vendor/orders") ? styles.active : {}) }}
                  >
                    Orders
                  </Link>
                  {vendorPendingCount > 0 && (
                    <span style={styles.badge}>
                      {vendorPendingCount > 99 ? "99+" : vendorPendingCount}
                    </span>
                  )}
                </div>
              </>
            )}

            {user.role === "user" && (
              <>
                <Link
                  to="/dashboard"
                  style={{ ...styles.link, ...(isActive("/dashboard") ? styles.active : {}) }}
                >
                  Home
                </Link>

                <div style={{ position: "relative" }}>
                  <Link
                    to="/orders"
                    style={{ ...styles.link, ...(isActive("/orders") ? styles.active : {}) }}
                  >
                    My Orders
                  </Link>
                  {userActiveCount > 0 && (
                    <span style={styles.badge}>
                      {userActiveCount > 99 ? "99+" : userActiveCount}
                    </span>
                  )}
                </div>
              </>
            )}

            <button onClick={handleLogout} style={styles.button}>
              Logout
            </button>
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
  logoLink: { textDecoration: "none" },
  logo: { fontWeight: 800, fontSize: 22, letterSpacing: 0.5, color: "#fff" },
  links: { display: "flex", alignItems: "center", gap: "1rem" },
  link: {
    color: "white",
    textDecoration: "none",
    padding: "6px 8px",
    borderRadius: 6,
    transition: "background 0.2s ease",
  },
  active: { background: "rgba(255,255,255,0.12)" },
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