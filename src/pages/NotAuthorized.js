// src/pages/NotAuthorized.js
import React from "react";
import { Button, Container, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NotAuthorized() {
  const navigate = useNavigate();
  return (
    <Container sx={{ py: 8 }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h4">403 — Not authorized</Typography>
        <Typography color="text.secondary">
          You don’t have permission to view this page.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate(-1)}>Go Back</Button>
          <Button variant="contained" onClick={() => navigate("/login")}>Login</Button>
        </Stack>
      </Stack>
    </Container>
  );
}