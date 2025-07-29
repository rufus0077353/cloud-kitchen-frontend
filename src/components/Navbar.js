// src/components/Navbar.js
import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>Cloud Kitchen</div>
      <div style={styles.links}>
        {token && user && (
          <>
            {user.role === "admin" && (
              <>
                <Link to="/admin/dashboard" style={styles.link}>Dashboard</Link>
                <Link to="/admin/users" style={styles.link}>Users</Link>
              </>
            )}
            {user.role === "vendor" && (
              <Link to="/vendor/dashboard" style={styles.link}>Vendor Panel</Link>
            )}
            {user.role === "user" && (
              <Link to="/dashboard" style={styles.link}>Home</Link>
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
    display: "flex",
    justifyContent: "space-between",
    padding: "1rem 2rem",
    background: "#333",
    color: "white",
  },
  logo: {
    fontWeight: "bold",
    fontSize: "20px",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
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
};

export default Navbar;