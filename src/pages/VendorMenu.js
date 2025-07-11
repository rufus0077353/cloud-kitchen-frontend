
import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Delete, Edit, Logout } from "@mui/icons-material";




const VendorMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", description: "" });

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  

  const fetchMenuItems = async () => {
  try {
    const res = await fetch(`${REACT_APP_API_BASE_URL}/api/vendors/${user.id}/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    // Fix: Make sure it's an array
    if (Array.isArray(data)) {
      setMenuItems(data);
    } else {
      console.error("Expected array but got:", data);
      setMenuItems([]);
    }
  } catch (err) {
    console.error("Fetch menu failed:", err);
    setMenuItems([]);
  }
};

  const handleOpen = (item = null) => {
    setEditingItem(item);
    setFormData(item ? { ...item } : { name: "", price: "", description: "" });
    setOpen(true);
  };

  const handleClose = () => {
    setEditingItem(null);
    setFormData({ name: "", price: "", description: "" });
    setOpen(false);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    const url = editingItem
      ? `${REACT_APP_API_BASE_URL}/api/menu-items/${editingItem.id}`
      : `${REACT_APP_API_BASE_URL}/api/menu-items`;

    const method = editingItem ? "PUT" : "POST";

    const body = {
      ...formData,
      VendorId: user.id,
      price: parseFloat(formData.price),
    };

    try {
      await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      await fetchMenuItems();
      handleClose();
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${REACT_APP_API_BASE_URL}/api/menu-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchMenuItems();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    fetchMenuItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" my={3}>
        <Typography variant="h5">🍽️ Vendor Menu</Typography>
        <IconButton onClick={handleLogout} color="error">
          <Logout />
        </IconButton>
      </Box>

      <Button variant="contained" color="primary" onClick={() => handleOpen()}>
        ➕ Add Menu Item
      </Button>

      <Table sx={{ mt: 3 }}>
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
                <IconButton onClick={() => handleOpen(item)} color="primary">
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

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Name"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Price"
            name="price"
            type="number"
            fullWidth
            value={formData.price}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Description"
            name="description"
            fullWidth
            value={formData.description}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingItem ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VendorMenu;