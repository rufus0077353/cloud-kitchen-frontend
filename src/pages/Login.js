
import React, { useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  Link
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL;

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  

const handleLogin = async (e) => {
  e.preventDefault();
  setError("");

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      toast.success("Login successful");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // ✅ If user is vendor, store vendorId for dashboard and menu operations
      if (data.user.role === "vendor" && data.vendor?.id) {
        localStorage.setItem("vendorId", data.vendor.id);
      }

      // ✅ Navigate based on role
      if (data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else if (data.user.role === "vendor") {
        navigate("/vendor/dashboard");
      } else {
        navigate("/dashboard");
      }

    } else {
      toast.error(data.message || "Login failed");
      setError(data.message || "Login failed");
    }

  } catch (err) {
    console.error("Login error:", err);
    toast.error("Server error. Please try again later");
    setError("Server error");
  }
};
  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Login
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="Email"
            margin="normal"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            fullWidth
            label="Password"
            margin="normal"
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </form>

        <Box sx={{ mt: 2, textAlign: "center" }}>
          <Typography variant="body2">
            Don't have an account?{" "}
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate("/register")}
            >
              Register Now
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;