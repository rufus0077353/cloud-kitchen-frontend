
import React, { useEffect, useState, useCallback } from "react";
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
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL;

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "user" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /** Fetch all users */
  const fetchUsers = useCallback(async () => {
    if (!token) return navigate("/login");
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `Failed to load users (${res.status})`);
      }

      // Handle both {items:[...]} or direct array
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setUsers(list);
    } catch (err) {
      console.error("Error fetching users:", err);
      setErr(err.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /** Add or update a user */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId
      ? `${API}/api/admin/users/${editingId}`
      : `${API}/api/auth/register`;
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
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.message || "Operation failed");

      toast.success(editingId ? "User updated" : "User created");
      setFormData({ name: "", email: "", password: "", role: "user" });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.message || "Server error while saving user");
    }
  };

  /** Edit user */
  const handleEdit = (user) => {
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
    });
    setEditingId(user.id);
  };

  /** Delete user */
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User deleted");
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "Failed to delete user");
      }
    } catch (err) {
      toast.error("Server error while deleting user");
    }
  };

  /** Promote to vendor */
  const promoteUser = async (userId) => {
    try {
      const res = await fetch(`${API}/api/admin/promote/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("User promoted to vendor successfully!");
        fetchUsers();
      } else {
        toast.error(data?.message || "Promotion failed");
      }
    } catch (err) {
      toast.error("Server error during promotion");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>
          Admin User Management
        </Typography>
        <Button variant="outlined" color="error" onClick={handleLogout}>
          Logout
        </Button>
      </Stack>

      {/* FORM */}
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          {editingId ? "Edit User" : "Add New User"}
        </Typography>

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
            type="email"
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
            {editingId ? "Update User" : "Create User"}
          </Button>
        </form>
      </Paper>

      {/* USERS TABLE */}
      <Typography variant="h6" gutterBottom>
        All Users
      </Typography>

      {loading ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress />
        </Paper>
      ) : err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : (
        <Table component={Paper}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell align="right">
                  {user.role !== "vendor" && (
                    <Button
                      size="small"
                      onClick={() => promoteUser(user.id)}
                      sx={{ mr: 1 }}
                    >
                      Promote
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => handleEdit(user)}
                    sx={{ mr: 1 }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(user.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}