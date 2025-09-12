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

const API = process.env.REACT_APP_API_BASE_URL || "";

// Fallback platform rate (decimal). 0.15 = 15%
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

// Calculate commission for an order with fallbacks:
// 1) explicit amount on order (commission/commissionAmount/platformCommission/platformFee)
// 2) order.commissionRate (decimal)
// 3) vendor.commissionRate (decimal)
// 4) DEFAULT_RATE
const commissionFor = (o) => {
  if (!o) return 0;
  const explicit =
    o?.commission ?? o?.commissionAmount ?? o?.platformCommission ?? o?.platformFee;
  if (explicit != null) return Number(explicit) || 0;

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
    UserId: ""
  });
  const [vendorPage, setVendorPage] = useState(0);
  const [vendorRowsPerPage, setVendorRowsPerPage] = useState(20);
  const [vendorTotal, setVendorTotal] = useState(0);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  // orders (admin list), client-side paginate
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderVendorFilter, setOrderVendorFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFrom, setOrderFrom] = useState(""); // (kept for UI; backend GET /admin/orders doesn’t filter dates)
  const [orderTo, setOrderTo] = useState("");
  const [orderPage, setOrderPage] = useState(0);
  const [orderRowsPerPage, setOrderRowsPerPage] = useState(20);

  const token = localStorage.getItem("token");
  const headers = React.useMemo(
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

  /* ---------------- API: Users ---------------- */
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

  /* ---------------- API: Vendors ---------------- */
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

  /* ---------------- API: Orders (ONLY /api/admin/orders) ---------------- */
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const params = {};
      if (orderStatusFilter !== "all") params.status = orderStatusFilter;
      if (orderVendorFilter !== "all") params.VendorId = String(orderVendorFilter);

      const res = await axios.get(`${API}/api/admin/orders`, {
        headers,
        params,
        validateStatus: () => true
      });

      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || `Failed (${res.status})`);

      const data = res.data;
      const list =
        Array.isArray(data) ? data :
        Array.isArray(data?.items) ? data.items :
        Array.isArray(data?.orders) ? data.orders : [];
      setOrders(list);
      setOrderPage(0);
    } catch (err) {
      console.error("Orders fetch failed:", err);
      toast.error(err?.message || "Failed to load orders");
      setOrders([]);
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
      const res = await axios.post(`${API}/api/vendors`, vendorForm, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to create vendor");
      toast.success("Vendor created");
      setVendorForm({ name: "", location: "", cuisine: "", UserId: "" });
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
      const res = await axios.patch(`${API}/api/admin/users/${user.id}`, { role: nextRole }, { headers, validateStatus: () => true });
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
      UserId: v.UserId || ""
    });
  };

  const cancelEditVendor = () => {
    setEditingVendorId(null);
    setEditVendorForm({});
  };

  const saveVendorRow = async () => {
    const { id, name, location, cuisine, UserId } = editVendorForm;
    if (!id) return;
    if (!name || !location || !cuisine || !UserId) {
      toast.error("Please fill all fields");
      return;
    }
    setSavingVendorId(id);
    try {
      const res = await axios.put(`${API}/api/vendors/${id}`, { name, location, cuisine, UserId }, { headers, validateStatus: () => true });
      if (res.status === 401) return handle401();
      if (res.status >= 400) throw new Error(res.data?.message || "Failed to update vendor");
      toast.success("Vendor updated");
      setVendors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name, location, cuisine, UserId } : v))
      );
      cancelEditVendor();
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
    fetchOrders(); // only /api/admin/orders
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

  // Orders filtering: status/vendor handled server-side; search handled client-side
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
    const headers = ["ID", "Name", "Location", "Cuisine", "UserId", "Open", "Deleted", "Created At"];
    const rows = filteredVendors.map((v) =>
      [
        v.id,
        safeCsv(v.name),
        safeCsv(v.location),
        safeCsv(v.cuisine),
        v.UserId,
        v.isOpen ? "Yes" : "No",
        v.isDeleted ? "Yes" : "No",
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

          {/* Commission tiles */}
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
        {/* (unchanged table and actions from your previous file) */}
        {/* ... users table code stays exactly as before ... */}

        {/* VENDORS */}
        {/* (unchanged table and actions from your previous file) */}
        {/* ... vendors table code stays exactly as before ... */}

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
                <TextField size="small" label="From (UI only)" type="date" InputLabelProps={{ shrink: true }} value={orderFrom} onChange={(e) => setOrderFrom(e.target.value)} />
                <TextField size="small" label="To (UI only)" type="date" InputLabelProps={{ shrink: true }} value={orderTo} onChange={(e) => setOrderTo(e.target.value)} />

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
                      <TableCell colSpan={9} align="center"><CircularProgress size={20} /></TableCell>
                    </TableRow>
                  ) : pagedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No orders found</TableCell>
                    </TableRow>
                  ) : (
                    pagedOrders.map((o, idx) => {
                      const id = o?.id ?? o?._id ?? idx;
                      const total = Number(o?.totalAmount ?? 0);
                      const comm = commissionFor(o);
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
                          <TableCell>{fmtMoney(comm)}</TableCell>
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