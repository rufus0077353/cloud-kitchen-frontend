import React from "react";
import {
  Box, Button, Container, Paper, Stack, Typography, Divider, List, ListItem, ListItemText
} from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const Money = ({ v }) => <strong>₹{Number(v || 0).toFixed(2)}</strong>;

export default function CreateOrder() {
  const navigate = useNavigate();
  const { items, subtotal, openDrawer } = useCart();

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Start Your Order</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          Use the shopping cart flow. Pick a vendor, press <strong>Add</strong> on menu items, then checkout.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button variant="contained" startIcon={<StorefrontIcon />} onClick={() => navigate("/vendors")}>
            Browse Vendors & Add Items
          </Button>
          <Button variant="outlined" startIcon={<ShoppingCartIcon />} onClick={openDrawer}>
            Open Cart
          </Button>
          <Button
            variant="outlined"
            startIcon={<ShoppingCartCheckoutIcon />}
            onClick={() => navigate("/checkout")}
            disabled={items.length === 0}
          >
            Go to Checkout
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Cart Summary</Typography>
        {items.length === 0 ? (
          <Typography color="text.secondary">Your cart is empty.</Typography>
        ) : (
          <>
            <List dense>
              {items.map((it) => (
                <ListItem key={it.id} disableGutters secondaryAction={<Money v={Number(it.price)*Number(it.qty)} />}>
                  <ListItemText primary={`${it.name} × ${it.qty}`} secondary={<span>Price: <Money v={it.price} /></span>} />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 1.5 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Subtotal</Typography>
              <Typography variant="subtitle1"><Money v={subtotal} /></Typography>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
}