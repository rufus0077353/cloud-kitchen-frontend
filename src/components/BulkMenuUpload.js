
import React, { useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField, MenuItem, Alert,
  Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { toast } from "react-toastify";
import { downloadMenuTemplate, uploadMenuCsv, exportMenuCsv } from "../api/menu";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export default function BulkMenuUpload() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("upsert"); // "create" | "upsert"
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    const isCsv = /text\/csv|\.csv$/i.test(f.type) || /\.csv$/i.test(f.name);
    if (!isCsv) { toast.warn("Please choose a .csv file"); return; }
    if (f.size > MAX_SIZE_BYTES) { toast.warn("CSV too large (max 5MB)"); return; }
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return toast.warn("Choose a CSV file");
    try {
      setLoading(true);
      const data = await uploadMenuCsv({ file, mode });
      setResult(data);
      const created = Number(data.created || 0);
      const updated = Number(data.updated || 0);
      if (created || updated) {
        toast.success(`Done: +${created} created, ${updated} updated`);
        setFile(null); // reset chip label
      } else {
        toast.info("No rows created/updated");
      }
    } catch (e) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Bulk upload menu (CSV)</Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={downloadMenuTemplate}
          >
            Download template
          </Button>

          <Button
            variant="outlined"
            startIcon={<ListAltIcon />}
            onClick={exportMenuCsv}
          >
            Export current menu
          </Button>

          <TextField
            label="Mode"
            select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            sx={{ width: 220 }}
            size="small"
          >
            <MenuItem value="upsert">Upsert (update if exists)</MenuItem>
            <MenuItem value="create">Create only</MenuItem>
          </TextField>

          <Button variant="contained" component="label" startIcon={<CloudUploadIcon />}>
            {file ? `${file.name} (${Math.ceil(file.size/1024)} KB)` : "Choose CSV"}
            <input
              type="file"
              hidden
              accept=".csv,text/csv"
              onChange={onPick}
            />
          </Button>

          <Button variant="contained" onClick={handleUpload} disabled={loading || !file}>
            {loading ? "Uploading…" : "Upload"}
          </Button>
        </Stack>

        <Alert severity="info">
          Required columns: <strong>name</strong>, <strong>price</strong>. Optional: description, imageUrl, isAvailable (true/false).<br />
          Upsert key: <strong>name within vendor</strong>. If an item with the same name exists, it will be updated.
        </Alert>

        {result && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Result</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Total: {result.total ?? 0} • Created: {result.created ?? 0} • Updated: {result.updated ?? 0} • Skipped: {result.skipped ?? 0}
            </Typography>

            {Array.isArray(result.errors) && result.errors.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row #</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((e, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert severity="success" sx={{ mt: 1 }}>
                No row errors.
              </Alert>
            )}
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}