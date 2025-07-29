
import React, { useState, useEffect } from "react";
import {
  AppBar, Toolbar, Typography, Button, Container, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";

const API = process.env.REACT_APP_API_BASE_URL;


const VendorDashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", description: "" });

  

  const fetchMenu = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/api/menu-items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMenuItems(data);
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
  try {
    const token = localStorage.getItem("token");
    const method = editingItem ? "PUT" : "POST";
    const url = editingItem
      ? `${API}/api/menu-items/${editingItem.id}`
      : `${API}/api/menu-items`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editingItem ? "Menu item updated!" : "item added!");
      setForm({ name: "", price: "", description: "" });
      setEditingItem(null);
      fetchMenu();
    } else {
      toast.error("Failed to save item");
    }
  } catch (err) {
    toast.error("Server error");
  }
};

  const handleEdit = (item) => {
    setForm({ name: item.name, price: item.price, description: item.description });
    setEditingItem(item);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/menu-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Item deleted!");
        fetchMenu();
      } else {
        toast.error("Failed to delete");
      }
    } catch (err) {
      toast.error("server error");
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

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
              {menuItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>₹{item.price}</TableCell>
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
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </>
  );
};

export default VendorDashboard;