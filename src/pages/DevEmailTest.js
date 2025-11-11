
// src/pages/DevEmailTest.jsx
import React, { useState } from 'react';
import { sendDevEmail } from '../api/devEmail';

export default function DevEmailTest() {
  const [to, setTo] = useState('rufusaddanki777@gmail.com');
  const [subject, setSubject] = useState('Hi from React');
  const [message, setMessage] = useState('Test email');
  const [out, setOut] = useState('');

  const go = async (e) => {
    e.preventDefault();
    setOut('Sending...');
    try {
      const res = await sendDevEmail({ to, subject, message });
      setOut(JSON.stringify(res, null, 2));
    } catch (err) {
      setOut(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={go} style={{ padding: 16 }}>
      <div><input value={to} onChange={e=>setTo(e.target.value)} placeholder="to"/></div>
      <div><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="subject"/></div>
      <div><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="message"/></div>
      <button type="submit">Send</button>
      <pre>{out}</pre>
    </form>
  );
}
