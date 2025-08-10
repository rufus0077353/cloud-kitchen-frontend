
import React, { useState, useEffect } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const VendorDashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", description: "" });

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || `Failed (${res.status})`;
        toast.error(`Failed to load menu: ${msg}`);
        setMenuItems([]);
        return;
      }
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch menu failed:", err);
      toast.error("Failed to load menu");
      setMenuItems([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logout successful");
    window.location.href = "/login";
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || user.role !== "vendor") {
      toast.error("Vendors only");
      return;
    }

    const method = editingItem ? "PUT" : "POST";
    const url = editingItem
      ? `${API_BASE}/api/menu-items/${editingItem.id}`
      : `${API_BASE}/api/menu-items`;

    const body = {
      name: form.name,
      price: form.price === "" ? null : parseFloat(form.price),
      description: form.description,
      // Do NOT send VendorId; backend derives from token
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to save item");
        return;
      }

      toast.success(editingItem ? "Item updated" : "Item added");
      setForm({ name: "", price: "", description: "" });
      setEditingItem(null);
      fetchMenu();
    } catch (err) {
      console.error("Menu item save error:", err);
      toast.error("Server error occurred");
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name ?? "",
      price: item.price ?? "",
      description: item.description ?? "",
    });
    setEditingItem(item);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/menu-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Item deleted!");
        fetchMenu();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Server error");
    }
  };

  useEffect(() => {
    fetchMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = Array.isArray(menuItems) ? menuItems : [];

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Vendor Dashboard
          </Typography>
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6">
            {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Price"
              name="price"
              type="number"
              value={form.price}
              onChange={handleChange}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" color="primary">
              {editingItem ? "Update" : "Add"}
            </Button>
          </form>
        </Paper>

        <Typography variant="h6" sx={{ mb: 2 }}>Your Menu</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.price !== null && item.price !== undefined ? `₹${item.price}` : "-"}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(item)} color="primary">
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(item.id)} color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">No items yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </>
  );
};

export default VendorDashboard;