// src/components/VendorSalesTrend.js
import React, { useEffect, useState } from "react";
import { Paper, Box, Typography, ToggleButtonGroup, ToggleButton, CircularProgress } from "@mui/material";
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

  const load = async (n) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/vendor/daily?days=${n}`, { headers });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  const labels = (rows || []).map(r => r.date.slice(5)); // MM-DD
  const orders = (rows || []).map(r => r.orders);
  const revenue = (rows || []).map(r => r.revenue);

  const data = {
    labels,
    datasets: [
      { label: "Orders", data: orders, tension: 0.3 },
      { label: "Revenue (₹)", data: revenue, tension: 0.3, yAxisID: "y1" },
    ],
  };

  const options = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    scales: {
      y:  { beginAtZero: true, title: { display: true, text: "Orders" } },
      y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Revenue (₹)" } },
    },
    plugins: { legend: { display: true } },
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6">Sales Trend</Typography>
        <ToggleButtonGroup size="small" value={days} exclusive onChange={(_, v) => v && setDays(v)}>
          <ToggleButton value={7}>7d</ToggleButton>
          <ToggleButton value={14}>14d</ToggleButton>
          <ToggleButton value={30}>30d</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress size={24} /></Box>
      ) : (
        <Line data={data} options={options} />
      )}
    </Paper>
  );
}