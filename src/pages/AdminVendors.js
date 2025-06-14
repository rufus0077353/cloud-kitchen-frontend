
import React, { useEffect, useState } from "react";
import {
  Container, Typography, Grid, Paper, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

const AdminVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalVendors: 0, totalRevenue: 0 });
  const [newVendor, setNewVendor] = useState({ name: "",location: "",cuisine: "",UserId: "" });

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchOverview();
    fetchVendors();
  }, []);

  const fetchOverview = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/vendors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVendors(data);
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendor.name ||!newVendor.location ||!newVendor.cuisine ||!newVendor.UserId ) return;

    try {
      const res = await fetch("http://localhost:5000/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newVendor,
          UserId: parseInt(newVendor.UserId)
        }),
      });

      if (res.ok) {
        setNewVendor({ name: "",location: "",  cuisine: "", UserId: "" });
        fetchVendors();
      } else {
        const data = await res.json();
        console.error("Failed to add Vendor", data.message);
        alert(data.message);
      }
    } catch (err) {
      console.error("Error adding vendor:", err);
    }
  };

  const handleDeleteVendor = async (id) => {
    try {
      await fetch('http://localhost:5000/api/admin/vendors/${id}', {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchVendors();
    } catch (err) {
      console.error("Error deleting vendor:", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <Container>
      <Grid container justifyContent="space-between" alignItems="center" mt={3}>
        <Typography variant="h4">Admin Vendor Management</Typography>
        <Button variant="contained" color="error" onClick={handleLogout} startIcon={<LogoutIcon />}>
          Logout
        </Button>
      </Grid>

      <Grid container spacing={3} mt={3}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography>Total Users: {stats.totalUsers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography>Total Vendors: {stats.totalVendors}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography>Total Revenue: ₹{stats.totalRevenue}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6">Add New Vendor</Typography>
        <Grid container spacing={2} mt={1}>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Vendor Name"
              fullWidth
              value={newVendor.name}
              onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Location"
              fullWidth
              value={newVendor.location}
              onChange={(e) => setNewVendor({ ...newVendor, location: e.target.value })}
            />

          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Cuisine"
              fullWidth
              value={newVendor.cuisine}
              onChange={(e) => setNewVendor({ ...newVendor, cuisine: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField 
              label="UserId"
              fullWidth
              value={newVendor.UserId}
              onChange={(e) => setNewVendor({ ...newVendor, UserId: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="contained" fullWidth onClick={handleAddVendor}>
              Add
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ mt: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>location</TableCell>
              <TableCell>Cuisine</TableCell>
              <TableCell>UserId</TableCell>
              <TableCell>Action</TableCell>
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
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleDeleteVendor(vendor.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No vendors found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default AdminVendors;