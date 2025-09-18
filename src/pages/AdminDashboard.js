// src/pages/AdminDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Grid, Paper, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack, Divider, Chip, Tooltip, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, LinearProgress, TablePagination,
  Checkbox
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import BlockIcon from "@mui/icons-material/Block";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import axios from "axios";
import { toast } from "react-toastify";
import { socket } from "../utils/socket";

const API = process.env.REACT_APP_API_BASE_URL || "";
// Fallback rate if an order/vendor doesn't provide one (e.g. 0.15 for 15%)
const DEFAULT_RATE = Number(process.env.REACT_APP_PLATFORM_RATE || 0.15);

/* ---------------- helpers ---------------- */
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const fmtMoney = (n) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0))}`;

const safeCsv = (val) => {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, headerArr, rowsArr) => {
  const csv = [headerArr.join(","), ...rowsArr].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const STATUS_COLORS = {
  pending: "default",
  accepted: "primary",
  rejected: "error",
  ready: "warning",
  delivered: "success",
};

// % helpers for vendor commission UI
const toPctStr = (decimalRate) => {
  if (decimalRate == null || Number.isNaN(Number(decimalRate))) return "";
  return (Number(decimalRate) * 100).toFixed(2); // show 2dp in the input
};
const parsePctInputToDecimal = (val) => {
  if (val == null || val === "") return null;
  const num = Number(val);
  if (!isFinite(num)) return null;
  return num / 100; // convert % → decimal
};

// Calculate commission for an order with several fallbacks
const commissionFor = (o) => {
  if (!o) return 0;
  // explicit amount on order (if backend sends one)
  const explicit =
    o?.commission ?? o?.commissionAmount ?? o?.platformCommission ?? o?.platformFee;
  if (explicit != null) return Number(explicit) || 0;

  // percentage rate: order -> vendor -> default
  const rate =
    (o?.commissionRate != null ? Number(o.commissionRate) : null) ??
    (o?.Vendor?.commissionRate != null ? Number(o.Vendor.commissionRate) : null) ??
    DEFAULT_RATE;

  const total = Number(o?.totalAmount || 0);
  return Math.max(0, total * (isFinite(rate) ? rate : DEFAULT_RATE));
};

// treat these as non-revenue for commission
const isRevenueOrder = (o) =>
  !["rejected", "canceled", "cancelled"].includes(String(o?.status || "").toLowerCase());

/* ------------------------------------------------------------- */

export default function AdminDashboard() {
  // top stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all"); // all | active | archived
  const [savingUserId, setSavingUserId] = useState(null);
  const [pendingRoleByUser, setPendingRoleByUser] = useState({});
  const [userPage, setUserPage] = useState(0);
  const [userRowsPerPage, setUserRowsPerPage] = useState(20);
  const [userTotal, setUserTotal] = useState(0);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // vendors
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState("all"); // all | active | archived
  const [adding, setAdding] = useState(false);
  const [savingVendorId, setSavingVendorId] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editVendorForm, setEditVendorForm] = useState({});
  const [vendorForm, setVendorForm] = useState({
    name: "",
    location: "",
    cuisine: "",
    UserId: "",
    commissionRatePct: "" // UI as percent; sent as decimal to backend
  });
  const [vendorPage, setVendorPage] = useState(0);
  const [vendorRowsPerPage, setVendorRowsPerPage] = useState(20);
  const [vendorTotal, setVendorTotal] = useState(0);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  // orders (admin view via /api/orders/filter, client-side paginate)
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderVendorFilter, setOrderVendorFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFrom, setOrderFrom] = useState("");
  const [orderTo, setOrderTo] = useState("");
  const [orderPage, setOrderPage] = useState(0);
  const [orderRowsPerPage, setOrderRowsPerPage] = useState(20);

  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const handle401 = () => {
    toast.error("Session expired. Please log in again.");
    localStorage.clear();
    window.location.href = "/login";
  };

  /* ---------------- API: Stats ---------------- */
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/overview`, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error();
      setStats(res.data || {});
    } catch {
      toast.error("Failed to load overview");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  /* ---------------- API: Users (server-side pagination w/ fallback) ---------------- */
  const fetchUsers = async ({ page = userPage, size = userRowsPerPage } = {}) => {
    setUsersLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/users`, {
        headers,
        validateStatus: () => true,
        params: { page: page + 1, pageSize: size }
      });
      if (res.status === 401) return handle401();
      const data = res.data;
      if (Array.isArray(data)) {
        setUsers(data);
        setUserTotal(data.length);
      } else {
        setUsers(Array.isArray(data.items) ? data.items : []);
        setUserTotal(Number(data.total || 0));
      }
      setSelectedUserIds([]);
    } catch {
      toast.error("Failed to load users");
      setUsers([]);
      setUserTotal(0);
      setSelectedUserIds([]);
    } finally {
      setUsersLoading(false);
    }
  };

  /* ---------------- API: Vendors (server-side pagination w/ fallback) ---------------- */
  const fetchVendors = async ({ page = vendorPage, size = vendorRowsPerPage } = {}) => {
    setVendorsLoading(true);
    try {
      const res = await axios.get(`${API}/api/vendors`, {
        headers,
        validateStatus: () => true,
        params: { page: page + 1, pageSize: size }
      });
      if (res.status === 401) return handle401();
      const data = res.data;
      if (Array.isArray(data)) {
        setVendors(data);
        setVendorTotal(data.length);
      } else {
        setVendors(Array.isArray(data.items) ? data.items : []);
        setVendorTotal(Number(data.total || 0));
      }
      setSelectedVendorIds([]);
    } catch {
      toast.error("Failed to load vendors");
      setVendors([]);
      setVendorTotal(0);
      setSelectedVendorIds([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  /* ---------------- API: Orders (robust fetch with fallback) ---------------- */
  const fetchOrders = async () => {
    setOrdersLoading(true);

    const params = {};
    if (orderStatusFilter !== "all") params.status = orderStatusFilter;
    if (orderVendorFilter !== "all") params.VendorId = String(orderVendorFilter);
    if (orderFrom) params.startDate = orderFrom;
    if (orderTo) params.endDate = orderTo;

    const parseList = (data) =>
      Array.isArray(data) ? data :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data?.orders) ? data.orders : [];

    try {
      // Try new endpoint first
      const res = await axios.post(`${API}/api/orders/filter`, params, {
        headers,
        validateStatus: () => true,
      });
      if (res.status === 404) throw Object.assign(new Error("filter endpoint not found"), { code: "NO_FILTER_ROUTE" });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || `Failed (${res.status})`);

      const list = parseList(res.data);
      setOrders(list);
      setOrderPage(0);
    } catch (err) {
      // Fallback to admin route
      try {
        const res2 = await axios.get(`${API}/api/admin/orders`, {
          headers,
          params,
          validateStatus: () => true,
        });
        if (res2.status === 401) return handle401();
        if (res2.status >= 400) throw new Error(res2.data?.message || `Failed (${res2.status})`);

        const list2 = parseList(res2.data);
        setOrders(list2);
        setOrderPage(0);
      } catch (e2) {
        console.error("Orders fetch failed (both routes):", err, e2);
        toast.error(e2?.message || err?.message || "Failed to load orders");
        setOrders([]);
      }
    } finally {
      setOrdersLoading(false);
    }
  };

  /* ---------------- CRUD: Vendors/Users ---------------- */
  const handleAddVendor = async () => {
    if (!vendorForm.name || !vendorForm.location || !vendorForm.cuisine || !vendorForm.UserId) {
      toast.error("Please fill in all fields");
      return;
    }
    setAdding(true);
    try {
      const body = {
        name: vendorForm.name,
        location: vendorForm.location,
        cuisine: vendorForm.cuisine,
        UserId: vendorForm.UserId,
      };
      // Optional: commission % → decimal
      const dec = parsePctInputToDecimal(vendorForm.commissionRatePct);
      if (dec != null) body.commissionRate = dec;

      const res = await axios.post(`${API}/api/vendors`, body, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to create vendor");
      toast.success("Vendor created");
      setVendorForm({ name: "", location: "", cuisine: "", UserId: "", commissionRatePct: "" });
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      fetchStats();
    } catch (err) {
      toast.error(err?.message || "Failed to create vendor");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm(`Delete vendor #${id}? This cannot be undone.`)) return;
    try {
      const res = await axios.delete(`${API}/api/vendors/${id}`, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to delete vendor");
      toast.success("Vendor deleted");
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      fetchStats();
    } catch (e) {
      toast.error(e?.message || "Failed to delete vendor");
    }
  };

  const setVendorDeleted = async (v, isDeleted) => {
    setSavingVendorId(v.id);
    try {
      const res = await axios.put(`${API}/api/vendors/${v.id}`, { isDeleted }, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to update vendor");
      toast.success(isDeleted ? "Vendor archived" : "Vendor restored");
      setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, isDeleted } : x)));
      fetchStats();
    } catch (e) {
      toast.error(e?.message || "Failed to update vendor");
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm(`Delete user #${id}? This cannot be undone.`)) return;
    try {
      const res = await axios.delete(`${API}/api/admin/users/${id}`, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to delete user");
      toast.success("User deleted");
      fetchUsers({ page: userPage, size: userRowsPerPage });
      fetchStats();
    } catch (e) {
      toast.error(e?.message || "Failed to delete user");
    }
  };

  const setUserDeleted = async (u, isDeleted) => {
    setSavingUserId(u.id);
    try {
      const res = await axios.patch(`${API}/api/admin/users/${u.id}`, { isDeleted }, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to update user");
      toast.success(isDeleted ? "User archived" : "User restored");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isDeleted } : x)));
      fetchStats();
    } catch (e) {
      toast.error(e?.message || "Failed to update user");
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleVendorOpen = async (v) => {
    const next = !Boolean(v.isOpen);
    setSavingVendorId(v.id);
    try {
      const res = await axios.put(`${API}/api/vendors/${v.id}`, { isOpen: next }, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to update vendor status");
      toast.success(`Vendor ${next ? "opened" : "closed"}`);
      setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, isOpen: next } : x)));
    } catch (e) {
      toast.error(e?.message || "Failed to update vendor status");
    } finally {
      setSavingVendorId(null);
    }
  };

  /* ---------------- User role editing ---------------- */
  const handleRoleChangeLocal = (userId, role) => {
    setPendingRoleByUser((prev) => ({ ...prev, [userId]: role }));
  };

  const saveUserRole = async (user) => {
   const nextRole = pendingRoleByUser[user.id] ?? user.role;
   if (!nextRole || nextRole === user.role) {
     toast.info("No role change to save");
     return;
   }
   setSavingUserId(user.id);
   try {
    // ✅ match backend route you actually have
    const res = await axios.put(
      `${API}/api/admin/users/${user.id}/role`,
      { role: nextRole },
      { headers, validateStatus: () => true }
     );
     if (res.status === 401) return handle401();
     if (res.status >= 400) throw new Error(res.data?.message || "Failed to update role");

     toast.success(`Role updated to ${nextRole}`);
     setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
     setPendingRoleByUser((prev) => {
      const copy = { ...prev };
      delete copy[user.id];
      return copy;
      });
    } catch (e) {
      toast.error(e?.message || "Failed to update role");
    } finally {
      setSavingUserId(null);
   }
};

  // Inline vendor edit
  const startEditVendor = (v) => {
    setEditingVendorId(v.id);
    setEditVendorForm({
      id: v.id,
      name: v.name || "",
      location: v.location || "",
      cuisine: v.cuisine || "",
      UserId: v.UserId || "",
      // UI stores % string; we display vendor.commissionRate (decimal) as %
      commissionRatePct: toPctStr(v.commissionRate ?? "")
    });
  };

  const cancelEditVendor = () => {
    setEditingVendorId(null);
    setEditVendorForm({});
  };

  const saveVendorRow = async () => {
    const { id, name, location, cuisine, UserId, commissionRatePct } = editVendorForm;
    if (!id) return;
    if (!name || !location || !cuisine || !UserId) {
      toast.error("Please fill all fields");
      return;
    }
    setSavingVendorId(id);
    try {
      const body = { name, location, cuisine, UserId };
      // Optional: commission % → decimal
      const dec = parsePctInputToDecimal(commissionRatePct);
      if (dec != null) body.commissionRate = dec;

      const res = await axios.put(`${API}/api/vendors/${id}`, body, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to update vendor");
      toast.success("Vendor updated");
      setVendors((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                name,
                location,
                cuisine,
                UserId,
                commissionRate: dec != null ? dec : v.commissionRate
              }
            : v
        )
      );
      cancelEditVendor();
      fetchStats();
    } catch (e) {
      toast.error(e?.message || "Failed to update vendor");
    } finally {
      setSavingVendorId(null);
    }
  };

  /* ---------------- initial load ---------------- */
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchVendors();
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
// 🔔 Live updates for Admin: orders + payouts
 useEffect(() => {
  // new order (support both event names your backend might emit)
   const onOrderNew = (o) => {
    try { toast.info(`🆕 New order #${o?.id ?? ""}`); } catch {}
    fetchOrders();
    fetchStats();
   };

  // order status changed
  const onOrderStatus = (p) => {
    try { toast.success(`📦 Order #${p?.id ?? ""} → ${p?.status ?? ""}`); } catch {}
    fetchOrders();
    fetchStats();
  };

  // payout created/updated (emitted when vendor delivers + paid, or admin updates status)
  const onPayoutUpdate = (p) => {
    const amt = p?.payoutAmount != null ? Number(p.payoutAmount).toFixed(2) : "";
    try { toast.success(`💰 Payout ${p?.status ?? "updated"} — Order #${p?.orderId ?? ""}${amt ? ` · ₹${amt}` : ""}`); } catch {}
    // commissions affect tiles → refresh
    fetchStats();
    // If you later add an Admin payouts table, call fetchPayouts() here too.
  };

  // hook up listeners
  socket.on("order:new", onOrderNew);
  socket.on("order:created", onOrderNew);
  socket.on("order:status", onOrderStatus);
  socket.on("payout:update", onPayoutUpdate);

  // optional: on reconnect, do a light refresh
  const onReconnect = () => {
    fetchStats();
  };
  socket.on("connect", onReconnect);

  // cleanup
  return () => {
    socket.off("order:new", onOrderNew);
    socket.off("order:created", onOrderNew);
    socket.off("order:status", onOrderStatus);
    socket.off("payout:update", onPayoutUpdate);
    socket.off("connect", onReconnect);
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* ---------------- derived lists (client-side filter/search) ---------------- */
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return (users || [])
      .filter((u) => (roleFilter === "all" ? true : (u.role || "").toLowerCase() === roleFilter))
      .filter((u) => {
        if (userStatusFilter === "active") return !u.isDeleted;
        if (userStatusFilter === "archived") return !!u.isDeleted;
        return true;
      })
      .filter((u) => {
        if (!q) return true;
        return (
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          String(u.id).includes(q)
        );
      });
  }, [users, userSearch, roleFilter, userStatusFilter]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return (vendors || [])
      .filter((v) => {
        if (vendorStatusFilter === "active") return !v.isDeleted;
        if (vendorStatusFilter === "archived") return !!v.isDeleted;
        return true;
      })
      .filter((v) => {
        if (!q) return true;
        return (
          (v.name || "").toLowerCase().includes(q) ||
          (v.location || "").toLowerCase().includes(q) ||
          (v.cuisine || "").toLowerCase().includes(q) ||
          String(v.id).includes(q) ||
          String(v.UserId || "").includes(q)
        );
      });
  }, [vendors, vendorSearch, vendorStatusFilter]);

  // Orders filtering: status/vendor/date handled server-side; search handled client-side
  const visibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const list = Array.isArray(orders) ? orders : [];
    if (!q) return list;
    return list.filter((o) => {
      const userName = (o?.User?.name || "").toLowerCase();
      const vendorName = (o?.Vendor?.name || "").toLowerCase();
      const idStr = String(o?.id || "");
      return userName.includes(q) || vendorName.includes(q) || idStr.includes(q);
    });
  }, [orders, orderSearch]);

  // Earnings summary (paid + non-canceled) based on visible orders
  const earnings = useMemo(() => {
    const eligible = visibleOrders.filter(
      (o) => isRevenueOrder(o) && String(o?.paymentStatus || "").toLowerCase() === "paid"
    );
    const count = eligible.length;
    const gross = eligible.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const commission = eligible.reduce((s, o) => s + commissionFor(o), 0);
    return { count, gross, commission, payout: gross - commission };
  }, [visibleOrders]);

  // If backend doesn't provide monthCommission, compute it locally
  const monthCommissionLocal = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const eligible = (orders || []).filter((o) => {
      const created = o?.createdAt ? new Date(o.createdAt).getTime() : 0;
      const paid = String(o?.paymentStatus || "").toLowerCase() === "paid";
      return isRevenueOrder(o) && paid && created >= start;
    });
    return eligible.reduce((s, o) => s + commissionFor(o), 0);
  }, [orders]);

  /* ---------------- CSV exports ---------------- */
  const exportUsersCsv = () => {
    const headers = ["ID", "Name", "Email", "Role", "Deleted", "Created At"];
    const rows = filteredUsers.map((u) =>
      [u.id, safeCsv(u.name), safeCsv(u.email), u.role, u.isDeleted ? "Yes" : "No", u.createdAt || ""].join(",")
    );
    downloadCsv("admin-users", headers, rows);
  };

  const exportVendorsCsv = () => {
    const headers = ["ID", "Name", "Location", "Cuisine", "UserId", "Open", "Deleted", "Commission %", "Created At"];
    const rows = filteredVendors.map((v) =>
      [
        v.id,
        safeCsv(v.name),
        safeCsv(v.location),
        safeCsv(v.cuisine),
        v.UserId,
        v.isOpen ? "Yes" : "No",
        v.isDeleted ? "Yes" : "No",
        v.commissionRate != null ? (Number(v.commissionRate) * 100).toFixed(2) : "", // percent
        v.createdAt || ""
      ].join(",")
    );
    downloadCsv("admin-vendors", headers, rows);
  };

  const exportOrdersCsv = () => {
    const headers = ["Order ID", "User", "Vendor", "Total", "Commission", "Status", "Payment", "Created At"];
    const rows = visibleOrders.map((o) =>
      [
        o.id,
        safeCsv(o?.User?.name || ""),
        safeCsv(o?.Vendor?.name || ""),
        o.totalAmount,
        commissionFor(o).toFixed(2),
        o.status,
        `${o.paymentMethod || ""}/${o.paymentStatus || ""}`,
        o.createdAt ? new Date(o.createdAt).toLocaleString() : ""
      ].join(",")
    );
    downloadCsv("admin-orders", headers, rows);
  };

  /* ---------------- pagination handlers ---------------- */
  const handleChangeUserPage = (_e, newPage) => {
    setUserPage(newPage);
    fetchUsers({ page: newPage, size: userRowsPerPage });
  };
  const handleChangeUserRows = (e) => {
    const size = parseInt(e.target.value, 10);
    setUserRowsPerPage(size);
    setUserPage(0);
    fetchUsers({ page: 0, size });
  };

  const handleChangeVendorPage = (_e, newPage) => {
    setVendorPage(newPage);
    fetchVendors({ page: newPage, size: vendorRowsPerPage });
  };
  const handleChangeVendorRows = (e) => {
    const size = parseInt(e.target.value, 10);
    setVendorRowsPerPage(size);
    setVendorPage(0);
    fetchVendors({ page: 0, size });
  };

  // Orders pagination is client-side
  const orderTotal = visibleOrders.length;
  const pagedOrders = useMemo(() => {
    const start = orderPage * orderRowsPerPage;
    return visibleOrders.slice(start, start + orderRowsPerPage);
  }, [visibleOrders, orderPage, orderRowsPerPage]);

  /* ---------------- selection helpers (Users) ---------------- */
  const userIdsVisible = filteredUsers.map((u) => u.id);
  const allUsersChecked = userIdsVisible.length > 0 && userIdsVisible.every((id) => selectedUserIds.includes(id));
  const someUsersChecked = userIdsVisible.some((id) => selectedUserIds.includes(id));
  const toggleSelectAllUsers = () => {
    setSelectedUserIds(allUsersChecked ? [] : userIdsVisible);
  };
  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* ---------------- selection helpers (Vendors) ---------------- */
  const vendorIdsVisible = filteredVendors.map((v) => v.id);
  const allVendorsChecked =
    vendorIdsVisible.length > 0 && vendorIdsVisible.every((id) => selectedVendorIds.includes(id));
  const someVendorsChecked = vendorIdsVisible.some((id) => selectedVendorIds.includes(id));
  const toggleSelectAllVendors = () => {
    setSelectedVendorIds(allVendorsChecked ? [] : vendorIdsVisible);
  };
  const toggleSelectVendor = (id) => {
    setSelectedVendorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* ---------------- bulk actions ---------------- */
  const bulkArchiveUsers = async (archive) => {
    if (selectedUserIds.length === 0) return;
    const verb = archive ? "archive" : "restore";
    try {
      const ops = selectedUserIds.map((id) =>
        axios.patch(`${API}/api/admin/users/${id}`, { isDeleted: archive }, { headers, validateStatus: () => true })
      );
      const results = await Promise.allSettled(ops);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast.success(`Users ${verb}d: ${ok}${fail ? ` · failed: ${fail}` : ""}`);
      fetchUsers({ page: userPage, size: userRowsPerPage });
      setSelectedUserIds([]);
      fetchStats();
    } catch {
      toast.error(`Failed to ${verb} users`);
    }
  };
  const bulkDeleteUsers = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedUserIds.length} user(s)? This cannot be undone.`)) return;
    try {
      const ops = selectedUserIds.map((id) => axios.delete(`${API}/api/admin/users/${id}`, { headers, validateStatus: () => true }));
      const results = await Promise.allSettled(ops);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast.success(`Users deleted: ${ok}${fail ? ` · failed: ${fail}` : ""}`);
      fetchUsers({ page: userPage, size: userRowsPerPage });
      setSelectedUserIds([]);
      fetchStats();
    } catch {
      toast.error("Failed to delete users");
    }
  };

  const bulkArchiveVendors = async (archive) => {
    if (selectedVendorIds.length === 0) return;
    const verb = archive ? "archive" : "restore";
    try {
      const ops = selectedVendorIds.map((id) =>
        axios.put(`${API}/api/vendors/${id}`, { isDeleted: archive }, { headers, validateStatus: () => true })
      );
      const results = await Promise.allSettled(ops);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast.success(`Vendors ${verb}d: ${ok}${fail ? ` · failed: ${fail}` : ""}`);
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      setSelectedVendorIds([]);
      fetchStats();
    } catch {
      toast.error(`Failed to ${verb} vendors`);
    }
  };
  const bulkDeleteVendors = async () => {
    if (selectedVendorIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedVendorIds.length} vendor(s)? This cannot be undone.`)) return;
    try {
      const ops = selectedVendorIds.map((id) => axios.delete(`${API}/api/vendors/${id}`, { headers, validateStatus: () => true }));
      const results = await Promise.allSettled(ops);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      toast.success(`Vendors deleted: ${ok}${fail ? ` · failed: ${fail}` : ""}`);
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      setSelectedVendorIds([]);
      fetchStats();
    } catch {
      toast.error("Failed to delete vendors");
    }
  };

  /* ---------------- invoice open ---------------- */
  const openInvoice = async (orderId) => {
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) return handle401();
      if (!res.ok) {
        const msg = (await res.text().catch(() => "")) || "Failed to load invoice";
        toast.error(msg);
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Network error while opening invoice");
    }
  };

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh all">
            <IconButton
              onClick={() => {
                fetchStats();
                fetchUsers({ page: userPage, size: userRowsPerPage });
                fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
                fetchOrders();
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Top stats */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
        {statsLoading && <LinearProgress sx={{ mb: 2 }} />}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Total Users</Typography>
              <Typography variant="h5">{fmtNum(stats?.totalUsers)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Total Vendors</Typography>
              <Typography variant="h5">{fmtNum(stats?.totalVendors)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Total Orders</Typography>
              <Typography variant="h5">{fmtNum(stats?.totalOrders)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
              <Typography variant="h5">{fmtMoney(stats?.totalRevenue)}</Typography>
            </Paper>
          </Grid>

          {/* NEW: Commission earned tiles */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Total Commission</Typography>
              <Typography variant="h5">{fmtMoney(stats?.totalCommission || 0)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">Commission (This Month)</Typography>
              <Typography variant="h5">
                {fmtMoney(stats?.monthCommission != null ? stats.monthCommission : monthCommissionLocal)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* USERS */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Users</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <TextField size="small" label="Search users" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="roleFilter">Role</InputLabel>
                  <Select labelId="roleFilter" label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="user">user</MenuItem>
                    <MenuItem value="vendor">vendor</MenuItem>
                    <MenuItem value="admin">admin</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="userStatus">Status</InputLabel>
                  <Select labelId="userStatus" label="Status" value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>

                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportUsersCsv} disabled={usersLoading || filteredUsers.length === 0}>
                  Export CSV
                </Button>
                <Tooltip title="Refresh users">
                  <IconButton onClick={() => fetchUsers({ page: userPage, size: userRowsPerPage })}><RefreshIcon /></IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Users bulk actions */}
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Button size="small" startIcon={<BlockIcon />} onClick={() => bulkArchiveUsers(true)} disabled={selectedUserIds.length === 0}>Archive</Button>
              <Button size="small" startIcon={<RestoreIcon />} onClick={() => bulkArchiveUsers(false)} disabled={selectedUserIds.length === 0}>Restore</Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={bulkDeleteUsers} disabled={selectedUserIds.length === 0}>Delete</Button>
              {selectedUserIds.length > 0 && <Chip size="small" label={`${selectedUserIds.length} selected`} sx={{ ml: 1 }} />}
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={someUsersChecked && !allUsersChecked}
                        checked={allUsersChecked}
                        onChange={toggleSelectAllUsers}
                        inputProps={{ "aria-label": "Select all visible users" }}
                      />
                    </TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersLoading ? (
                    <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={20} /></TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center">No users found</TableCell></TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const pendingRole = pendingRoleByUser[u.id] ?? u.role;
                      const dirty = pendingRole !== u.role;
                      const saving = savingUserId === u.id;
                      const archived = Boolean(u.isDeleted);
                      const checked = selectedUserIds.includes(u.id);
                      return (
                        <TableRow key={u.id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleSelectUser(u.id)}
                              inputProps={{ "aria-label": `Select user ${u.id}` }}
                            />
                          </TableCell>
                          <TableCell>{u.id}</TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                              <Select
                                value={pendingRole}
                                onChange={(e) => handleRoleChangeLocal(u.id, e.target.value)}
                                disabled={saving || archived}
                              >
                                <MenuItem value="user">user</MenuItem>
                                <MenuItem value="vendor">vendor</MenuItem>
                                <MenuItem value="admin">admin</MenuItem>
                              </Select>
                            </FormControl>
                            {dirty && <Chip size="small" label="unsaved" color="warning" sx={{ ml: 1 }} />}
                          </TableCell>
                          <TableCell>
                            {archived ? (
                              <Chip size="small" label="archived" color="default" />
                            ) : (
                              <Chip size="small" label="active" color="success" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                              <Tooltip title="Save role">
                                <span>
                                  <IconButton onClick={() => saveUserRole(u)} disabled={!dirty || saving || archived} color="primary">
                                    {saving ? <CircularProgress size={18} /> : <SaveIcon />}
                                  </IconButton>
                                </span>
                              </Tooltip>

                              {archived ? (
                                <Tooltip title="Restore user">
                                  <span>
                                    <IconButton color="primary" onClick={() => setUserDeleted(u, false)} disabled={saving}>
                                      <RestoreIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <>
                                  <Tooltip title="Archive user (soft delete)">
                                    <span>
                                      <IconButton color="warning" onClick={() => setUserDeleted(u, true)} disabled={saving}>
                                        <BlockIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Delete user (hard delete)">
                                    <span>
                                      <IconButton color="error" onClick={() => handleDeleteUser(u.id)} disabled={saving}>
                                        <DeleteIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={userTotal}
              page={userPage}
              onPageChange={handleChangeUserPage}
              rowsPerPage={userRowsPerPage}
              onRowsPerPageChange={handleChangeUserRows}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </Paper>
        </Grid>

        {/* VENDORS */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Vendors</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <TextField size="small" label="Search vendors" value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="vendorStatus">Status</InputLabel>
                  <Select labelId="vendorStatus" label="Status" value={vendorStatusFilter} onChange={(e) => setVendorStatusFilter(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportVendorsCsv} disabled={vendorsLoading || filteredVendors.length === 0}>
                  Export CSV
                </Button>
                <Tooltip title="Refresh vendors">
                  <IconButton onClick={() => fetchVendors({ page: vendorPage, size: vendorRowsPerPage })}><RefreshIcon /></IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Add vendor */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <TextField size="small" label="Name" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
                <TextField size="small" label="Location" value={vendorForm.location} onChange={(e) => setVendorForm({ ...vendorForm, location: e.target.value })} />
                <TextField size="small" label="Cuisine" value={vendorForm.cuisine} onChange={(e) => setVendorForm({ ...vendorForm, cuisine: e.target.value })} />
                <TextField
                  select size="small" label="User" value={vendorForm.UserId}
                  onChange={(e) => setVendorForm({ ...vendorForm, UserId: e.target.value })}
                  SelectProps={{ native: true }} sx={{ minWidth: 220 }}
                >
                  <option value="">Select User</option>
                  {(users || [])
                    .filter((u) => (u.role || "").toLowerCase() === "vendor")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </TextField>
                {/* NEW: Commission % */}
                <TextField
                  size="small"
                  label="Commission %"
                  type="number"
                  inputProps={{ step: "0.01", min: "0", max: "100" }}
                  value={vendorForm.commissionRatePct}
                  placeholder={(DEFAULT_RATE * 100).toFixed(2)}
                  onChange={(e) => setVendorForm({ ...vendorForm, commissionRatePct: e.target.value })}
                  sx={{ width: 140 }}
                />

                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddVendor} disabled={adding}>
                  {adding ? "Adding…" : "Add Vendor"}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Leave Commission % empty to use default {Math.round(DEFAULT_RATE * 100)}%.
              </Typography>
            </Paper>

            {/* Vendors bulk actions */}
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Button size="small" startIcon={<BlockIcon />} onClick={() => bulkArchiveVendors(true)} disabled={selectedVendorIds.length === 0}>Archive</Button>
              <Button size="small" startIcon={<RestoreIcon />} onClick={() => bulkArchiveVendors(false)} disabled={selectedVendorIds.length === 0}>Restore</Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={bulkDeleteVendors} disabled={selectedVendorIds.length === 0}>Delete</Button>
              {selectedVendorIds.length > 0 && <Chip size="small" label={`${selectedVendorIds.length} selected`} sx={{ ml: 1 }} />}
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={someVendorsChecked && !allVendorsChecked}
                        checked={allVendorsChecked}
                        onChange={toggleSelectAllVendors}
                        inputProps={{ "aria-label": "Select all visible vendors" }}
                      />
                    </TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Cuisine</TableCell>
                    <TableCell>UserId</TableCell>
                    <TableCell>Open</TableCell>
                    <TableCell>Status</TableCell>
                    {/* NEW: Commission column */}
                    <TableCell>Commission %</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendorsLoading ? (
                    <TableRow><TableCell colSpan={10} align="center"><CircularProgress size={20} /></TableCell></TableRow>
                  ) : filteredVendors.length === 0 ? (
                    <TableRow><TableCell colSpan={10} align="center">No vendors found</TableCell></TableRow>
                  ) : (
                    filteredVendors.map((v) => {
                      const isEditing = editingVendorId === v.id;
                      const savingRow = savingVendorId === v.id;
                      const archived = Boolean(v.isDeleted);
                      const checked = selectedVendorIds.includes(v.id);
                      const displayPct = v.commissionRate != null ? (Number(v.commissionRate) * 100).toFixed(2) : "";
                      return (
                        <TableRow key={v.id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleSelectVendor(v.id)}
                              inputProps={{ "aria-label": `Select vendor ${v.id}` }}
                            />
                          </TableCell>
                          <TableCell>{v.id}</TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editVendorForm.name ?? ""}
                                onChange={(e) => setEditVendorForm((prev) => ({ ...prev, name: e.target.value }))}
                              />
                            ) : (
                              v.name
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editVendorForm.location ?? ""}
                                onChange={(e) => setEditVendorForm((prev) => ({ ...prev, location: e.target.value }))}
                              />
                            ) : (
                              v.location
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editVendorForm.cuisine ?? ""}
                                onChange={(e) => setEditVendorForm((prev) => ({ ...prev, cuisine: e.target.value }))}
                              />
                            ) : (
                              v.cuisine
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                select size="small"
                                value={editVendorForm.UserId ?? ""}
                                onChange={(e) => setEditVendorForm((prev) => ({ ...prev, UserId: e.target.value }))}
                                SelectProps={{ native: true }}
                                sx={{ minWidth: 160 }}
                              >
                                <option value="">Select User</option>
                                {(users || [])
                                  .filter((u) => (u.role || "").toLowerCase() === "vendor")
                                  .map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.email})
                                    </option>
                                  ))}
                              </TextField>
                            ) : (
                              v.UserId
                            )}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip
                                size="small"
                                label={Boolean(v.isOpen) ? "Open" : "Closed"}
                                color={Boolean(v.isOpen) ? "success" : "default"}
                                variant="outlined"
                              />
                              <Button
                                size="small"
                                onClick={() => toggleVendorOpen(v)}
                                disabled={savingRow || isEditing || archived}
                              >
                                Toggle
                              </Button>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                label="Commission %"
                                type="number"
                                inputProps={{ step: "0.01", min: "0", max: "100" }}
                                value={editVendorForm.commissionRatePct ?? ""}
                                onChange={(e) =>
                                  setEditVendorForm((prev) => ({ ...prev, commissionRatePct: e.target.value }))
                                }
                                sx={{ width: 140 }}
                              />
                            ) : (
                              displayPct
                                ? `${displayPct}%`
                                : <Typography variant="body2" color="text.secondary">Default {Math.round(DEFAULT_RATE * 100)}%</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                              {isEditing ? (
                                <>
                                  <Tooltip title="Save vendor">
                                    <span>
                                      <IconButton color="primary" onClick={saveVendorRow} disabled={savingRow}>
                                        {savingRow ? <CircularProgress size={18} /> : <SaveIcon />}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Cancel">
                                    <IconButton onClick={cancelEditVendor}><CloseIcon /></IconButton>
                                  </Tooltip>
                                </>
                              ) : archived ? (
                                <Tooltip title="Restore vendor">
                                  <span>
                                    <IconButton color="primary" onClick={() => setVendorDeleted(v, false)} disabled={savingRow}>
                                      <RestoreIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <>
                                  <Tooltip title="Edit vendor">
                                    <IconButton onClick={() => startEditVendor(v)}><EditIcon /></IconButton>
                                  </Tooltip>
                                  <Tooltip title="Archive vendor (soft delete)">
                                    <span>
                                      <IconButton color="warning" onClick={() => setVendorDeleted(v, true)} disabled={savingRow}>
                                        <BlockIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Delete vendor (hard delete)">
                                    <span>
                                      <IconButton color="error" onClick={() => handleDeleteVendor(v.id)} disabled={savingRow}>
                                        <DeleteIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={vendorTotal}
              page={vendorPage}
              onPageChange={handleChangeVendorPage}
              rowsPerPage={vendorRowsPerPage}
              onRowsPerPageChange={handleChangeVendorRows}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </Paper>
        </Grid>

        {/* ORDERS */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Orders</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <TextField size="small" label="Search (user/vendor/id)" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="order-status">Status</InputLabel>
                  <Select
                    labelId="order-status" label="Status" value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="ready">Ready</MenuItem>
                    <MenuItem value="delivered">Delivered</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="order-vendor">Vendor</InputLabel>
                  <Select
                    labelId="order-vendor" label="Vendor" value={orderVendorFilter}
                    onChange={(e) => setOrderVendorFilter(e.target.value)}
                  >
                    <MenuItem value="all">All vendors</MenuItem>
                    {(vendors || []).map((v) => (
                      <MenuItem key={v.id} value={String(v.id)}>
                        #{v.id} — {v.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="From" type="date" InputLabelProps={{ shrink: true }} value={orderFrom} onChange={(e) => setOrderFrom(e.target.value)} />
                <TextField size="small" label="To" type="date" InputLabelProps={{ shrink: true }} value={orderTo} onChange={(e) => setOrderTo(e.target.value)} />

                <Button variant="outlined" onClick={fetchOrders} startIcon={<RefreshIcon />}>Apply</Button>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportOrdersCsv} disabled={ordersLoading || visibleOrders.length === 0}>
                  Export CSV
                </Button>
              </Stack>
            </Stack>

            {/* Earnings summary (uses current filtered view) */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Earnings (Paid & non-canceled in current view)
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Orders</Typography>
                  <Typography variant="h6">{earnings.count}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Gross Sales</Typography>
                  <Typography variant="h6">{fmtMoney(earnings.gross)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Commission</Typography>
                  <Typography variant="h6">{fmtMoney(earnings.commission)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Vendor Payout</Typography>
                  <Typography variant="h6">{fmtMoney(earnings.payout)}</Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Typography variant="caption" color="text.secondary">
                    Rate fallback: {(DEFAULT_RATE * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order #</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Commission</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <CircularProgress size={20} />
                      </TableCell>
                    </TableRow>
                  ) : !Array.isArray(pagedOrders) || pagedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No orders found</TableCell>
                    </TableRow>
                  ) : (
                    (pagedOrders || []).map((o, idx) => {
                      const id = o?.id ?? o?._id ?? idx;
                      const total = Number(o?.totalAmount ?? 0);
                      const commission = commissionFor(o);
                      const payMethod =
                        (o?.paymentMethod === "mock_online" || o?.paymentMethod === "online")
                          ? "Online"
                          : "COD";
                      const payStatus = (o?.paymentStatus || "unpaid").toLowerCase();
                      const payColor =
                        payStatus === "paid" ? "success" :
                        payStatus === "processing" ? "info" :
                        payStatus === "failed" ? "error" : "default";

                      return (
                        <TableRow key={id} hover>
                          <TableCell>{id}</TableCell>
                          <TableCell>{o?.User?.name || "-"}</TableCell>
                          <TableCell>{o?.Vendor?.name || "-"}</TableCell>
                          <TableCell>{fmtMoney(total)}</TableCell>
                          <TableCell>{fmtMoney(commission)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={o?.status || "-"} color={STATUS_COLORS[o?.status] || "default"} />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={payMethod} variant="outlined" />
                              <Chip size="small" label={payStatus} color={payColor} />
                            </Stack>
                          </TableCell>
                          <TableCell>{o?.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Invoice">
                              <span>
                                <IconButton onClick={() => openInvoice(id)}><ReceiptLongIcon /></IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={orderTotal}
              page={orderPage}
              onPageChange={(_e, newPage) => setOrderPage(newPage)}
              rowsPerPage={orderRowsPerPage}
              onRowsPerPageChange={(e) => { setOrderRowsPerPage(parseInt(e.target.value, 10) || 20); setOrderPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchStats();
            fetchUsers({ page: userPage, size: userRowsPerPage });
            fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
            fetchOrders();
          }}
        >
          Refresh All
        </Button>
      </Stack>
    </Box>
  );
}