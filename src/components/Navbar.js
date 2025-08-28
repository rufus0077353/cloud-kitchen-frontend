
// src/components/Navbar.js
import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { socket } from "../utils/socket";

import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Avatar,
  useMediaQuery,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from "@mui/icons-material/Home";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

// (served from /public — change to /logo192.png if you don’t have an SVG)
const BRAND = {
  src: "/servezy-logo.png",
  fallback: "/logo192.png",
  alt: "Servezy",
};

const isPathActive = (location, path) => location.pathname.startsWith(path);

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSmall = useMediaQuery("(max-width:900px)");

  const token = localStorage.getItem("token");
  const user = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vendorId, setVendorId] = useState(
    localStorage.getItem("vendorId") || null
  );
  const [vendorPendingCount, setVendorPendingCount] = useState(0);
  const [userActiveCount, setUserActiveCount] = useState(0);

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const role = user?.role;
  const isVendor = token && role === "vendor";
  const isUser = token && role === "user";
  const isAdmin = token && role === "admin";

  // ---------- Badge counters ----------
  const fetchVendorPending = async () => {
    if (!isVendor) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor`, { headers });
      if (!res.ok) return setVendorPendingCount(0);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setVendorPendingCount(list.filter((o) => o.status === "pending").length);
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
      const list = Array.isArray(data) ? data : [];
      setUserActiveCount(
        list.filter((o) => ["pending", "accepted", "ready"].includes(o.status))
          .length
      );
    } catch {
      setUserActiveCount(0);
    }
  };

  // ---------- Socket room joins ----------
  useEffect(() => {
    if (!token) return;

    // user room
    if (user?.id) socket.emit("user:join", user.id);

    // vendor room
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
      if (isVendor && Number(order?.VendorId) === Number(vendorId))
        fetchVendorPending();
      if (isUser && Number(order?.UserId) === Number(user?.id))
        fetchUserActive();
    };
    const onStatus = (payload) => {
      if (isVendor) fetchVendorPending();
      if (isUser && Number(payload?.UserId) === Number(user?.id))
        fetchUserActive();
    };
    socket.on("order:new", onNew);
    socket.on("order:status", onStatus);
    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status", onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, isUser, vendorId, user?.id]);

  // Close drawer on route change (mobile UX)
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const homeLink = token
    ? isVendor
      ? "/vendor/dashboard"
      : isAdmin
      ? "/admin/dashboard"
      : "/dashboard"
    : "/login";

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("vendorId");
    navigate("/login");
  };

  // ---------- Role-based links ----------
  const links = useMemo(() => {
    if (!token || !role) return [];
    if (isAdmin) {
      return [
        { to: "/admin/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
        { to: "/admin/users", label: "Users", icon: <PeopleIcon /> },
        { to: "/admin/orders", label: "Orders", icon: <ListAltIcon />},
      ];
    }
    if (isVendor) {
      return [
        { to: "/vendor/dashboard", label: "Vendor Panel", icon: <StorefrontIcon /> },
        {
          to: "/vendor/orders",
          label: "Orders",
          icon: <ListAltIcon />,
          badge: vendorPendingCount,
        },
      ];
    }
    // user
    return [
      { to: "/dashboard", label: "Home", icon: <HomeIcon /> },
      {
        to: "/orders",
        label: "My Orders",
        icon: <ListAltIcon />,
        badge: userActiveCount,
      },
    ];
  }, [token, role, isAdmin, isVendor, vendorPendingCount, userActiveCount]);

  // ---------- Brand (logo + text) ----------
  const Brand = (
    <Box
      component={RouterLink}
      to={homeLink}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <Avatar
        src={BRAND.src}
        alt={BRAND.alt}
        imgProps={{ onError: (e) => (e.currentTarget.src = BRAND.fallback) }}
        sx={{ width: 30, height: 30 }}
        variant="square"
      />
      <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
        Servezy
      </Typography>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" elevation={1} color="primary">
        <Toolbar sx={{ gap: 2 }}>
          {/* Mobile: hamburger */}
          {token && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" } }}
              aria-label="open menu"
            >
              <MenuIcon />
            </IconButton>
          )}

          {Brand}

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop links */}
          {token && (
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
              {links.map((lnk) => {
                const active = isPathActive(location, lnk.to);
                const btn = (
                  <Button
                    key={lnk.to}
                    component={RouterLink}
                    to={lnk.to}
                    color="inherit"
                    startIcon={lnk.icon}
                    sx={{
                      textTransform: "none",
                      bgcolor: active ? "rgba(255,255,255,0.12)" : "transparent",
                    }}
                  >
                    {lnk.label}
                  </Button>
                );
                return lnk.badge ? (
                  <Badge
                    key={lnk.to}
                    color="secondary"
                    badgeContent={lnk.badge > 99 ? "99+" : lnk.badge}
                  >
                    {btn}
                  </Badge>
                ) : (
                  btn
                );
              })}

              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ textTransform: "none" }}
              >
                Logout
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 270, display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, p: 2 }}>
            <Avatar
              src={BRAND.src}
              alt={BRAND.alt}
              imgProps={{ onError: (e) => (e.currentTarget.src = BRAND.fallback) }}
              sx={{ width: 34, height: 34 }}
              variant="square"
            />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Servezy
            </Typography>
          </Box>
          <Divider />

          {token && (
            <List sx={{ py: 0 }}>
              {links.map((lnk) => {
                const active = isPathActive(location, lnk.to);
                return (
                  <ListItemButton
                    key={lnk.to}
                    component={RouterLink}
                    to={lnk.to}
                    onClick={() => setDrawerOpen(false)}
                    selected={active}
                  >
                    <ListItemIcon>
                      {lnk.badge ? (
                        <Badge
                          color="secondary"
                          badgeContent={lnk.badge > 99 ? "99+" : lnk.badge}
                        >
                          {lnk.icon}
                        </Badge>
                      ) : (
                        lnk.icon
                      )}
                    </ListItemIcon>
                    <ListItemText primary={lnk.label} />
                  </ListItemButton>
                );
              })}
            </List>
          )}

          <Box sx={{ flexGrow: 1 }} />
          {token && (
            <>
              <Divider />
              <List sx={{ py: 0 }}>
                <ListItemButton
                  onClick={() => {
                    setDrawerOpen(false);
                    handleLogout();
                  }}
                >
                  <ListItemIcon>
                    <LogoutIcon />
                  </ListItemIcon>
                  <ListItemText primary="Logout" />
                </ListItemButton>
              </List>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}