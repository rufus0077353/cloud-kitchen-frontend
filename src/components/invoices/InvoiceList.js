import React, { useEffect, useState } from "react";
import { fetchInvoices, deleteInvoice } from "../../api/invoiceApi";
import {
  Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const InvoiceList = ({ onEdit }) => {
  const [invoices, setInvoices] = useState([]);

  const loadInvoices = async () => {
    const res = await fetchInvoices();
    setInvoices(res.data);
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDelete = async (id) => {
    await deleteInvoice(id);
    loadInvoices();
  };

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>ID</TableCell>
          <TableCell>User</TableCell>
          <TableCell>Total</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>{invoice.id}</TableCell>
            <TableCell>{invoice.userName}</TableCell>
            <TableCell>{invoice.totalAmount}</TableCell>
            <TableCell>
              <Button onClick={() => onEdit(invoice)}>Edit</Button>
              <IconButton onClick={() => handleDelete(invoice.id)}>
                <DeleteIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default InvoiceList;