// src/components/ConnectionBar.jsx
import React, { useEffect, useRef, useState } from "react";
import { Alert, Collapse, Box, Button } from "@mui/material";
import { socket as socketSingleton, connectSocket } from "../utils/socket";

export default function ConnectionBar() {
  // use the existing socket if present; otherwise try to create one lazily
  const sockRef = useRef(socketSingleton || connectSocket?.() || null);

  const [online, setOnline] = useState(Boolean(sockRef.current && sockRef.current.connected));
  const [show, setShow] = useState(!Boolean(sockRef.current && sockRef.current.connected));

  useEffect(() => {
    // if something created/changed the socket later, pick it up
    if (!sockRef.current && typeof connectSocket === "function") {
      sockRef.current = connectSocket();
    }
    const s = sockRef.current;
    if (!s) return;

    let hideTimer = null;

    const onConnect = () => {
      setOnline(true);
      setShow(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setShow(false), 1200);
    };

    const onDisconnect = () => {
      setOnline(false);
      setShow(true);
    };

    const onError = () => {
      setOnline(false);
      setShow(true);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.on("reconnect_error", onError);

    return () => {
      clearTimeout(hideTimer);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
      s.off("reconnect_error", onError);
    };
  }, []);

  const handleRetry = () => {
    // Reconnect without assuming any extra helpers exist
    if (!sockRef.current && typeof connectSocket === "function") {
      sockRef.current = connectSocket();
    } else {
      try {
        sockRef.current?.connect();
      } catch (_) {}
    }
  };

  return (
    <Collapse in={show}>
      <Box sx={{ px: 2, pt: 1 }}>
        {online ? (
          <Alert severity="success" variant="outlined">
            Reconnected to live updates
          </Alert>
        ) : (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            You’re offline from live updates. Trying to reconnect…
          </Alert>
        )}
      </Box>
    </Collapse>
  );
}