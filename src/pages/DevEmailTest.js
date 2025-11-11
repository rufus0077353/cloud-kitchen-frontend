
// src/pages/DevEmailTest.jsx
import React, { useState } from "react";
import { postJSON } from "../utils/api";

export default function DevEmailTest() {
  const [to, setTo] = useState("rufusaddanki777@gmail.com");
  const [subject, setSubject] = useState("Hi from React");
  const [message, setMessage] = useState("Test email");
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr(""); setOut(null);
    try {
      const data = await postJSON("/api/dev-email/send", { to, subject, message });
      setOut(data);
    } catch (e) {
      setErr(e.message || "Email send failed");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <input value={to} onChange={e=>setTo(e.target.value)} />
      <input value={subject} onChange={e=>setSubject(e.target.value)} />
      <textarea value={message} onChange={e=>setMessage(e.target.value)} />
      <button onClick={send}>Send</button>
      {err && <pre style={{color:'crimson'}}>Error: {err}</pre>}
      {out && <pre>{JSON.stringify(out, null, 2)}</pre>}
    </div>
  );
}