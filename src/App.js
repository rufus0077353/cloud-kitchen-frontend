
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

// Unified Payouts Page
import PayoutsDashboard from "./pages/PayoutsDashboard";

// Components
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import ConnectionBar from "./components/ConnectionBar";
import { CartProvider } from "./context/CartContext";
import { NotificationsProvider } from "./context/NotificationsContext";

// Static public pages
import Contact from "./pages/static/Contact";
import Terms from "./pages/static/Terms";
import Privacy from "./pages/static/Privacy";
import Refund from "./pages/static/Refund";
import BrowseVendorsMap from "./pages/BrowseVendorsMap";
import ForgotPassword from "./pages/ForgotPassword";

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
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Public Legal Pages */}
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund" element={<Refund />} />

              {/* ---------- USER ---------- */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <UserDashboard />
                  </PrivateRoute>
                }
              />
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
              <Route
                path="/vendors"
                element={
                  <PrivateRoute>
                    <BrowseVendors />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendors/:vendorId"
                element={
                  <PrivateRoute>
                    <UserVendorMenu />
                  </PrivateRoute>
                }
              />
              <Route
                path="/checkout"
                element={
                  <PrivateRoute>
                    <Checkout />
                  </PrivateRoute>
                }
              />
              <Route
                path="/track/:id"
                element={
                  <PrivateRoute>
                    <TrackOrder />
                  </PrivateRoute>
                }
              />
              <Route
                path="/browse-map"
                element={
                  <PrivateRoute>
                    <BrowseVendorsMap />
                  </PrivateRoute>
                }
              />  

              {/* ---------- VENDOR ---------- */}
              <Route
                path="/vendor/dashboard"
                element={
                  <PrivateRoute role="vendor">
                    <VendorDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor/menu"
                element={
                  <PrivateRoute role="vendor">
                    <VendorMenu />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor/orders"
                element={
                  <PrivateRoute role="vendor">
                    <VendorOrders />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor/payouts"
                element={
                  <PrivateRoute role="vendor">
                    <PayoutsDashboard role="vendor" />
                  </PrivateRoute>
                }
              />

              {/* ---------- ADMIN ---------- */}
              <Route
                path="/admin/dashboard"
                element={
                  <PrivateRoute role="admin">
                    <AdminDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <PrivateRoute role="admin">
                    <AdminUsers />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/users/edit/:id"
                element={
                  <PrivateRoute role="admin">
                    <EditUser />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/vendors"
                element={
                  <PrivateRoute role="admin">
                    <AdminVendors />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/menu-items"
                element={
                  <PrivateRoute role="admin">
                    <AdminMenuItems />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <PrivateRoute role="admin">
                    <AdminOrders />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/payouts"
                element={
                  <PrivateRoute role="admin">
                    <PayoutsDashboard role="admin" />
                  </PrivateRoute>
                }
              />

              {/* ---------- FALLBACK ---------- */}
              <Route path="/not-authorized" element={<NotAuthorized />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>

            <ToastContainer position="top-right" autoClose={5000} />
          </Container>
        </Router>
      </NotificationsProvider>
    </CartProvider>
  );
}

export default App;