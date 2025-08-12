
// src/components/Navbar.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const goHome = () => {
    if (!user?.role) return navigate("/");
    if (user.role === "admin") return navigate("/admin/dashboard");
    if (user.role === "vendor") return navigate("/vendor/dashboard");
    return navigate("/dashboard");
  };

  const isMobile = window.innerWidth <= 768;

  return (
    <nav style={styles.nav}>
      {/* Clickable logo (routes by role) */}
      <button type="button" onClick={goHome} style={styles.logoBtn}>
        <span style={styles.logoText}>Servezy</span>
      </button>

      {/* Desktop Links */}
      {!isMobile && (
        <div style={styles.links}>
          {token && user && (
            <>
              <span style={styles.welcome}>Welcome, {user.name || user.email}</span>

              {user.role === "admin" && (
                <>
                  <Link to="/admin/dashboard" style={styles.link}>Dashboard</Link>
                  <Link to="/admin/users" style={styles.link}>Users</Link>
                </>
              )}
              {user.role === "vendor" && (
                <>
                  <Link to="/vendor/dashboard" style={styles.link}>Vendor Panel</Link>
                  <Link to="/vendor/orders" style={styles.link}>Orders</Link>
                </>
              )}
              {user.role === "user" && (
                <>
                  <Link to="/dashboard" style={styles.link}>Home</Link>
                  <Link to="/orders" style={styles.link}>My Orders</Link>
                </>
              )}
              <button onClick={handleLogout} style={styles.button}>Logout</button>
            </>
          )}
        </div>
      )}

      {/* Mobile Menu Button */}
      {isMobile && token && (
        <button style={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
      )}

      {/* Mobile Drawer */}
      {isMobile && menuOpen && (
        <div style={styles.drawer}>
          {token && user && (
            <>
              <div style={styles.drawerHeader}>
                Welcome, {user.name || user.email}
              </div>
              {user.role === "admin" && (
                <>
                  <Link to="/admin/dashboard" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                  <Link to="/admin/users" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Users</Link>
                </>
              )}
              {user.role === "vendor" && (
                <>
                  <Link to="/vendor/dashboard" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Vendor Panel</Link>
                  <Link to="/vendor/orders" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Orders</Link>
                </>
              )}
              {user.role === "user" && (
                <>
                  <Link to="/dashboard" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>Home</Link>
                  <Link to="/orders" style={styles.drawerLink} onClick={() => setMenuOpen(false)}>My Orders</Link>
                </>
              )}
              <button onClick={handleLogout} style={{ ...styles.button, margin: "10px" }}>
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 2rem",
    background: "#333",
    color: "white",
    position: "relative"
  },
  logoBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
  },
  logoText: {
    fontWeight: "bold",
    fontSize: "20px",
    color: "white",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  welcome: {
    marginRight: "1rem",
    fontStyle: "italic",
    color: "#ccc"
  },
  link: {
    color: "white",
    textDecoration: "none",
  },
  button: {
    background: "#e74c3c",
    color: "white",
    border: "none",
    padding: "8px 12px",
    cursor: "pointer",
  },
  menuButton: {
    background: "transparent",
    color: "white",
    fontSize: "20px",
    border: "none",
    cursor: "pointer",
  },
  drawer: {
    position: "absolute",
    top: "60px",
    right: 0,
    background: "#444",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    width: "200px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    zIndex: 10
  },
  drawerHeader: {
    padding: "0.5rem 0",
    borderBottom: "1px solid #666",
    marginBottom: "0.5rem",
    color: "#fff",
    fontWeight: "bold"
  },
  drawerLink: {
    color: "white",
    textDecoration: "none",
    padding: "0.5rem 0",
  }
};

export default Navbar;