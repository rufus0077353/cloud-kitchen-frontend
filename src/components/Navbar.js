
// src/components/Navbar.js
import React, { useState, useMemo } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const Navbar = () => {
  const navigate = useNavigate();
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);
  const token = localStorage.getItem("token");
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const getHomePath = () => {
    if (!user) return "/";
    if (user.role === "admin") return "/admin/dashboard";
    if (user.role === "vendor") return "/vendor/dashboard";
    return "/dashboard";
  };

  const navLinks = () => {
    if (!token || !user) return [];
    if (user.role === "admin") {
      return [
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/users", label: "Users" },
      ];
    }
    if (user.role === "vendor") {
      return [
        { to: "/vendor/dashboard", label: "Vendor Panel" },
        { to: "/vendor/orders", label: "Orders" },
      ];
    }
    return [
      { to: "/dashboard", label: "Home" },
      { to: "/orders", label: "My Orders" },
    ];
  };

  const links = navLinks();

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: "#ff6f00" }}>
        <Toolbar sx={{ minHeight: 64, px: { xs: 1, sm: 2 } }}>
          {/* Left: Logo */}
          <Box
            component={RouterLink}
            to={getHomePath()}
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
              mr: 2,
            }}
          >
            <Box
              component="img"
              src="/logo192.png" // ensure this exists in /public
              alt="Servezy Logo"
              sx={{ height: 36, width: "auto", mr: 1 }}
            />
            <Typography
              variant="h6"
              sx={{
                display: { xs: "none", sm: "block" },
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              Servezy
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop links */}
          {token && user ? (
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, alignItems: "center" }}>
              {links.map((l) => (
                <Button
                  key={l.to}
                  component={RouterLink}
                  to={l.to}
                  sx={{
                    color: "white",
                    textTransform: "none",
                    fontWeight: 500,
                    "&:hover": { backgroundColor: "#e65100" },
                  }}
                >
                  {l.label}
                </Button>
              ))}
              <Button
                onClick={handleLogout}
                variant="contained"
                sx={{
                  backgroundColor: "#e53935",
                  "&:hover": { backgroundColor: "#c62828" },
                  textTransform: "none",
                }}
              >
                Logout
              </Button>
            </Box>
          ) : null}

          {/* Mobile menu button */}
          {token && user ? (
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={() => setOpen(true)}
              sx={{ display: { xs: "flex", md: "none" }, ml: 1 }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
        </Toolbar>
      </AppBar>

      {/* Drawer (mobile) */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 260, backgroundColor: "#fafafa" } }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <Box component="img" src="/logo192.png" alt="Servezy" sx={{ height: 28 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#ff6f00" }}>
            Servezy
          </Typography>
        </Box>
        <Divider />
        <List sx={{ py: 0 }}>
          {links.map((l) => (
            <ListItemButton
              key={l.to}
              component={RouterLink}
              to={l.to}
              onClick={() => setOpen(false)}
              sx={{
                "&:hover": { backgroundColor: "#ffe0b2" },
              }}
            >
              <ListItemText primary={l.label} sx={{ color: "#333" }} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: "#e53935",
              "&:hover": { backgroundColor: "#c62828" },
              textTransform: "none",
            }}
            onClick={() => {
              setOpen(false);
              handleLogout();
            }}
          >
            Logout
          </Button>
        </Box>
      </Drawer>
    </>
  );
};

export default Navbar;
