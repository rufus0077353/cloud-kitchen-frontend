
// src/components/NotificationBell.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge, IconButton, Menu, MenuItem, ListItemText, ListItemSecondaryAction,
  Typography, Divider, Button, Stack, Chip
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ClearAllIcon from "@mui/icons-material/ClearAll";

import { useNotifications } from "../context/NotificationsContext";

export default function NotificationBell() {
  const { items, unreadCount, markAllRead, clearAll } = useNotifications();
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const navigate = useNavigate();

  const latest = useMemo(() => items.slice(0, 10), [items]);

  const go = (href) => {
    setAnchor(null);
    if (href) navigate(href);
  };

  return (
    <>
      <IconButton color="inherit" onClick={(e) => setAnchor(e.currentTarget)} aria-label="notifications">
        <Badge color="secondary" badgeContent={unreadCount > 99 ? "99+" : unreadCount}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxWidth: "90vw" } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllRead} disabled={!unreadCount}>
              Read all
            </Button>
            <Button size="small" startIcon={<ClearAllIcon />} onClick={clearAll} disabled={items.length === 0}>
              Clear
            </Button>
          </Stack>
        </Stack>
        <Divider />

        {latest.length === 0 ? (
          <MenuItem disabled><ListItemText primary="No notifications yet" /></MenuItem>
        ) : (
          latest.map((n) => (
            <MenuItem key={n.id} onClick={() => go(n.href)}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2">{n.title}</Typography>
                    {!n.read && <Chip label="new" size="small" color="primary" variant="outlined" />}
                  </Stack>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {n.body}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <Typography variant="caption" color="text.secondary">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </ListItemSecondaryAction>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}