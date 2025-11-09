// src/api/menu.js
const API = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/,"");

function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Client-side CSV template */
export function downloadMenuTemplate() {
  const csv = [
    "name,price,description,imageUrl,isAvailable",
    "Margherita,199,Classic cheese pizza,https://example.com/p1.jpg,true",
    "Veg Burger,149,Fresh patty with veggies,https://example.com/p2.jpg,true",
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "menu-template.csv");
}

/** Export current menu from server */
export async function exportMenuCsv() {
  const paths = [
    "/api/vendors/me/menu.csv",
    "/api/menu/export", // fallback
  ];
  for (const p of paths) {
    try {
      const res = await fetch(API + p, { headers: { ...authHeaders() }, credentials: "include" });
      if (!res.ok) continue;
      const blob = await res.blob();
      downloadBlob(blob, "menu-export.csv");
      return;
    } catch {}
  }
  throw new Error("Export not available");
}

/** Upload CSV */
export async function uploadMenuCsv({ file, mode = "upsert" }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);

  const paths = [
    `/api/vendors/me/menu/upload?mode=${encodeURIComponent(mode)}`,
    `/api/menu/upload?mode=${encodeURIComponent(mode)}`, // fallback
  ];

  for (const p of paths) {
    try {
      const res = await fetch(API + p, {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Upload failed (${res.status})`);
      return {
        total: Number(data.total ?? data.count ?? 0),
        created: Number(data.created ?? 0),
        updated: Number(data.updated ?? 0),
        skipped: Number(data.skipped ?? 0),
        errors: Array.isArray(data.errors) ? data.errors : [],
      };
    } catch (e) {
      // try next
    }
  }
  throw new Error("Upload endpoint not found");
}