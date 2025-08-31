
// src/pages/AdminDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Grid, Paper, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack, Divider, Chip, Tooltip, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, Switch, LinearProgress, TablePagination,
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
import axios from "axios";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_BASE_URL || "";

// ---- helpers ----
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

  const token = localStorage.getItem("token");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  // ----- API calls -----
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/overview`, { headers });
      setStats(res.data || {});
    } catch {
      toast.error("Failed to load overview");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  // USERS: server-side pagination (fallback to array)
  const fetchUsers = async ({ page = userPage, size = userRowsPerPage } = {}) => {
    setUsersLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/users`, {
        headers,
        params: { page: page + 1, pageSize: size } // backend 1-based
      });
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

  // VENDORS: server-side pagination (fallback to array)
  const fetchVendors = async ({ page = vendorPage, size = vendorRowsPerPage } = {}) => {
    setVendorsLoading(true);
    try {
      const res = await axios.get(`${API}/api/vendors`, {
        headers,
        params: { page: page + 1, pageSize: size }
      });
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

  // create vendor
  const handleAddVendor = async () => {
    if (!vendorForm.name || !vendorForm.location || !vendorForm.cuisine || !vendorForm.UserId) {
      toast.error("Please fill in all fields");
      return;
    }
    setAdding(true);
    try {
      await axios.post(`${API}/api/vendors`, vendorForm, { headers });
      toast.success("Vendor created");
      setVendorForm({ name: "", location: "", cuisine: "", UserId: "" });
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      fetchStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create vendor");
    } finally {
      setAdding(false);
    }
  };

  // delete vendor (hard delete)
  const handleDeleteVendor = async (id) => {
    if (!window.confirm(`Delete vendor #${id}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/vendors/${id}`, { headers });
      toast.success("Vendor deleted");
      fetchVendors({ page: vendorPage, size: vendorRowsPerPage });
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete vendor");
    }
  };

  // soft delete / restore vendor
  const setVendorDeleted = async (v, isDeleted) => {
    setSavingVendorId(v.id);
    try {
      await axios.put(`${API}/api/vendors/${v.id}`, { isDeleted }, { headers });
      toast.success(isDeleted ? "Vendor archived" : "Vendor restored");
      setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, isDeleted } : x)));
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update vendor");
    } finally {
      setSavingVendorId(null);
    }
  };

  // delete user (hard delete)
  const handleDeleteUser = async (id) => {
    if (!window.confirm(`Delete user #${id}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/admin/users/${id}`, { headers });
      toast.success("User deleted");
      fetchUsers({ page: userPage, size: userRowsPerPage });
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete user");
    }
  };

  // soft delete / restore user
  const setUserDeleted = async (u, isDeleted) => {
    setSavingUserId(u.id);
    try {
      await axios.patch(`${API}/api/admin/users/${u.id}`, { isDeleted }, { headers });
      toast.success(isDeleted ? "User archived" : "User restored");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isDeleted } : x)));
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update user");
    } finally {
      setSavingUserId(null);
    }
  };

  // Toggle vendor Open/Closed
  const toggleVendorOpen = async (v) => {
    const next = !Boolean(v.isOpen);
    setSavingVendorId(v.id);
    try {
      await axios.put(`${API}/api/vendors/${v.id}`, { isOpen: next }, { headers });
      toast.success(`Vendor ${next ? "opened" : "closed"}`);
      setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, isOpen: next } : x)));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update vendor status");
    } finally {
      setSavingVendorId(null);
    }
  };

  // ----- User role editing -----
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
      await axios.patch(`${API}/api/admin/users/${user.id}`, { role: nextRole }, { headers });
      toast.success(`Role updated to ${nextRole}`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
      setPendingRoleByUser((prev) => {
        const copy = { ...prev };
        delete copy[user.id];
        return copy;
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update role");
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
      await axios.put(`${API}/api/vendors/${id}`, { name, location, cuisine, UserId }, { headers });
      toast.success("Vendor updated");
      setVendors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name, location, cuisine, UserId } : v))
      );
      cancelEditVendor();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update vendor");
    } finally {
      setSavingVendorId(null);
    }
  };

  // initial load
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- derived lists (client-side extra filter/search) -----
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

  // ----- CSV exports -----
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

  // ----- pagination handlers -----
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

  // ----- selection helpers (Users) -----
  const userIdsVisible = filteredUsers.map((u) => u.id);
  const allUsersChecked = userIdsVisible.length > 0 && userIdsVisible.every((id) => selectedUserIds.includes(id));
  const someUsersChecked = userIdsVisible.some((id) => selectedUserIds.includes(id));

  const toggleSelectAllUsers = () => {
    setSelectedUserIds(allUsersChecked ? [] : userIdsVisible);
  };
  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ----- selection helpers (Vendors) -----
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

  // ----- bulk actions -----
  const bulkArchiveUsers = async (archive) => {
    if (selectedUserIds.length === 0) return;
    const verb = archive ? "archive" : "restore";
    try {
      const ops = selectedUserIds.map((id) =>
        axios.patch(`${API}/api/admin/users/${id}`, { isDeleted: archive }, { headers })
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
      const ops = selectedUserIds.map((id) => axios.delete(`${API}/api/admin/users/${id}`, { headers }));
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
        axios.put(`${API}/api/vendors/${id}`, { isDeleted: archive }, { headers })
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
      const ops = selectedVendorIds.map((id) => axios.delete(`${API}/api/vendors/${id}`, { headers }));
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
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Users */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Users</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <TextField
                  size="small"
                  label="Search users"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="roleFilter">Role</InputLabel>
                  <Select
                    labelId="roleFilter"
                    label="Role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="user">user</MenuItem>
                    <MenuItem value="vendor">vendor</MenuItem>
                    <MenuItem value="admin">admin</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="userStatus">Status</InputLabel>
                  <Select
                    labelId="userStatus"
                    label="Status"
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportUsersCsv}
                  disabled={usersLoading || filteredUsers.length === 0}
                >
                  Export CSV
                </Button>
                <Tooltip title="Refresh users">
                  <IconButton onClick={() => fetchUsers({ page: userPage, size: userRowsPerPage })}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Bulk actions (Users) */}
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Button
                size="small"
                startIcon={<BlockIcon />}
                onClick={() => bulkArchiveUsers(true)}
                disabled={selectedUserIds.length === 0}
              >
                Archive
              </Button>
              <Button
                size="small"
                startIcon={<RestoreIcon />}
                onClick={() => bulkArchiveUsers(false)}
                disabled={selectedUserIds.length === 0}
              >
                Restore
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={bulkDeleteUsers}
                disabled={selectedUserIds.length === 0}
              >
                Delete
              </Button>
              {selectedUserIds.length > 0 && (
                <Chip size="small" label={`${selectedUserIds.length} selected`} sx={{ ml: 1 }} />
              )}
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
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <CircularProgress size={20} />
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No users found
                      </TableCell>
                    </TableRow>
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
                                  <IconButton
                                    onClick={() => saveUserRole(u)}
                                    disabled={!dirty || saving || archived}
                                    color="primary"
                                  >
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

        {/* Vendors */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Vendors</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <TextField
                  size="small"
                  label="Search vendors"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="vendorStatus">Status</InputLabel>
                  <Select
                    labelId="vendorStatus"
                    label="Status"
                    value={vendorStatusFilter}
                    onChange={(e) => setVendorStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportVendorsCsv}
                  disabled={vendorsLoading || filteredVendors.length === 0}
                >
                  Export CSV
                </Button>
                <Tooltip title="Refresh vendors">
                  <IconButton onClick={() => fetchVendors({ page: vendorPage, size: vendorRowsPerPage })}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Add vendor */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <TextField
                  size="small"
                  label="Name"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                />
                <TextField
                  size="small"
                  label="Location"
                  value={vendorForm.location}
                  onChange={(e) => setVendorForm({ ...vendorForm, location: e.target.value })}
                />
                <TextField
                  size="small"
                  label="Cuisine"
                  value={vendorForm.cuisine}
                  onChange={(e) => setVendorForm({ ...vendorForm, cuisine: e.target.value })}
                />
                <TextField
                  select
                  size="small"
                  label="User"
                  value={vendorForm.UserId}
                  onChange={(e) => setVendorForm({ ...vendorForm, UserId: e.target.value })}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 220 }}
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

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddVendor}
                  disabled={adding}
                >
                  {adding ? "Adding…" : "Add Vendor"}
                </Button>
              </Stack>
            </Paper>

            {/* Bulk actions (Vendors) */}
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Button
                size="small"
                startIcon={<BlockIcon />}
                onClick={() => bulkArchiveVendors(true)}
                disabled={selectedVendorIds.length === 0}
              >
                Archive
              </Button>
              <Button
                size="small"
                startIcon={<RestoreIcon />}
                onClick={() => bulkArchiveVendors(false)}
                disabled={selectedVendorIds.length === 0}
              >
                Restore
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={bulkDeleteVendors}
                disabled={selectedVendorIds.length === 0}
              >
                Delete
              </Button>
              {selectedVendorIds.length > 0 && (
                <Chip size="small" label={`${selectedVendorIds.length} selected`} sx={{ ml: 1 }} />
              )}
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
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendorsLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <CircularProgress size={20} />
                      </TableCell>
                    </TableRow>
                  ) : filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No vendors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((v) => {
                      const isEditing = editingVendorId === v.id;
                      const savingRow = savingVendorId === v.id;
                      const archived = Boolean(v.isDeleted);
                      const checked = selectedVendorIds.includes(v.id);
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
                                onChange={(e) =>
                                  setEditVendorForm((prev) => ({ ...prev, location: e.target.value }))
                                }
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
                                onChange={(e) =>
                                  setEditVendorForm((prev) => ({ ...prev, cuisine: e.target.value }))
                                }
                              />
                            ) : (
                              v.cuisine
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                select
                                size="small"
                                value={editVendorForm.UserId ?? ""}
                                onChange={(e) =>
                                  setEditVendorForm((prev) => ({ ...prev, UserId: e.target.value }))
                                }
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
                              <Switch
                                checked={Boolean(v.isOpen)}
                                onChange={() => toggleVendorOpen(v)}
                                disabled={savingRow || isEditing || archived}
                              />
                              <Chip
                                size="small"
                                label={Boolean(v.isOpen) ? "Open" : "Closed"}
                                color={Boolean(v.isOpen) ? "success" : "default"}
                                variant="outlined"
                              />
                            </Stack>
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
                                    <IconButton onClick={cancelEditVendor}>
                                      <CloseIcon />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              ) : archived ? (
                                <Tooltip title="Restore vendor">
                                  <span>
                                    <IconButton
                                      color="primary"
                                      onClick={() => setVendorDeleted(v, false)}
                                      disabled={savingRow}
                                    >
                                      <RestoreIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <>
                                  <Tooltip title="Edit vendor">
                                    <IconButton onClick={() => startEditVendor(v)}>
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Archive vendor (soft delete)">
                                    <span>
                                      <IconButton
                                        color="warning"
                                        onClick={() => setVendorDeleted(v, true)}
                                        disabled={savingRow}
                                      >
                                        <BlockIcon />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Delete vendor (hard delete)">
                                    <span>
                                      <IconButton
                                        color="error"
                                        onClick={() => handleDeleteVendor(v.id)}
                                        disabled={savingRow}
                                      >
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
          }}
        >
          Refresh All
        </Button>
      </Stack>
    </Box>
  );
}