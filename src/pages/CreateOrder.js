import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Container, FormControl, InputLabel, MenuItem, Select,
  Table, TableHead, TableRow, TableCell, TableBody, TextField, Typography, Paper
} from "@mui/material";
import { toast } from "react-toastify";
import api from "../utils/api";

const CreateOrder = () => {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [menu, setMenu] = useState([]);
  const [quantities, setQuantities] = useState({});

  // Load vendors
  const loadVendors = async () => {
    try {
      const { data } = await api.get("/vendors");
      setVendors(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Failed to load vendors");
      setVendors([]);
    }
  };

  // Load menu (only available items)
  const loadMenu = async (vId) => {
    if (!vId) return;
    try {
      const { data } = await api.get(`/vendors/${vId}/menu`);
      setMenu(Array.isArray(data) ? data : []);
      setQuantities({});
    } catch (e) {
      toast.error("Failed to load menu");
      setMenu([]);
      setQuantities({});
    }
  };

  useEffect(() => { loadVendors(); }, []);
  useEffect(() => { if (vendorId) loadMenu(vendorId); }, [vendorId]);

  const cartItems = useMemo(() => {
    return menu
      .filter(it => Number(quantities[it.id]) > 0)
      .map(it => ({
        MenuItemId: it.id,
        quantity: Number(quantities[it.id]),
        lineTotal: Number(it.price) * Number(quantities[it.id]),
        name: it.name,
        price: Number(it.price),
      }));
  }, [menu, quantities]);

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.lineTotal, 0),
    [cartItems]
  );

  const handleQtyChange = (id, val) => {
    const n = Math.max(0, Number(val || 0));
    setQuantities(q => ({ ...q, [id]: n }));
  };

  const submitOrder = async () => {
    if (!vendorId) {
      toast.error("Select a vendor");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    // Backend needs only VendorId and items; it computes totals and takes UserId from JWT
    const payload = {
      VendorId: Number(vendorId),
      items: cartItems.map(({ MenuItemId, quantity }) => ({ MenuItemId, quantity })),
    };

    try {
      await api.post("/orders", payload);
      toast.success("Order placed!");
      setQuantities({});
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to place order";
      toast.error(msg);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Create Order</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Vendor</InputLabel>
          <Select
            label="Vendor"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            {vendors.map(v => (
              <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {vendorId && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Menu</Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell align="right">Line Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {menu.map(item => {
                const qty = Number(quantities[item.id] || 0);
                const line = qty * Number(item.price || 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>₹{item.price}</TableCell>
                    <TableCell width={120}>
                      <TextField
                        type="number"
                        size="small"
                        value={qty}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="right">₹{line.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              {menu.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">No items available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Total: ₹{totalAmount.toFixed(2)}</Typography>
        <Button variant="contained" onClick={submitOrder} disabled={cartItems.length === 0}>
          Place Order
        </Button>
      </Box>
    </Container>
  );
};

export default CreateOrder;