
// src/pages/AdminDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Grid, Paper, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack, Divider, Chip, Tooltip, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, Switch, LinearProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import axios from "axios";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_BASE_URL || "";

// ---- helpers ----
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const fmtMoney = (n) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0))}`;

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

  // vendors
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingVendorId, setSavingVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    location: "",
    cuisine: "",
    UserId: ""
  });

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
    } catch (e) {
      toast.error("Failed to load overview");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/users`, { headers });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Failed to load users");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchVendors = async () => {
    setVendorsLoading(true);
    try {
      const res = await axios.get(`${API}/api/vendors`, { headers });
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Failed to load vendors");
      setVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  };

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
      fetchVendors();
      fetchStats();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to create vendor";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm(`Delete vendor #${id}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/vendors/${id}`, { headers });
      toast.success("Vendor deleted");
      fetchVendors();
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete vendor");
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm(`Delete user #${id}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/admin/users/${id}`, { headers });
      toast.success("User deleted");
      fetchUsers();
      fetchStats();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete user");
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

  // initial load
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- derived lists (client-side filter/search) -----
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return (users || [])
      .filter((u) => (roleFilter === "all" ? true : (u.role || "").toLowerCase() === roleFilter))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          String(u.id).includes(q)
        );
      });
  }, [users, userSearch, roleFilter]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return (vendors || []).filter((v) => {
      if (!q) return true;
      return (
        (v.name || "").toLowerCase().includes(q) ||
        (v.location || "").toLowerCase().includes(q) ||
        (v.cuisine || "").toLowerCase().includes(q) ||
        String(v.id).includes(q) ||
        String(v.UserId || "").includes(q)
      );
    });
  }, [vendors, vendorSearch]);

  // ----- CSV exports -----
  const exportUsersCsv = () => {
    const headers = ["ID", "Name", "Email", "Role", "Created At"];
    const rows = filteredUsers.map((u) =>
      [u.id, safeCsv(u.name), safeCsv(u.email), u.role, u.createdAt || ""].join(",")
    );
    downloadCsv("admin-users", headers, rows);
  };

  const exportVendorsCsv = () => {
    const headers = ["ID", "Name", "Location", "Cuisine", "UserId", "Open", "Created At"];
    const rows = filteredVendors.map((v) =>
      [v.id, safeCsv(v.name), safeCsv(v.location), safeCsv(v.cuisine), v.UserId, v.isOpen ? "Yes" : "No", v.createdAt || ""].join(",")
    );
    downloadCsv("admin-vendors", headers, rows);
  };

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh all">
            <IconButton onClick={() => { fetchStats(); fetchUsers(); fetchVendors(); }}>
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Users</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label="Search users"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
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
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportUsersCsv} disabled={usersLoading || filteredUsers.length === 0}>
                  Export CSV
                </Button>
                <Tooltip title="Refresh users">
                  <IconButton onClick={fetchUsers}><RefreshIcon /></IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersLoading ? (
                    <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={20} /></TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center">No users found</TableCell></TableRow>
                  ) : filteredUsers.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell><Chip size="small" label={u.role || "-"} /></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete user">
                          <span>
                            <IconButton color="error" onClick={() => handleDeleteUser(u.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Vendors */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 2, flexWrap: "wrap" }}>
              <Typography variant="h5">Vendors</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label="Search vendors"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                />
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportVendorsCsv} disabled={vendorsLoading || filteredVendors.length === 0}>
                  Export CSV
                </Button>
                <Tooltip title="Refresh vendors">
                  <IconButton onClick={fetchVendors}><RefreshIcon /></IconButton>
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

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Cuisine</TableCell>
                    <TableCell>UserId</TableCell>
                    <TableCell>Open</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendorsLoading ? (
                    <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={20} /></TableCell></TableRow>
                  ) : filteredVendors.length === 0 ? (
                    <TableRow><TableCell colSpan={7} align="center">No vendors found</TableCell></TableRow>
                  ) : filteredVendors.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell>{v.id}</TableCell>
                      <TableCell>{v.name}</TableCell>
                      <TableCell>{v.location}</TableCell>
                      <TableCell>{v.cuisine}</TableCell>
                      <TableCell>{v.UserId}</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Switch
                            checked={Boolean(v.isOpen)}
                            onChange={() => toggleVendorOpen(v)}
                            disabled={savingVendorId === v.id}
                          />
                          <Chip
                            size="small"
                            label={Boolean(v.isOpen) ? "Open" : "Closed"}
                            color={Boolean(v.isOpen) ? "success" : "default"}
                            variant="outlined"
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete vendor">
                          <span>
                            <IconButton color="error" onClick={() => handleDeleteVendor(v.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchStats(); fetchUsers(); fetchVendors(); }}>
          Refresh All
        </Button>
      </Stack>
    </Box>
  );
}
