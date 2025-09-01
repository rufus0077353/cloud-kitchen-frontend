import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Grid, Paper, Stack, TextField, Typography, Chip, Button
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import CartDrawer from "../components/CartDrawer";
import { useCart } from "../context/CartContext";

const API = process.env.REACT_APP_API_BASE_URL || "";

export default function BrowseVendors() {
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [openCart, setOpenCart] = useState(false);
  const { totalQty } = useCart();

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await axios.get(`${API}/api/vendors`, { headers });
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load vendors");
      setVendors([]);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (vendors || []).filter(v =>
      !q ||
      (v.name || "").toLowerCase().includes(q) ||
      (v.location || "").toLowerCase().includes(q) ||
      (v.cuisine || "").toLowerCase().includes(q)
    );
  }, [vendors, search]);

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 1 }}>
        <Typography variant="h5">Browse Vendors</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" label="Search by name/location/cuisine" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={load} startIcon={<RefreshIcon />}>Refresh</Button>
          <Button variant="outlined" startIcon={<ShoppingCartIcon />} onClick={() => setOpenCart(true)}>
            Cart {totalQty > 0 ? <Chip size="small" label={totalQty} sx={{ ml: 1 }} /> : null}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {filtered.map(v => (
          <Grid item xs={12} sm={6} md={4} key={v.id}>
            <Paper sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="h6" noWrap title={v.name}>{v.name}</Typography>
              <Typography variant="body2" color="text.secondary">{v.location || "-"}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {(v.cuisine || "").split(",").filter(Boolean).slice(0, 3).map((c, i) =>
                  <Chip key={i} size="small" label={c.trim()} />
                )}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: "auto" }}>
                <Chip size="small" label={v.isOpen ? "Open" : "Closed"} color={v.isOpen ? "success" : "default"} variant="outlined" />
                <Button component={Link} to={`/vendors/${v.id}`} variant="contained" disabled={!v.isOpen}>
                  View Menu
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
        {filtered.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">No vendors</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      <CartDrawer open={openCart} onClose={() => setOpenCart(false)} />
    </Container>
  );
}