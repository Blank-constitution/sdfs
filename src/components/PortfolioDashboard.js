import React, { useState, useEffect, useCallback } from 'react';
import { getBinanceBalances, getBinanceMarketData } from '../binanceApi';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

function PortfolioDashboard({ binanceApiKey, binanceApiSecret }) {
  const [portfolio, setPortfolio] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPortfolioData = useCallback(async () => {
    if (!binanceApiKey || !binanceApiSecret) {
      setError('Binance API keys are not set.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const balances = await getBinanceBalances(binanceApiKey, binanceApiSecret);
      const assetValues = [];
      let totalValue = 0;

      for (const balance of balances) {
        const asset = balance.asset;
        const totalBalance = parseFloat(balance.free) + parseFloat(balance.locked);

        if (totalBalance > 0) {
          let usdValue = 0;
          if (asset === 'USDT' || asset === 'BUSD' || asset === 'USDC') {
            usdValue = totalBalance;
          } else {
            try {
              // Assume USDT is the quote currency
              const marketData = await getBinanceMarketData(`${asset}USDT`);
              usdValue = totalBalance * parseFloat(marketData.lastPrice);
            } catch (e) {
              // This asset might not have a USDT pair, skip for now
              console.warn(`Could not fetch price for ${asset}USDT`);
            }
          }

          if (usdValue > 1) { // Only include assets worth more than $1
            assetValues.push({ asset, amount: totalBalance, usdValue });
            totalValue += usdValue;
          }
        }
      }

      assetValues.sort((a, b) => b.usdValue - a.usdValue);

      const chartData = {
        labels: assetValues.map(a => a.asset),
        datasets: [
          {
            data: assetValues.map(a => a.usdValue),
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
              '#E7E9ED', '#8A2BE2', '#A52A2A', '#DEB887', '#5F9EA0', '#7FFF00',
            ],
          },
        ],
      };

      setPortfolio({
        totalValue,
        assets: assetValues,
        chartData,
      });

    } catch (err) {
      setError(err.msg || 'Failed to fetch portfolio data.');
    }
    setIsLoading(false);
  }, [binanceApiKey, binanceApiSecret]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Portfolio Overview (Binance)</h2>
      <button onClick={fetchPortfolioData} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh Portfolio'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {isLoading && !portfolio && <p>Loading portfolio...</p>}

      {portfolio && (
        <div style={{ marginTop: 20 }}>
          <h3>Total Estimated Value: ${portfolio.totalValue.toFixed(2)}</h3>
          <div style={{ display: 'flex', gap: '40px', marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <h4>Asset Allocation</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <th style={{ textAlign: 'left' }}>Asset</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Value (USD)</th>
                    <th style={{ textAlign: 'right' }}>Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.assets.map(asset => (
                    <tr key={asset.asset}>
                      <td>{asset.asset}</td>
                      <td style={{ textAlign: 'right' }}>{asset.amount.toFixed(6)}</td>
                      <td style={{ textAlign: 'right' }}>${asset.usdValue.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {((asset.usdValue / portfolio.totalValue) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ width: '300px', height: '300px' }}>
              <Pie data={portfolio.chartData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioDashboard;
