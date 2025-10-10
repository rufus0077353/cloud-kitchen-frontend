import React, { useEffect, useMemo, useState } from "react";
import { Container, Stack, Typography, Paper, CircularProgress, Box, Button } from "@mui/material";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/,"");
const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const containerStyle = { width: "100%", height: 420 };
const defaultCenter = { lat: 12.9716, lng: 77.5946 };

export default function BrowseVendorsMap() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState(defaultCenter);

  const { isLoaded } = useJsApiLoader({ id: "servezy-map-browse", googleMapsApiKey: MAPS_KEY });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Your backend should return { items: [{id,name,lat,lng, ...}], ... } or an array
        const res = await fetch(`${API}/api/vendors`);
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data) ? data : (data.items || []);
        setVendors(list.filter(v => Number(v.lat) && Number(v.lng)));
      } catch {
        setVendors([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Browse Vendors on Map</Typography>
        <Button variant="outlined" onClick={locateMe}>Use my location</Button>
      </Stack>

      {!MAPS_KEY || !isLoaded ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Map is unavailable (missing API key). You can still browse the list in the Vendors page.
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12}
              options={{ streetViewControl: false, mapTypeControl: false }}
            >
              {vendors.map(v => (
                <Marker key={v.id} position={{ lat: Number(v.lat), lng: Number(v.lng) }}
                  title={v.name || `Vendor #${v.id}`}
                />
              ))}
            </GoogleMap>
          )}
        </Paper>
      )}
    </Container>
  );
}