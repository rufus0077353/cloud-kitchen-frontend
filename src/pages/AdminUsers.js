import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "user" });
  const [editingId, setEditingId] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId
      ? `http://localhost:5000/api/admin/users/${editingId}`
      : "http://localhost:5000/api/admin/register";

    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({ name: "", email: "", password: "", role: "user" });
        setEditingId(null);
        fetchUsers();
      } else {
        const errorData = await res.json();
        alert(errorData.message);
      }
    } catch (err) {
      console.error("Error submitting user:", err);
    }
  };

  const handleEdit = (user) => {
    setFormData({ name: user.name, email: user.email, password: "", role: user.role });
    setEditingId(user.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await fetch(`http://localhost:5000/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const promoteUser = async (userId) => {
    try{
        const token = localStorage.getItem("token");
        const res = await fetch('http://localhost:5000/api/admin/promote/${userId}', {
            method: "PUT",
            headers: {
                Authorization: 'Bearer ${token}',
            },
        });
        const data = await res.json();
        if (res.ok) {
            alert("User promoted to vendor successfully!");
            fetchUsers();
        } else {
            alert(data.message || "Promotion failed");
        }
    }   catch ( err) {
        alert("Server error during promotion");
    }
         
    
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin User Management
      </Typography>

      <Button variant="outlined" onClick={handleLogout} sx={{ mb: 2 }}>
        Logout
      </Button>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6">{editingId ? "Edit User" : "Add New User"}</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            name="name"
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <TextField
            name="email"
            label="Email"
            fullWidth
            margin="normal"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <TextField
            name="password"
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={formData.password}
            onChange={handleChange}
            required={!editingId}
          />
          <TextField
            name="role"
            label="Role"
            fullWidth
            margin="normal"
            value={formData.role}
            onChange={handleChange}
            required
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            {editingId ? "Update" : "Create"}
          </Button>
        </form>
      </Paper>

      <Typography variant="h6" gutterBottom>
        All Users
      </Typography>
      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                {user.role !== "vendor" && (
                    <Button onClick={() => promoteUser(user.id)}>Promote to Vendor</Button>
                )}
                <Button onClick={() => handleEdit(user)}>Edit</Button>
                <Button onClick={() => handleDelete(user.id)} color="error">
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
};

export default AdminUsers;