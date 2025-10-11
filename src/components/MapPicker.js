
import React, { useCallback, useMemo, useState } from "react";
import { Box, TextField, Stack, Button, Typography } from "@mui/material";
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from "@react-google-maps/api";

// ✅ Stable constants — these should never be declared inside the component
const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const containerStyle = { width: "100%", height: 320 };
const MAP_LIBRARIES = ["places"]; // 👈 declare outside component to stop reloading warning
const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru fallback

/**
 * props:
 *  - value: { lat: number, lng: number } | null
 *  - onChange: (coords|null) => void
 *  - disabled?: boolean
 */
export default function MapPicker({ value, onChange, disabled = false }) {
  const [auto, setAuto] = useState(null);
  const hasKey = Boolean(MAPS_KEY);

  // lazy init map center
  const center = useMemo(() => {
    if (value?.lat && value?.lng) return { lat: Number(value.lat), lng: Number(value.lng) };
    return defaultCenter;
  }, [value]);

  // ✅ use stable MAP_LIBRARIES constant
  const { isLoaded } = useJsApiLoader({
    id: "servezy-maps",
    googleMapsApiKey: MAPS_KEY,
    libraries: MAP_LIBRARIES, // 👈 fix: don't create a new array each render
  });

  const onMapClick = useCallback(
    (e) => {
      if (disabled) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onChange?.({ lat, lng });
    },
    [onChange, disabled]
  );

  const locateMe = async () => {
    if (disabled) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange?.({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  // Graceful fallback if no key
  if (!hasKey) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Maps disabled (missing <code>REACT_APP_GOOGLE_MAPS_API_KEY</code>). You can still paste coordinates:
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Lat"
            size="small"
            value={value?.lat ?? ""}
            onChange={(e) => onChange?.({ lat: Number(e.target.value || 0), lng: value?.lng ?? 0 })}
          />
          <TextField
            label="Lng"
            size="small"
            value={value?.lng ?? ""}
            onChange={(e) => onChange?.({ lat: value?.lat ?? 0, lng: Number(e.target.value || 0) })}
          />
        </Stack>
        <Button size="small" variant="outlined" onClick={locateMe} disabled={disabled}>
          Use my location
        </Button>
      </Stack>
    );
  }

  if (!isLoaded) {
    return <Box sx={{ height: 320, bgcolor: "action.hover", borderRadius: 1 }} />;
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}>
        <Autocomplete
          onLoad={setAuto}
          onPlaceChanged={() => {
            const p = auto?.getPlace();
            const loc = p?.geometry?.location;
            if (loc) onChange?.({ lat: loc.lat(), lng: loc.lng() });
          }}
        >
          <TextField fullWidth size="small" placeholder="Search address or place…" />
        </Autocomplete>
        <Button size="small" variant="outlined" onClick={locateMe} disabled={disabled}>
          Use my location
        </Button>
      </Stack>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={value ? 15 : 12}
        onClick={onMapClick}
        options={{ streetViewControl: false, mapTypeControl: false }}
      >
        {value?.lat && value?.lng && (
          <Marker
            position={{ lat: value.lat, lng: value.lng }}
            draggable={!disabled}
            onDragEnd={(e) => onChange?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
        )}
      </GoogleMap>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Lat"
          value={value?.lat ?? ""}
          onChange={(e) => onChange?.({ lat: Number(e.target.value || 0), lng: value?.lng ?? 0 })}
        />
        <TextField
          size="small"
          label="Lng"
          value={value?.lng ?? ""}
          onChange={(e) => onChange?.({ lat: value?.lat ?? 0, lng: Number(e.target.value || 0) })}
        />
      </Stack>
    </Stack>
  );
}