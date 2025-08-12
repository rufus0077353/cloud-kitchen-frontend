// src/components/Navbar.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

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
    <AppBar position="static" sx={{ background: "#333" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        {/* Logo */}
        <Box
          component={Link}
          to="/"
          sx={{ display: "flex", alignItems: "center", textDecoration: "none" }}
        >
          <Box
            component="img"
            src="/icon-192.png"
            alt="Servezy Logo"
            sx={{
              width: 30,
              height: 30,
              mr: 1,
              borderRadius: "4px",
            }}
          />
          <Typography variant="h6" color="white">
            Servezy
          </Typography>
        </Box>

        {/* Links */}
        {token && user && (
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {user.role === "admin" && (
              <>
                <Button color="inherit" component={Link} to="/admin/dashboard">
                  Dashboard
                </Button>
                <Button color="inherit" component={Link} to="/admin/users">
                  Users
                </Button>
              </>
            )}
            {user.role === "vendor" && (
              <>
                <Button color="inherit" component={Link} to="/vendor/dashboard">
                  Vendor Panel
                </Button>
                <Button color="inherit" component={Link} to="/vendor/orders">
                  Orders
                </Button>
              </>
            )}
            {user.role === "user" && (
              <>
                <Button color="inherit" component={Link} to="/dashboard">
                  Home
                </Button>
                <Button color="inherit" component={Link} to="/orders">
                  My Orders
                </Button>
              </>
            )}
            <Button
              variant="contained"
              color="error"
              onClick={handleLogout}
              sx={{ ml: 2 }}
            >
              Logout
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;