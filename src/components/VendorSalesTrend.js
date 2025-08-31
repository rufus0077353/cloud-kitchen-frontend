
import React, { useEffect, useState } from "react";
import {
  Paper, Box, Typography, ToggleButtonGroup, ToggleButton,
  CircularProgress, Button, Stack
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

export default function VendorSalesTrend() {
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const load = async (n = days) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/daily?days=${n}`, { headers });
      if (res.status === 401) {
        // session expired → hard redirect to login
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  const labels  = (rows || []).map(r => (r?.date || "").slice(5)); // MM-DD
  const orders  = (rows || []).map(r => Number(r?.orders || 0));
  const revenue = (rows || []).map(r => Number(r?.revenue || 0));

  const data = {
    labels,
    datasets: [
      { label: "Orders", data: orders, tension: 0.3 },
      { label: "Revenue (₹)", data: revenue, tension: 0.3, yAxisID: "y1" },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // let container set the height
    interaction: { mode: "index", intersect: false },
    scales: {
      y:  { beginAtZero: true, title: { display: true, text: "Orders" } },
      y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false },
            title: { display: true, text: "Revenue (₹)" } },
    },
    plugins: { legend: { display: true } },
  };

  const exportCsv = () => {
    const header = "Date,Orders,Revenue\n";
    const lines = (rows || [])
      .map(r => `${r.date},${Number(r.orders || 0)},${Number(r.revenue || 0)}`)
      .join("\n");
    const csv = "\uFEFF" + header + lines; // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `vendor-daily-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="h6">Sales Trend</Typography>

        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup
            size="small"
            value={days}
            exclusive
            onChange={(_, v) => v && setDays(v)}
          >
            <ToggleButton value={7}>7d</ToggleButton>
            <ToggleButton value={14}>14d</ToggleButton>
            <ToggleButton value={30}>30d</ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => load(days)}
          >
            Refresh
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCsv}
            disabled={!rows || rows.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={24} />
        </Box>
      ) : !rows || rows.length === 0 ? (
        <Box
          sx={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
          }}
        >
          No data for this range
        </Box>
      ) : (
        <Box sx={{ height: 320 }}>
          <Line data={data} options={options} />
        </Box>
      )}
    </Paper>
  );
}
