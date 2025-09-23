
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Box, Typography, Stack, Skeleton, Tooltip, IconButton, TextField, MenuItem
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

// Small, dependency-free SVG charts (line + bars)
function LineChart({ points, width = 700, height = 220, color = "#1976d2" }) {
  const P = 28; // padding
  const xs = points.map(p => new Date(p.date));
  const ys = points.map(p => Number(p.value || 0));
  const minY = 0;
  const maxY = Math.max(1, Math.max(...ys));

  const path = useMemo(() => {
    if (!points.length) return "";
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const sx = (d) => {
      if (maxX === minX) return P + (width - 2 * P) / 2;
      return P + ((d - minX) / (maxX - minX)) * (width - 2 * P);
    };
    const sy = (v) => P + (height - 2 * P) * (1 - (v - minY) / (maxY - minY));

    return points
      .map((pt, i) => `${i ? "L" : "M"} ${sx(new Date(pt.date))} ${sy(Number(pt.value||0))}`)
      .join(" ");
  }, [points, width, height, xs, ys, minY, maxY]);

  // Y ticks 0, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round((minY + t * (maxY - minY))));

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* grid */}
      {ticks.map((t, i) => {
        const y = P + (height - 2 * P) * (1 - (t - minY) / (maxY - minY));
        return (
          <g key={i}>
            <line x1={P} y1={y} x2={width - P} y2={y} stroke="#eee" />
            <text x={8} y={y + 4} fontSize="10" fill="#607d8b">₹{t}</text>
          </g>
        );
      })}
      {/* path */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {/* dots */}
      {points.map((pt, i) => {
        if (!points.length) return null;
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const sx = (d) => maxX === minX
          ? P + (width - 2 * P) / 2
          : P + ((d - minX) / (maxX - minX)) * (width - 2 * P);
        const sy = (v) => P + (height - 2 * P) * (1 - (v - minY) / (maxY - minY));
        return (
          <circle
            key={i}
            cx={sx(new Date(pt.date))}
            cy={sy(Number(pt.value||0))}
            r="3.2"
            fill={color}
            opacity="0.9"
          />
        );
      })}
    </svg>
  );
}

function BarsChart({ points, width = 700, height = 180, color = "#9c27b0" }) {
  const P = 28;
  const ys = points.map(p => Number(p.value || 0));
  const maxY = Math.max(1, Math.max(...ys));
  const bw = (width - 2 * P) / Math.max(1, points.length);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* baseline */}
      <line x1={P} y1={height - P} x2={width - P} y2={height - P} stroke="#eee" />
      {points.map((pt, i) => {
        const v = Number(pt.value || 0);
        const h = (height - 2 * P) * (v / maxY);
        const x = P + i * bw + bw * 0.08;
        const y = height - P - h;
        const w = bw * 0.84;
        return <rect key={i} x={x} y={y} width={w} height={Math.max(0, h)} fill={color} opacity="0.85" rx="2" />;
      })}
      {/* max label */}
      <text x={8} y={P - 8} fontSize="10" fill="#607d8b">max {Math.round(maxY)}</text>
    </svg>
  );
}

export default function VendorSalesTrend({ days: daysProp }) {
  const [days, setDays] = useState(() => Number(daysProp || localStorage.getItem("vd_days") || 14));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchDaily = async (d = days) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/daily?days=${d}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
      const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDaily(days); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (daysProp != null) {
      const n = Number(daysProp);
      if (Number.isFinite(n) && n > 0) {
        setDays(n);
        fetchDaily(n);
      }
    }
  }, [daysProp]); // react to parent changes

  const revenuePoints = useMemo(
    () => rows.map(r => ({ date: r.date, value: Number(r.revenue || 0) })),
    [rows]
  );
  const ordersPoints = useMemo(
    () => rows.map(r => ({ date: r.date, value: Number(r.orders || 0) })),
    [rows]
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Sales Trend</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label="Range"
            value={days}
            onChange={(e) => { const v = Number(e.target.value); setDays(v); fetchDaily(v); }}
            sx={{ width: 150 }}
          >
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={14}>Last 14 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
          </TextField>
          <Tooltip title="Reload">
            <IconButton onClick={() => fetchDaily(days)}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Box>
          <Skeleton variant="rectangular" height={220} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={160} />
        </Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No orders in this range yet.</Typography>
      ) : (
        <Box>
          <Typography variant="caption" color="text.secondary">Revenue (₹)</Typography>
          <LineChart points={revenuePoints} />
          <Box sx={{ height: 8 }} />
          <Typography variant="caption" color="text.secondary">Orders (count)</Typography>
          <BarsChart points={ordersPoints} />
        </Box>
      )}
    </Paper>
  );
}