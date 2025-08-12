
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
  const [menuOpen, setMenuOpen] = useState(false);

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const isVendor = token && user?.role === "vendor";
  const isUser = token && user?.role === "user";
  const isAdmin = token && user?.role === "admin";

  const isActive = (path) => location.pathname.startsWith(path);

  // ---- counts for badges ----
  const fetchVendorPending = async () => {
    if (!isVendor) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (!res.ok) return setVendorPendingCount(0);
      const data = await res.json();
      setVendorPendingCount((Array.isArray(data) ? data : []).filter(o => o.status === "pending").length);
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
      const active = (Array.isArray(data) ? data : []).filter(o =>
        ["pending", "accepted", "ready"].includes(o.status)
      ).length;
      setUserActiveCount(active);
    } catch {
      setUserActiveCount(0);
    }
  };

  // ---- join rooms ----
  useEffect(() => {
    if (!token) return;
    if (user?.id) socket.emit("user:join", user.id);

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
  }, [token, user?.id, isVendor, vendorId]);

  // initial badge load
  useEffect(() => {
    fetchVendorPending();
    fetchUserActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, isUser]);

  // live updates → refresh counts
  useEffect(() => {
    const onNew = (order) => {
      if (isVendor && Number(order?.VendorId) === Number(vendorId)) fetchVendorPending();
      if (isUser && Number(order?.UserId) === Number(user?.id)) fetchUserActive();
    };
    const onStatus = (payload) => {
      if (isVendor) fetchVendorPending();
      if (isUser && Number(payload?.UserId) === Number(user?.id)) fetchUserActive();
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

  // close mobile menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const homeLink = token
    ? isVendor
      ? "/vendor/dashboard"
      : isAdmin
      ? "/admin/dashboard"
      : "/dashboard"
    : "/login";

  return (
    <>
      {/* tiny CSS to make it responsive */}
      <style>{`
        .nvbar {
          position: sticky;
          top: 0;
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #333;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .nv-left {
          display: flex;
          align-items: center;
          gap: .5rem;
          min-width: 0;
        }
        .nv-logo-link {
          display: flex;
          align-items: center;
          gap: .4rem;
          text-decoration: none;
          color: #fff;
        }
        .nv-logo-img { width: 32px; height: 32px; border-radius: 4px; }
        .nv-logo-text { font-weight: 800; font-size: 20px; color: #fff; }

        .nv-links {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .nv-link {
          color: #fff;
          text-decoration: none;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background .2s ease;
          position: relative;
        }
        .nv-link.active { background: rgba(255,255,255,0.12); }
        .nv-btn {
          background: #e74c3c;
          color: #fff;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .nv-badge-wrap { position: relative; display: inline-block; }
        .nv-badge {
          position: absolute;
          top: -6px;
          right: -10px;
          background: #ff5252;
          color: #fff;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 10px;
          font-size: 11px;
          line-height: 18px;
          text-align: center;
          font-weight: 700;
          box-shadow: 0 0 0 2px #333;
        }

        /* Hamburger only on small screens */
        .nv-ham {
          display: none;
          background: transparent;
          border: none;
          width: 36px;
          height: 36px;
          margin-left: .5rem;
          cursor: pointer;
        }
        .nv-ham-bar, .nv-ham-bar::before, .nv-ham-bar::after {
          content: "";
          display: block;
          width: 24px;
          height: 2px;
          background: #fff;
          position: relative;
          transition: transform .25s ease, opacity .25s ease;
        }
        .nv-ham-bar::before {
          position: absolute; top: -7px; left: 0;
        }
        .nv-ham-bar::after {
          position: absolute; top: 7px; left: 0;
        }
        .nv-ham.open .nv-ham-bar {
          transform: rotate(45deg);
        }
        .nv-ham.open .nv-ham-bar::before {
          transform: rotate(90deg);
          top: 0;
        }
        .nv-ham.open .nv-ham-bar::after {
          opacity: 0;
        }

        /* Mobile panel */
        .nv-panel {
          display: none;
        }

        @media (max-width: 768px) {
          .nv-links { display: none; }
          .nv-ham { display: inline-flex; align-items: center; justify-content: center; }
          .nv-panel {
            display: ${menuOpen ? "block" : "none"};
            background: #222;
            color: #fff;
            padding: .5rem 1rem 1rem;
            border-top: 1px solid rgba(255,255,255,.12);
          }
          .nv-panel a, .nv-panel button {
            display: block;
            width: 100%;
            text-align: left;
            margin: .4rem 0;
          }
          .nv-badge { box-shadow: 0 0 0 2px #222; }
        }
      `}</style>

      <nav className="nvbar">
        <div className="nv-left">
          <Link to={homeLink} className="nv-logo-link">
            {/* Replace with your real logo if different. File should be in /public */}
            <img src="/logo192.png" alt="Servezy Logo" className="nv-logo-img" />
            <span className="nv-logo-text">Servezy</span>
          </Link>

          {/* Hamburger on mobile */}
          {token && (
            <button
              className={`nv-ham ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen((s) => !s)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span className="nv-ham-bar" />
            </button>
          )}
        </div>

        {/* Desktop links */}
        <div className="nv-links">
          {token && user && (
            <>
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard" className={`nv-link ${isActive("/admin/dashboard") ? "active" : ""}`}>Dashboard</Link>
                  <Link to="/admin/users" className={`nv-link ${isActive("/admin/users") ? "active" : ""}`}>Users</Link>
                </>
              )}

              {isVendor && (
                <>
                  <Link to="/vendor/dashboard" className={`nv-link ${isActive("/vendor/dashboard") ? "active" : ""}`}>Vendor Panel</Link>
                  <span className="nv-badge-wrap">
                    <Link to="/vendor/orders" className={`nv-link ${isActive("/vendor/orders") ? "active" : ""}`}>Orders</Link>
                    {vendorPendingCount > 0 && (
                      <span className="nv-badge">{vendorPendingCount > 99 ? "99+" : vendorPendingCount}</span>
                    )}
                  </span>
                </>
              )}

              {isUser && (
                <>
                  <Link to="/dashboard" className={`nv-link ${isActive("/dashboard") ? "active" : ""}`}>Home</Link>
                  <span className="nv-badge-wrap">
                    <Link to="/orders" className={`nv-link ${isActive("/orders") ? "active" : ""}`}>My Orders</Link>
                    {userActiveCount > 0 && (
                      <span className="nv-badge">{userActiveCount > 99 ? "99+" : userActiveCount}</span>
                    )}
                  </span>
                </>
              )}

              <button onClick={handleLogout} className="nv-btn">Logout</button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile dropdown panel */}
      {token && (
        <div className="nv-panel">
          {isAdmin && (
            <>
              <Link to="/admin/dashboard" className={`nv-link ${isActive("/admin/dashboard") ? "active" : ""}`}>Dashboard</Link>
              <Link to="/admin/users" className={`nv-link ${isActive("/admin/users") ? "active" : ""}`}>Users</Link>
            </>
          )}

          {isVendor && (
            <>
              <Link to="/vendor/dashboard" className={`nv-link ${isActive("/vendor/dashboard") ? "active" : ""}`}>Vendor Panel</Link>
              <span className="nv-badge-wrap" style={{ display: "inline-block" }}>
                <Link to="/vendor/orders" className={`nv-link ${isActive("/vendor/orders") ? "active" : ""}`}>Orders</Link>
                {vendorPendingCount > 0 && (
                  <span className="nv-badge">{vendorPendingCount > 99 ? "99+" : vendorPendingCount}</span>
                )}
              </span>
            </>
          )}

          {isUser && (
            <>
              <Link to="/dashboard" className={`nv-link ${isActive("/dashboard") ? "active" : ""}`}>Home</Link>
              <span className="nv-badge-wrap" style={{ display: "inline-block" }}>
                <Link to="/orders" className={`nv-link ${isActive("/orders") ? "active" : ""}`}>My Orders</Link>
                {userActiveCount > 0 && (
                  <span className="nv-badge">{userActiveCount > 99 ? "99+" : userActiveCount}</span>
                )}
              </span>
            </>
          )}

          <button onClick={handleLogout} className="nv-btn" style={{ marginTop: ".5rem" }}>Logout</button>
        </div>
      )}
    </>
  );
};

export default Navbar;