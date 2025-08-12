
// src/components/ConnectionBar.jsx
import React, { useEffect, useState } from "react";
import { Alert, Collapse, Box, Button } from "@mui/material";
import { socket, refreshSocketAuth } from "../utils/socket";

export default function ConnectionBar() {
  const [online, setOnline] = useState(socket.connected);
  const [show, setShow] = useState(!socket.connected); // show if offline initially

  useEffect(() => {
    const onConnect = () => {
      setOnline(true);
      setShow(true);
      const t = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(t);
    };
    const onDisconnect = () => {
      setOnline(false);
      setShow(true);
    };
    const onError = () => {
      setOnline(false);
      setShow(true);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.on("reconnect_error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("reconnect_error", onError);
    };
  }, []);

  const handleRetry = () => {
    refreshSocketAuth(); // pick up latest token
    try {
      socket.connect();
    } catch {}
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