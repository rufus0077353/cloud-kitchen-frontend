
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Button,
  Stack,
  Chip,
  Box,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ClearAllIcon from "@mui/icons-material/ClearAll";

import { useNotifications } from "../context/NotificationsContext";

/** Format a human-ish relative time like "2h ago" */
function timeAgo(d) {
  const ts = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  const now = new Date();
  const ms = Math.max(0, now - (ts instanceof Date && !isNaN(ts) ? ts : now));
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  return `${d2}d ago`;
}

export default function NotificationBell() {
  const { items, unreadCount, markAllRead, clearAll } = useNotifications();
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const navigate = useNavigate();

  const latest = useMemo(() => (Array.isArray(items) ? items.slice(0, 10) : []), [items]);
  const badgeContent = unreadCount > 99 ? "99+" : unreadCount || 0;

  const go = (href) => {
    setAnchor(null);
    if (href) navigate(href);
  };

  // Color chip by type (optional: falls back to default)
  const chipColorFor = (t) =>
    t === "success" ? "success" :
    t === "warning" ? "warning" :
    t === "error"   ? "error"   :
    t === "info"    ? "info"    : "default";

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Open notifications"
        aria-controls={open ? "notif-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
      >
        <Badge
          color="secondary"
          badgeContent={badgeContent}
          invisible={!badgeContent}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        id="notif-menu"
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 360,
            maxWidth: "90vw",
            // keep header/footer stuck and list scrollable
            "& .notif-scroll": { maxHeight: 360, overflowY: "auto" },
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1 }}
        >
          <Typography variant="subtitle1">Notifications</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={() => { markAllRead?.(); }}
              disabled={!unreadCount}
            >
              Read all
            </Button>
            <Button
              size="small"
              startIcon={<ClearAllIcon />}
              onClick={() => { clearAll?.(); }}
              disabled={!items?.length}
              color="error"
            >
              Clear
            </Button>
          </Stack>
        </Stack>
        <Divider />

        {/* List */}
        <Box className="notif-scroll">
          {latest.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </MenuItem>
          ) : (
            latest.map((n) => {
              const createdAt = n?.createdAt || n?.created_at || n?.time;
              const rel = createdAt ? timeAgo(createdAt) : "";
              // ensure strings
              const title = String(n?.title ?? "Notification");
              const body = String(n?.body ?? "");

              return (
                <MenuItem
                  key={n?.id ?? `${title}-${rel}`}
                  onClick={() => go(n?.href)}
                  sx={{ alignItems: "flex-start", py: 1.25 }}
                >
                  <Box sx={{ width: "100%", minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="subtitle2"
                        sx={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                        title={title}
                      >
                        {title}
                      </Typography>
                      {!n?.read && (
                        <Chip label="new" size="small" color="primary" variant="outlined" />
                      )}
                      {n?.type && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color={chipColorFor(n.type)}
                          label={String(n.type).toLowerCase()}
                        />
                      )}
                    </Stack>

                    {!!body && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={body}
                      >
                        {body}
                      </Typography>
                    )}

                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {rel}
                      </Typography>
                      {n?.actionLabel && n?.href && (
                        <Button
                          size="small"
                          variant="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            go(n.href);
                          }}
                        >
                          {n.actionLabel}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </MenuItem>
              );
            })
          )}
        </Box>

        {/* Footer (optional CTA) */}
        {items?.length > 0 && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1 }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={() => {
                  setAnchor(null);
                  // route exists? otherwise adjust
                  navigate("/orders");
                }}
              >
                View recent activity
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
}