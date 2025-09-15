import React, { useEffect, useState } from 'react';
import { getBinanceMarketData, getBinanceBalances } from '../binanceApi';
import { getKrakenMarketData, getKrakenBalances } from '../krakenApi';
import { getGeminiMarketData } from '../geminiApi';

const PAIRS_TO_SCAN = ['BTCUSDT', 'ETHUSDT']; // Pairs to check for arbitrage

function ArbitrageDashboard({ binanceApiKey, binanceApiSecret, krakenApiKey, krakenApiSecret, geminiApiKey, geminiApiSecret }) {
  const [opportunities, setOpportunities] = useState([]);
  const [status, setStatus] = useState('Ready to scan for arbitrage.');
  const [lastAction, setLastAction] = useState('None yet.');
  const [binanceBalances, setBinanceBalances] = useState([]);
  const [krakenBalances, setKrakenBalances] = useState([]);

  const handleExecuteArbitrage = (opportunity) => {
    // This is a placeholder for the complex logic of executing a two-legged arbitrage trade.
    // In a real-world scenario, you would need to:
    // 1. Check balances on both exchanges.
    // 2. Calculate the maximum possible trade size.
    // 3. Simultaneously place a BUY order on the cheaper exchange and a SELL order on the more expensive one.
    // 4. Handle partial fills and network errors.
    setLastAction(`EXECUTION DISABLED: Arbitrage execution is high-risk. Logic for '${opportunity.action}' needs to be carefully implemented and tested.`);
  };

  useEffect(() => {
    if (binanceApiKey && krakenApiKey && geminiApiKey) {
      const findArbitrage = async () => {
        setStatus('Scanning for opportunities across Binance, Kraken, and Gemini...');
        // Fetch balances from both exchanges
        getBinanceBalances(binanceApiKey, binanceApiSecret).then(setBinanceBalances);
        getKrakenBalances(krakenApiKey, krakenApiSecret).then(setKrakenBalances);

        const foundOpportunities = [];
        for (const pair of PAIRS_TO_SCAN) {
          const pricePromises = [
            getBinanceMarketData(pair).then(data => ({ exchange: 'Binance', price: data ? parseFloat(data.price) : null })),
            getKrakenMarketData(pair).then(data => ({ exchange: 'Kraken', price: data ? parseFloat(data.price) : null })),
            getGeminiMarketData(pair).then(data => ({ exchange: 'Gemini', price: data ? parseFloat(data.price) : null })),
          ];

          const prices = (await Promise.all(pricePromises)).filter(p => p.price !== null);

          if (prices.length > 1) {
            const min = prices.reduce((prev, curr) => (prev.price < curr.price ? prev : curr));
            const max = prices.reduce((prev, curr) => (prev.price > curr.price ? prev : curr));
            const diff = ((max.price - min.price) / min.price) * 100;

            if (diff > 0.5) { // Profit threshold
              foundOpportunities.push({
                pair,
                buyAt: min.exchange,
                sellAt: max.exchange,
                buyPrice: min.price,
                sellPrice: max.price,
                profit: diff.toFixed(2),
                action: `Buy on ${min.exchange}, Sell on ${max.exchange}`,
              });
            }
          }
        }
        setOpportunities(foundOpportunities);
        setStatus(`Scan complete. Found ${foundOpportunities.length} opportunities.`);
      };

      findArbitrage();
      const interval = setInterval(findArbitrage, 60000); // Rescan every minute
      return () => clearInterval(interval);
    }
  }, [binanceApiKey, krakenApiKey, geminiApiKey]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Arbitrage Bot (Binance vs. Kraken vs. Gemini)</h2>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Last Action:</strong> {lastAction}</p>
      
      <div style={{ display: 'flex', gap: '50px', marginBottom: '20px' }}>
        <section>
          <h3>Binance Balances</h3>
          <ul>{binanceBalances.slice(0, 5).map(b => <li key={b.asset}>{b.asset}: {parseFloat(b.free).toFixed(4)}</li>)}</ul>
        </section>
        <section>
          <h3>Kraken Balances</h3>
          <ul>{krakenBalances.slice(0, 5).map(b => <li key={b.asset}>{b.asset}: {parseFloat(b.free).toFixed(4)}</li>)}</ul>
        </section>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
            <th style={{ textAlign: 'left' }}>Pair</th>
            <th style={{ textAlign: 'left' }}>Buy At (Price)</th>
            <th style={{ textAlign: 'left' }}>Sell At (Price)</th>
            <th style={{ textAlign: 'left' }}>Profit (%)</th>
            <th style={{ textAlign: 'left' }}>Execute</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map(op => (
            <tr key={op.pair + op.buyAt} style={{ backgroundColor: '#d4edda' }}>
              <td>{op.pair}</td>
              <td>{op.buyAt} (${op.buyPrice.toFixed(2)})</td>
              <td>{op.sellAt} (${op.sellPrice.toFixed(2)})</td>
              <td>{op.profit}%</td>
              <td><button onClick={() => handleExecuteArbitrage(op)}>Execute</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ArbitrageDashboard;
