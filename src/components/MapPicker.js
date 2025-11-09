import React, { useCallback, useMemo, useState } from "react";
import { Box, TextField, Stack, Button, Typography } from "@mui/material";
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const containerStyle = { width: "100%", height: 320 };
const MAP_LIBRARIES = ["places"];
const defaultCenter = { lat: 12.9716, lng: 77.5946 };

// 👉 helper: normalize any input into {lat,lng}
function toLatLng(v) {
  if (!v) return null;
  if (Array.isArray(v)) {
    const [lat, lng] = v;
    const nlat = Number(lat), nlng = Number(lng);
    if (Number.isFinite(nlat) && Number.isFinite(nlng)) return { lat: nlat, lng: nlng };
    return null;
  }
  const nlat = Number(v.lat), nlng = Number(v.lng);
  if (Number.isFinite(nlat) && Number.isFinite(nlng)) return { lat: nlat, lng: nlng };
  return null;
}

export default function MapPicker({ value, onChange, disabled = false }) {
  const [auto, setAuto] = useState(null);
  const hasKey = Boolean(MAPS_KEY);

  const point = useMemo(() => toLatLng(value), [value]);
  const center = useMemo(() => point ?? defaultCenter, [point]);

  const { isLoaded } = useJsApiLoader({
    id: "servezy-maps",
    googleMapsApiKey: MAPS_KEY,
    libraries: MAP_LIBRARIES,
  });

  const onMapClick = useCallback(
    (e) => {
      if (disabled) return;
      onChange?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
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
            value={point?.lat ?? ""}
            onChange={(e) =>
              onChange?.({ lat: Number(e.target.value || 0), lng: point?.lng ?? 0 })
            }
          />
          <TextField
            label="Lng"
            size="small"
            value={point?.lng ?? ""}
            onChange={(e) =>
              onChange?.({ lat: point?.lat ?? 0, lng: Number(e.target.value || 0) })
            }
          />
        </Stack>
        <Button size="small" variant="outlined" onClick={locateMe} disabled={disabled}>
          Use my location
        </Button>
      </Stack>
    );
  }

  if (!isLoaded) return <Box sx={{ height: 320, bgcolor: "action.hover", borderRadius: 1 }} />;

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
          <TextField fullWidth size="small" placeholder="Search address or place…" type="search" />
        </Autocomplete>
        <Button size="small" variant="outlined" onClick={locateMe} disabled={disabled}>
          Use my location
        </Button>
      </Stack>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={point ? 15 : 12}
        onClick={onMapClick}
        options={{ streetViewControl: false, mapTypeControl: false }}
      >
        {point && (
          <Marker
            position={point}
            draggable={!disabled}
            onDragEnd={(e) => onChange?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
        )}
      </GoogleMap>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Lat"
          value={point?.lat ?? ""}
          onChange={(e) => onChange?.({ lat: Number(e.target.value || 0), lng: point?.lng ?? 0 })}
        />
        <TextField
          size="small"
          label="Lng"
          value={point?.lng ?? ""}
          onChange={(e) => onChange?.({ lat: point?.lat ?? 0, lng: Number(e.target.value || 0) })}
        />
      </Stack>
    </Stack>
  );
}