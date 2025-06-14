// src/pages/Invoice.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const Invoice = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:5000/api/orders/invoice/${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch order invoice");
        }

        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchInvoice();
  }, [orderId]);

  if (error) return <p>{error}</p>;
  if (!order) return <p>Loading...</p>;

  return (
    <div>
      <h2>Invoice for Order #{order.id}</h2>
      <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</p>
      <p><strong>Customer:</strong> {order.User?.name} ({order.User?.email})</p>
      <p><strong>Vendor:</strong> {order.Vendor?.name}</p>

      <table>
        <thead>
          <tr>
            <th>Menu Item</th>
            <th>Quantity</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {order.MenuItems?.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.OrderItem.quantity}</td>
              <td>{item.price}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Total Amount: ₹{order.totalAmount}</h3>
    </div>
  );
};

export default Invoice;