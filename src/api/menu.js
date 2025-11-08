// src/api/menu.js
const API = process.env.REACT_APP_API_BASE_URL || "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function downloadMenuTemplate() {
  // Opens the template endpoint directly; browser downloads it
  window.open(`${API}/api/menu-items/template-csv`, "_blank");
}

export async function uploadMenuCsv({ file, mode = "upsert" }) {
  const form = new FormData();
  form.append("file", file);        // field name must be "file"
  form.append("mode", mode);        // "create" | "upsert"

  const resp = await fetch(`${API}/api/menu-items/bulk-csv`, {
    method: "POST",
    headers: { ...authHeaders() },  // do NOT set Content-Type (let browser set multipart boundary)
    body: form,
    credentials: "include",
  });

  if (!resp.ok) {
    // Try to surface server error message
    let msg = "Upload failed";
    try {
      const j = await resp.json();
      msg = j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return await resp.json(); // { total, created, updated, skipped, errors: [...] }
}