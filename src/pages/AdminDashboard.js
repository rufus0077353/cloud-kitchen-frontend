import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";

const API = process.env.REACT_APP_API_BASE_URL;

import {
  Box, Typography, Grid, Paper, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorForm, setVendorForm] = useState({ name: "", location: "", cuisine: "" , UserId: ""});


  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchStats = async () => {
    const res = await axios.get("${API}/api/admin/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setStats(res.data);
  };

  const fetchUsers = async () => {
    const res = await axios.get("${API}/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers(res.data);
  };

  const fetchVendors = async () => {
    const res = await axios.get("${API}/api/vendors", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setVendors(res.data);
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name || !vendorForm.location || !vendorForm.cuisine || !vendorForm.UserId) return;
    await axios.post("${process.env.REACT_APP/API_BASE_URL}/api/vendors", vendorForm, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setVendorForm({ name: "", location: "", cuisine: "", UserId: "" });
    fetchVendors();
  };

  const handleDeleteVendor = async (id) => {
    await axios.delete(`${process.env.REACT_APP/API_BASE_URL}/api/vendors/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchVendors();
  };

  const handleDeleteUser = async (id) => {
    await axios.delete(`${process.env.REACT_APP/API_BASE_URL}/api/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchVendors();
  }, []);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Navbar role="admin"/>
        <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
        
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={3}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: "center" }}>
            <Typography variant="h6">Total Users</Typography>
            <Typography variant="h5">{stats.totalUsers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: "center" }}>
            <Typography variant="h6">Total Vendors</Typography>
            <Typography variant="h5">{stats.totalVendors}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: "center" }}>
            <Typography variant="h6">Total Orders</Typography>
            <Typography variant="h5">{stats.totalOrders}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={3} sx={{ padding: 2, textAlign: "center" }}>
            <Typography variant="h6">Total Revenue</Typography>
            <Typography variant="h5">₹{stats.totalRevenue}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box mt={4}>
        <Typography variant="h5">Users</Typography>
        <TableContainer component={Paper} sx={{ marginTop: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Button color="error" onClick={() => handleDeleteUser(user.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box mt={4}>
        <Typography variant="h5">Vendors</Typography>
        <Box mt={2} mb={2} display="flex" gap={2}>
          <TextField
            label="Name"
            value={vendorForm.name}
            onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
          />
          <TextField
            label="Location"
            value={vendorForm.location}
            onChange={(e) => setVendorForm({ ...vendorForm, location: e.target.value })}
          />
          <TextField
            label="Cuisine"
            value={vendorForm.cuisine}
            onChange={(e) => setVendorForm({ ...vendorForm, cuisine: e.target.value })}
          />
          <Button variant="contained" onClick={handleAddVendor}>Add Vendor</Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Cuisine</TableCell>
                <TableCell>UserId</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>{vendor.id}</TableCell>
                  <TableCell>{vendor.name}</TableCell>
                  <TableCell>{vendor.location}</TableCell>
                  <TableCell>{vendor.cuisine}</TableCell>
                  <TableCell>{vendor.UserId}</TableCell>
                  <TableCell>
                    <Button color="error" onClick={() => handleDeleteVendor(vendor.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default AdminDashboard;