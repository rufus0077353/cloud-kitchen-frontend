import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, TableHead, TableRow, TableCell, TableBody, Button, Typography } from '@mui/material';
import { toast } from 'react-toastify';

const VendorOrders = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get('/api/vendor/orders'); // Make sure auth token is attached
      setOrders(data.orders);
    } catch (err) {
      toast.error('Failed to fetch orders');
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.patch(`/api/orders/${orderId}`, { status });
      toast.success('Status updated');
      fetchOrders(); // Refresh orders
    } catch {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <>
      <Typography variant="h5" gutterBottom>Vendor Orders</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Order ID</TableCell>
            <TableCell>Items</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map(order => (
            <TableRow key={order.id}>
              <TableCell>{order.id}</TableCell>
              <TableCell>
                {order.OrderItems.map(item => (
                  <div key={item.id}>
                    {item.MenuItem?.name} × {item.quantity}
                  </div>
                ))}
              </TableCell>
              <TableCell>{order.status}</TableCell>
              <TableCell>
                {order.status === 'pending' && (
                  <>
                    <Button onClick={() => updateStatus(order.id, 'accepted')}> Accept </Button>
                    <Button onClick={() => updateStatus(order.id, 'rejected')} color="error"> Reject </Button>
                  </>
                )}
                {order.status === 'accepted' && (
                  <Button onClick={() => updateStatus(order.id, 'ready')}>Mark Ready</Button>
                )}
                {order.status === 'ready' && (
                  <Button onClick={() => updateStatus(order.id, 'delivered')}> Mark Delivered </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};

export default VendorOrders;