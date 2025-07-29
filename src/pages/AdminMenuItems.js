
import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  AppBar,
  Toolbar,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";
import { toast } from "react-toastify";

const API = process.env.REACT_APP_API_BASE_URL;

const AdminMenuItems = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    VendorId: "",
  });

  const token = localStorage.getItem("token");
  

  const fetchMenuItems = async () => {
    const res = await fetch(`${API}/api/menu-items`);
    const data = await res.json();
    setMenuItems(data);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleOpen = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData(item);
    } else {
      setFormData({ name: "", price: "", description: "", VendorId: "" });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async () => {
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
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      handleClose();
      fetchMenuItems();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    await fetch(`${API}/api/menu-items/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    fetchMenuItems();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin - Menu Items
          </Typography>
          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container>
        <Typography variant="h4" gutterBottom sx={{ mt: 4 }}>
          Manage Menu Items
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={{ mb: 2 }}
        >
          Add Menu Item
        </Button>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Vendor ID</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {menuItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>₹{item.price}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.VendorId}</TableCell>
                <TableCell>
                  <Button onClick={() => handleOpen(item)}>Edit</Button>
                  <Button color="error" onClick={() => handleDelete(item.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Container>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {editingItem ? "Edit Menu Item" : "Add Menu Item"}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="dense"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            label="Price"
            type="number"
            fullWidth
            margin="dense"
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: parseFloat(e.target.value) })
            }
          />
          <TextField
            label="Description"
            fullWidth
            margin="dense"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
          <TextField
            label="Vendor ID"
            type="number"
            fullWidth
            margin="dense"
            value={formData.VendorId}
            onChange={(e) =>
              setFormData({ ...formData, VendorId: parseInt(e.target.value) })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            {editingItem ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminMenuItems;