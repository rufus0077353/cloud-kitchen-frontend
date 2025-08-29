
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
  Switch,
} from "@mui/material";
import { Delete, Edit, Logout } from "@mui/icons-material";
import { toast } from "react-toastify";
import api from "../utils/api";

const VendorMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", price: "", description: "" });

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchMenuItems = async () => {
    try {
      const { data } = await api.get("/menu-items/mine");
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load menu");
      setMenuItems([]);
    }
  };

  const handleOpen = (item = null) => {
    setEditingItem(item);
    setFormData(item ? {
      name: item.name ?? "",
      price: item.price ?? "",
      description: item.description ?? ""
    } : { name: "", price: "", description: "" });
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
    const priceNum = formData.price === "" ? null : Number(formData.price);
    if (!formData.name || priceNum == null || Number.isNaN(priceNum)) {
      toast.error("Name and valid price are required");
      return;
    }
    const body = {
      name: formData.name,
      price: priceNum,
      description: formData.description,
    };

    try {
      if (editingItem) {
        await api.put(`/menu-items/${editingItem.id}`, body);
        toast.success("Menu item updated!");
      } else {
        await api.post(`/menu-items`, body);
        toast.success("Item added!");
      }
      await fetchMenuItems();
      handleClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit item");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await api.delete(`/menu-items/${id}`);
      toast.success("Item deleted!");
      await fetchMenuItems();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete item");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (user?.role !== "vendor") {
      toast.error("Vendors only");
      window.location.replace("/");
      return;
    }
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
            <TableCell>Available</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {menuItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.price != null ? `₹${item.price}` : "-"}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>
                <Switch
                  checked={!!item.isAvailable}
                  onChange={async (e) => {
                    try {
                      await api.put(`/menu-items/${item.id}`, { isAvailable: e.target.checked });
                      setMenuItems((prev) =>
                        prev.map((m) => (m.id === item.id ? { ...m, isAvailable: e.target.checked } : m))
                      );
                      toast.success("Availability updated");
                    } catch (err) {
                      toast.error("Failed to update availability");
                    }
                  }}
                />
              </TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(item)} color="primary" aria-label="edit">
                  <Edit />
                </IconButton>
                <IconButton onClick={() => handleDelete(item.id)} color="error" aria-label="delete">
                  <Delete />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {menuItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center">No items yet</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
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
            multiline
            minRows={2}
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