import React, { useState, useEffect, useCallback } from 'react';
import { getOpenOrders, cancelOrder } from '../binanceApi';

function OrderManager({ binanceApiKey, binanceApiSecret }) {
  const [openOrders, setOpenOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!binanceApiKey || !binanceApiSecret) {
      setError('Binance API keys are not set.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const orders = await getOpenOrders(binanceApiKey, binanceApiSecret);
      setOpenOrders(orders);
    } catch (err) {
      setError(err.msg || 'Failed to fetch open orders.');
    }
    setIsLoading(false);
  }, [binanceApiKey, binanceApiSecret]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCancelOrder = async (symbol, orderId) => {
    setStatusMessage(`Cancelling order ${orderId}...`);
    try {
      await cancelOrder(binanceApiKey, binanceApiSecret, symbol, orderId);
      setStatusMessage(`Order ${orderId} cancelled successfully.`);
      // Refresh orders immediately after cancellation
      fetchOrders();
    } catch (err) {
      setStatusMessage(`Error cancelling order ${orderId}: ${err.msg}`);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Live Order Management (Binance)</h2>
      <button onClick={fetchOrders} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh Orders'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {statusMessage && <p style={{ color: 'blue' }}>{statusMessage}</p>}
      
      <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
            <th style={{ textAlign: 'left' }}>Symbol</th>
            <th style={{ textAlign: 'left' }}>Side</th>
            <th style={{ textAlign: 'left' }}>Type</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th style={{ textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {openOrders.length > 0 ? (
            openOrders.map(order => (
              <tr key={order.orderId}>
                <td>{order.symbol}</td>
                <td style={{ color: order.side === 'BUY' ? 'green' : 'red' }}>{order.side}</td>
                <td>{order.type}</td>
                <td style={{ textAlign: 'right' }}>{parseFloat(order.price).toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{parseFloat(order.origQty).toFixed(5)}</td>
                <td style={{ textAlign: 'right' }}>{(parseFloat(order.price) * parseFloat(order.origQty)).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => handleCancelOrder(order.symbol, order.orderId)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>
                {isLoading ? 'Loading orders...' : 'No open orders found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OrderManager;
