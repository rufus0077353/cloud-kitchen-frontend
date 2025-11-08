
import React, { useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField, MenuItem, Alert,
  Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { toast } from "react-toastify";
import { downloadMenuTemplate, uploadMenuCsv } from "../api/menu";

export default function BulkMenuUpload() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("upsert"); // "create" | "upsert"
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleUpload() {
    if (!file) return toast.warn("Choose a CSV file");
    try {
      setLoading(true);
      const data = await uploadMenuCsv({ file, mode });
      setResult(data);
      if (data.created || data.updated) {
        toast.success(`Done: +${data.created} created, ${data.updated} updated`);
      } else {
        toast.info("No rows created/updated");
      }
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Bulk upload menu (CSV)</Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={downloadMenuTemplate}
          >
            Download template
          </Button>

          <TextField
            label="Mode"
            select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            sx={{ width: 220 }}
          >
            <MenuItem value="upsert">Upsert (update if exists)</MenuItem>
            <MenuItem value="create">Create only</MenuItem>
          </TextField>

          <Button variant="contained" component="label" startIcon={<CloudUploadIcon />}>
            {file ? file.name : "Choose CSV"}
            <input
              type="file"
              hidden
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Button>

          <Button variant="contained" onClick={handleUpload} disabled={loading || !file}>
            {loading ? "Uploading…" : "Upload"}
          </Button>
        </Stack>

        <Alert severity="info">
          Required columns: <strong>name</strong>, <strong>price</strong>. Optional: description, imageUrl, isAvailable (true/false).
          <br/>Upsert key: <strong>name within vendor</strong>. If an item with the same name exists, it will be updated.
        </Alert>

        {result && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Result</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Total: {result.total} • Created: {result.created} • Updated: {result.updated} • Skipped: {result.skipped}
            </Typography>

            {result.errors?.length ? (
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