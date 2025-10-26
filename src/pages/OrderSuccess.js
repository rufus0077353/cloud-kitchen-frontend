
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams, Link as RouterLink } from "react-router-dom";
import {
 Box,
 Typography,
 Button,
 Paper,
 List,
 ListItem,
 ListItemText,
 Divider,
 Stack,
 Chip,
 Alert,
 CircularProgress,
} from "@mui/material";

const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
const rupee = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function OrderSuccess() {
 const navigate = useNavigate();
 const location = useLocation();
 const [searchParams] = useSearchParams();

 // Prefer the full order from location.state, but also accept just an id
 const initialOrder = location.state?.order || null;
 const stateOrderId = location.state?.orderId || location.state?.order?.id || null;
 const queryOrderId = searchParams.get("orderId");
 const fallbackOrderId = stateOrderId || (queryOrderId ? Number(queryOrderId) : null);

 const token = localStorage.getItem("token");
 const headers = useMemo(
   () => (token ? { Authorization: `Bearer ${token}` } : {}),
   [token]
 );

 const [order, setOrder] = useState(initialOrder);
 const [loading, setLoading] = useState(!initialOrder && !!fallbackOrderId);
 const [err, setErr] = useState("");

 // Fetch details if we only have an id (handles page refresh)
 useEffect(() => {
   let ignore = false;
   const load = async () => {
     if (order || !fallbackOrderId) return;
     setLoading(true);
     setErr("");
     try {
       const res = await fetch(`${API}/api/orders/${fallbackOrderId}`, {
         headers,
         credentials: "include",
       });
       if (res.status === 401) {
         localStorage.clear();
         navigate("/login");
         return;
       }
       if (!res.ok) {
         const t = await res.text().catch(() => "");
         throw new Error(t || "Failed to load order");
       }
       const data = await res.json().catch(() => null);
       if (!ignore) setOrder(data || null);
     } catch (e) {
       if (!ignore) setErr(e?.message || "Failed to load order");
     } finally {
       if (!ignore) setLoading(false);
     }
   };
   load();
   return () => { ignore = true; };
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [fallbackOrderId, headers]);

 const id = order?.id || fallbackOrderId;

 const handleLogout = () => {
   localStorage.clear();
   navigate("/login");
 };

 const confirm = (msg) => window.confirm(msg);

 const handleDelete = async () => {
   if (!id) return;
   if (!confirm("Delete this order permanently? This cannot be undone.")) return;
   try {
     const res = await fetch(`${API}/api/orders/${id}`, {
       method: "DELETE",
       headers,
       credentials: "include",
     });
     if (res.status === 401) {
       localStorage.clear();
       navigate("/login");
       return;
     }
     if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Delete failed");
     alert("Order deleted");
     navigate("/dashboard");
   } catch (err) {
     console.error("Delete error", err);
     alert(err?.message || "Delete failed");
   }
 };

 const handleUpdate = async () => {
   if (!order?.id) return;
   const updatedAmount = prompt("Enter new total amount:", String(order.totalAmount ?? ""));
   if (updatedAmount == null) return;
   const totalAmount = Number(updatedAmount);
   if (!Number.isFinite(totalAmount) || totalAmount < 0) {
     alert("Please enter a valid amount");
     return;
   }

   try {
     const res = await fetch(`${API}/api/orders/${order.id}`, {
       method: "PUT",
       headers: { ...headers, "Content-Type": "application/json" },
       credentials: "include",
       body: JSON.stringify({
         totalAmount,
         items: order.items || order.OrderItems || [],
       }),
     });
     if (res.status === 401) {
       localStorage.clear();
       navigate("/login");
       return;
     }
     if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Update failed");
     alert("Order updated");
     // optionally update local state
     setOrder((prev) => (prev ? { ...prev, totalAmount } : prev));
   } catch (err) {
     console.error("Update error", err);
     alert(err?.message || "Update failed");
   }
 };

 const viewInvoice = async (asPdf = false) => {
   if (!id) return;
   try {
     const endpoint = asPdf ? `${API}/api/orders/${id}/invoice.pdf` : `${API}/api/orders/${id}/invoice`;
     const res = await fetch(endpoint, { headers, credentials: "include" });
     if (res.status === 401) {
       localStorage.clear();
       navigate("/login");
       return;
     }
     if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to load invoice");
     const blob = await res.blob();
     const url = URL.createObjectURL(blob);
     window.open(url, "_blank", "noopener,noreferrer");
     setTimeout(() => URL.revokeObjectURL(url), 60000);
   } catch (e) {
     alert(e?.message || "Failed to open invoice");
   }
 };

 // Try to list items across shapes
 const items =
   (Array.isArray(order?.items) && order.items) ||
   (Array.isArray(order?.MenuItems) &&
     order.MenuItems.map((mi) => ({
       id: mi.id,
       name: mi.name,
       quantity: mi?.OrderItem?.quantity ?? 1,
       price: mi.price ?? 0,
     }))) ||
   (Array.isArray(order?.OrderItems) &&
     order.OrderItems.map((oi) => ({
       id: oi.id,
       name: oi?.MenuItem?.name || "Item",
       quantity: oi.quantity ?? 1,
       price: oi?.MenuItem?.price ?? 0,
     }))) ||
   [];

 const paymentMethod =
   order?.paymentMethod === "mock_online" ? "Online" :
   order?.paymentMethod === "online" ? "Online" : "COD";

 const paymentStatus = (order?.paymentStatus || "unpaid").toUpperCase();
 const status = (order?.status || "pending").toUpperCase();

 if (!id && !order && !loading) {
   return (
     <Box sx={{ maxWidth: 640, mx: "auto", mt: 6 }}>
       <Alert severity="warning" sx={{ mb: 2 }}>
         No order data found. If you refreshed this page, open it from the checkout flow or pass <code>?orderId=&lt;id&gt;</code> in the URL.
       </Alert>
       <Stack direction="row" spacing={1}>
         <Button variant="outlined" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
         <Button variant="contained" onClick={() => navigate("/orders")}>My Orders</Button>
       </Stack>
     </Box>
   );
 }

 return (
   <Box sx={{ maxWidth: 720, mx: "auto", mt: 4, px: 2 }}>
     <Paper elevation={3} sx={{ p: 3 }}>
       <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
         <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
           🎉 Order Successful!
         </Typography>
         {!!id && (
           <Chip size="small" color="success" label={`#${id}`} />
         )}
       </Stack>

       {loading ? (
         <Stack direction="row" gap={1} alignItems="center" sx={{ py: 2 }}>
           <CircularProgress size={20} /> <Typography>Loading order…</Typography>
         </Stack>
       ) : err ? (
         <Alert severity="error" sx={{ my: 2 }}>{err}</Alert>
       ) : (
         <>
           <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
             We’ve received your order. You can track its status, view your invoice, or continue browsing.
           </Typography>

           <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ my: 1 }}>
             <Chip size="small" label={`Status: ${status}`} />
             <Chip size="small" variant="outlined" label={`Payment: ${paymentMethod} · ${paymentStatus}`} />
             <Chip size="small" color="primary" label={`Total: ${rupee(order?.totalAmount)}`} />
           </Stack>

           <Divider sx={{ my: 2 }} />

           <Typography variant="h6" sx={{ mb: 1 }}>Ordered Items</Typography>
           {items.length === 0 ? (
             <Typography color="text.secondary">No items found.</Typography>
           ) : (
             <List dense>
               {items.map((it, i) => (
                 <ListItem key={it.id ?? i} disableGutters
                   secondaryAction={<Typography>{rupee((it.price ?? 0) * (it.quantity ?? 1))}</Typography>}>
                   <ListItemText
                     primary={`${it.name ?? `Item ${it.MenuItemId ?? ""}`} × ${it.quantity ?? 1}`}
                     secondary={it.MenuItemId ? `Item ID: ${it.MenuItemId}` : undefined}
                   />
                 </ListItem>
               ))}
             </List>
           )}

           <Divider sx={{ my: 2 }} />

           <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
             <Button>
               variant="contained"
               onClick={() => navigate(`/track/${id}`)}
               disabled={!id}
               Track Order
             </Button>
             <Button variant="outlined" onClick={() => viewInvoice(false)} disabled={!id}>
               View Invoice
             </Button>
             <Button variant="outlined" onClick={() => viewInvoice(true)} disabled={!id}>
               Download PDF
             </Button>
           </Stack>

           <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
             <Button variant="contained" color="primary" onClick={() => navigate("/orders")}>
               Go to My Orders
             </Button>
             <Button>
               variant="outlined"
               component={RouterLink}
               to="/vendors"
               Continue Ordering
             </Button>
             <Button variant="outlined" onClick={() => navigate("/dashboard")}>
               Go to Dashboard
             </Button>
             <Button variant="text" color="inherit" onClick={handleLogout}>
               Logout
             </Button>
           </Stack>

           {/* Advanced actions (keep but guarded) */}
           <Divider sx={{ my: 2 }} />
           <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
             <Button variant="outlined" color="warning" onClick={handleUpdate} disabled={!order?.id}>
               Update Order (amount)
             </Button>
             <Button variant="outlined" color="error" onClick={handleDelete} disabled={!id}>
               Delete Order
             </Button>
           </Stack>
         </>
       )  }
     </Paper>
   </Box>
 );
} 
