
// src/App.js
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
import UserVendorMenu from "./pages/UserVendorMenu";
import BrowseVendors from "./pages/BrowseVendors";
import Checkout from "./pages/Checkout";
import NotAuthorized from "./pages/NotAuthorized";
import TrackOrder from "./pages/TrackOrder";
import PayoutsDashboard from "./pages/PayoutsDashboard";

// Components
import Navbar from "./components/Navbar";
import ConnectionBar from "./components/ConnectionBar";
import { CartProvider } from "./context/CartContext";
import { NotificationsProvider } from "./context/NotificationsContext";

// Public static pages
import Contact from "./pages/static/Contact";
import Terms from "./pages/static/Terms";
import Privacy from "./pages/static/Privacy";
import Refund from "./pages/static/Refund";

// --- Simple auth helper ---
const getUserRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return (user?.role || "").toLowerCase();
  } catch {
    return "";
  }
};
const isLoggedIn = () => !!localStorage.getItem("token");

// --- Basic wrapper for role-based access ---
function ProtectedRoute({ roles = [], children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const role = getUserRole();
  if (roles.length && !roles.includes(role)) {
    return <Navigate to="/not-authorized" replace />;
  }
  return children;
}

function App() {
  return (
    <CartProvider>
      <NotificationsProvider>
        <Router>
          <CssBaseline />
          <Container maxWidth="lg">
            <Navbar />
            <ConnectionBar />

            <Routes>
              {/* ---------- PUBLIC ---------- */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund" element={<Refund />} />

              {/* ---------- USER ---------- */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <UserOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-order"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <CreateOrder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/success"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <OrderSuccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/form"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <OrderForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/history"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <OrderHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/invoice/:id"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <Invoice />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendors"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <BrowseVendors />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendors/:vendorId"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <UserVendorMenu />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/track/:id"
                element={
                  <ProtectedRoute roles={["user"]}>
                    <TrackOrder />
                  </ProtectedRoute>
                }
              />

              {/* ---------- VENDOR ---------- */}
              <Route
                path="/vendor/dashboard"
                element={
                  <ProtectedRoute roles={["vendor"]}>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/menu"
                element={
                  <ProtectedRoute roles={["vendor"]}>
                    <VendorMenu />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/orders"
                element={
                  <ProtectedRoute roles={["vendor"]}>
                    <VendorOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/payouts"
                element={
                  <ProtectedRoute roles={["vendor"]}>
                    <PayoutsDashboard role="vendor" />
                  </ProtectedRoute>
                }
              />

              {/* ---------- ADMIN ---------- */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users/edit/:id"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <EditUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/vendors"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminVendors />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/menu-items"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminMenuItems />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AdminOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payouts"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <PayoutsDashboard role="admin" />
                  </ProtectedRoute>
                }
              />

              {/* ---------- FALLBACK ---------- */}
              <Route path="/not-authorized" element={<NotAuthorized />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>

            <ToastContainer position="top-right" autoClose={4000} />
          </Container>
        </Router>
      </NotificationsProvider>
    </CartProvider>
  );
}

export default App;