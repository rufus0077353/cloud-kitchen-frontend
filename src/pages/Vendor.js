// src/pages/Vendors.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Skeleton,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL || "";
const PLACEHOLDER_IMG = "/images/placeholder-food.png";

const isHttpUrl = (v) => {
  if (!v) return false;
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
};

const cuisineTokens = (c) =>
  String(c || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function GridSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid key={i} item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <Skeleton variant="rectangular" height={152} />
            <CardContent>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Skeleton variant="rounded" width={70} height={24} />
                <Skeleton variant="rounded" width={70} height={24} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default function Vendors() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [cuisine, setCuisine] = useState("all");

  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // fetch vendors
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (openOnly) params.set("status", "open");
      const res = await fetch(`${API}/api/admin/filter?${params}`, { headers }); // your admin filter supports q + status
      const data = await res.json().catch(() => []);
      // fallback to /api/vendors if admin/filter is protected in prod
      const list = Array.isArray(data) ? data : [];
      setVendors(list.length ? list : await fallbackVendors());
    } catch {
      setVendors(await fallbackVendors());
    } finally {
      setLoading(false);
    }
  };

  // fallback to public vendors index
  const fallbackVendors = async () => {
    try {
      const res = await fetch(`${API}/api/vendors`, { headers });
      const d = await res.json().catch(() => []);
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  };

  useEffect(() => { fetchVendors(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchVendors(); /* eslint-disable-next-line */ }, [openOnly]);

  const cuisinesAll = useMemo(() => {
    const set = new Set();
    vendors.forEach(v => cuisineTokens(v.cuisine).forEach(c => set.add(c)));
    return ["all", ...Array.from(set).sort()];
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      if (cuisine !== "all") {
        const has = cuisineTokens(v.cuisine).some(c => c.toLowerCase() === cuisine.toLowerCase());
        if (!has) return false;
      }
      return true;
    });
  }, [vendors, cuisine]);

  return (
    <Container sx={{ py: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Browse Vendors</Typography>

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <TextField
            size="small"
            placeholder="Search vendors or cuisines"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchVendors()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={fetchVendors} size="small"><RefreshIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 280 }}
          />

          <ToggleButtonGroup
            exclusive
            value={openOnly ? "open" : "all"}
            onChange={(_e, val) => setOpenOnly(val === "open")}
            size="small"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="open">Open now</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            select
            label="Cuisine"
            size="small"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: 140 }}
          >
            {cuisinesAll.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All cuisines" : c}</option>
            ))}
          </TextField>
        </Stack>
      </Stack>

      {loading ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography color="text.secondary">No vendors found.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered
            .filter(v => (q ? (v.name?.toLowerCase().includes(q.toLowerCase()) ||
                               cuisineTokens(v.cuisine).some(c => c.toLowerCase().includes(q.toLowerCase())))
                         : true))
            .map((v) => {
              const img = isHttpUrl(v.imageUrl) ? v.imageUrl : PLACEHOLDER_IMG;
              const rating = Number(v.ratingAvg || 0);
              const rCount = Number(v.ratingCount || 0);
              const eta = Number(v.etaMins || 0);
              const fee = Number(v.deliveryFee || 0);
              const open = v.isOpen !== false;

              return (
                <Grid key={v.id} item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardActionArea onClick={() => navigate(`/vendors/${v.id}`)}>
                      <CardMedia
                        component="img"
                        height="152"
                        image={img}
                        alt={v.name || "Vendor"}
                        sx={{ objectFit: "cover" }}
                      />
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle1" noWrap fontWeight={600}>
                            {v.name}
                          </Typography>
                          {!open && <Chip size="small" label="Closed" variant="outlined" />}
                        </Stack>

                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <StarIcon fontSize="small" />
                            <Typography variant="body2">
                              {rating > 0 ? rating.toFixed(1) : "—"} {rCount > 0 ? `(${rCount})` : ""}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AccessTimeIcon fontSize="small" />
                            <Typography variant="body2">{eta > 0 ? `${eta} mins` : "—"}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <CurrencyRupeeIcon fontSize="small" />
                            <Typography variant="body2">{fee > 0 ? fee.toFixed(0) : "Free delivery"}</Typography>
                          </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                          {cuisineTokens(v.cuisine).slice(0, 3).map((c) => (
                            <Chip key={c} size="small" label={c} variant="outlined" />
                          ))}
                          {!v.cuisine && <Chip size="small" label="All cuisines" variant="outlined" />}
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
        </Grid>
      )}
    </Container>
  );
}