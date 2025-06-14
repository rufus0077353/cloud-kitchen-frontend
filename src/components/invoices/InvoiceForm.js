import React, { useState, useEffect } from "react";
import { TextField, Button } from "@mui/material";

const InvoiceForm = ({ invoice, onSave }) => {
  const [formData, setFormData] = useState({
    userId: "",
    totalAmount: ""
  });

  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    }
  }, [invoice]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextField
        name="userId"
        label="User ID"
        value={formData.userId}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <TextField
        name="totalAmount"
        label="Total Amount"
        value={formData.totalAmount}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <Button type="submit" variant="contained" color="primary">Save</Button>
    </form>
  );
};

export default InvoiceForm;
