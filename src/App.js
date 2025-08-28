
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CssBaseline, Container } from "@mui/material";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import EditUser from "./pages/EditUser";
import AdminVendors from "./pages/AdminVendors";
import AdminMenuItems from "./pages/AdminMenuItems";
import UserOrders from "./pages/UserOrders";
import CreateOrder from "./pages/CreateOrder";
import OrderSuccess from "./pages/OrderSuccess";
import OrderForm from "./pages/OrderForm";
import OrderHistory from "./pages/OrderHistory";
import Invoice from "./pages/Invoice";
import VendorOrders from "./pages/VendorOrders";
import VendorMenu from "./pages/VendorMenu";
import AdminOrders from "./pages/AdminOrders";

// Components
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import ConnectionBar from "./components/ConnectionBar";
import ErrorBoundary from "./ErrorBoundary"; // Custom error boundary

function App() {
  return (
    <Router>
      <CssBaseline />
      <Container maxWidth="lg">
        <Navbar />
        <ConnectionBar />
        <Routes>
          {/* Auth */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* User Dashboard */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <UserDashboard />
              </PrivateRoute>
            }
          />

          {/* Vendor Dashboard */}
          <Route
            path="/vendor/dashboard"
            element={
              <PrivateRoute role="vendor">
                <VendorDashboard />
              </PrivateRoute>
            }
          />

          {/* Vendor Menu (gated) */}
          <Route
            path="/vendor/menu"
            element={
              <PrivateRoute role="vendor">
                <VendorMenu />
              </PrivateRoute>
            }
          />

          {/* Vendor Orders (fixed path; previously duplicated /orders) */}
          <Route
            path="/vendor/orders"
            element={
              <PrivateRoute role="vendor">
                <VendorOrders />
              </PrivateRoute>
            }
          />

          {/* Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </PrivateRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/users"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users/edit/:id"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <EditUser />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/vendors"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <AdminVendors />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/menu-items"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <AdminMenuItems />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <PrivateRoute role="admin">
                <AdminRoute>
                  <AdminOrders />
                </AdminRoute>
              </PrivateRoute>
            }
          />

          {/* Orders (user-facing) */}
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <UserOrders />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-order"
            element={
              <PrivateRoute>
                <CreateOrder />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/success"
            element={
              <PrivateRoute>
                <OrderSuccess />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/form"
            element={
              <PrivateRoute>
                <OrderForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/history"
            element={
              <PrivateRoute>
                <OrderHistory />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/invoice/:id"
            element={
              <PrivateRoute>
                <Invoice />
              </PrivateRoute>
            }
          />
        </Routes>

        <ToastContainer position="top-right" autoClose={5000} />
      </Container>
    </Router>
  );
}

export default App;