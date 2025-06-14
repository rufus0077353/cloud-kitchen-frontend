
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Snackbar,
  Alert
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: "", email: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`http://localhost:5000/api/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        setSnackbar({ open: true, message: "Failed to load user", severity: "error" });
        setLoading(false);
      });
  }, [id, token]);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(user),
      });

      if (res.ok) {
        setSnackbar({ open: true, message: "User updated successfully", severity: "success" });
        setTimeout(() => navigate("/admin/users"), 1500);
      } else {
        const errorData = await res.json();
        setSnackbar({ open: true, message: errorData.message, severity: "error" });
      }
    } catch (err) {
      setSnackbar({ open: true, message: "Error updating user", severity: "error" });
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Container maxWidth="sm">
      <Paper sx={{ padding: 4, marginTop: 4 }}>
        <Typography variant="h5" gutterBottom>
          Edit User
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            margin="normal"
            label="Name"
            name="name"
            value={user.name}
            onChange={handleChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            name="email"
            value={user.email}
            onChange={handleChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Role"
            name="role"
            value={user.role}
            onChange={handleChange}
            required
          />
          <Button
            variant="contained"
            color="primary"
            type="submit"
            sx={{ marginTop: 2 }}
          >
            Update User
          </Button>
        </form>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default EditUser;