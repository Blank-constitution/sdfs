import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import MarketScanner from './components/MarketScanner';
import ArbitrageDashboard from './components/ArbitrageDashboard';
import BacktestingDashboard from './components/BacktestingDashboard';
import StrategyBuilder from './components/StrategyBuilder';
import PortfolioDashboard from './components/PortfolioDashboard';
import OrderManager from './components/OrderManager';
import PerformanceTracker from './components/PerformanceTracker';
import TradingViewChart from './components/TradingViewChart'; // Import the new component
import About from './components/About';
import Layout from './components/Layout';
import { saveSettings, loadSettings, clearSettings } from './settingsManager';
import { useTheme } from './contexts/ThemeContext';
import { SystemProvider } from './contexts/SystemContext';
import './App.css';

const initialSettings = loadSettings();

function App() {
  const { theme, toggleTheme } = useTheme();
  
  const [binanceApiKey, setBinanceApiKey] = useState(initialSettings.binanceApiKey || '');
  const [binanceApiSecret, setBinanceApiSecret] = useState(initialSettings.binanceApiSecret || '');
  const [krakenApiKey, setKrakenApiKey] = useState(initialSettings.krakenApiKey || '');
  const [krakenApiSecret, setKrakenApiSecret] = useState(initialSettings.krakenApiSecret || '');
  const [geminiAiApiKey, setGeminiAiApiKey] = useState(initialSettings.geminiAiApiKey || '');
  const [strategy, setStrategy] = useState(initialSettings.strategy || 'conservativeConfluence');
  const [symbol, setSymbol] = useState(initialSettings.symbol || 'BTCUSDT');
  const [activeView, setActiveView] = useState('trading');

  useEffect(() => {
    const settingsToSave = {
      binanceApiKey,
      binanceApiSecret,
      krakenApiKey,
      krakenApiSecret,
      geminiAiApiKey,
      strategy,
      symbol,
    };
    saveSettings(settingsToSave);
  }, [
    binanceApiKey,
    binanceApiSecret,
    krakenApiKey,
    krakenApiSecret,
    geminiAiApiKey,
    strategy,
    symbol,
  ]);

  const handleSelectSymbolFromScanner = (selectedSymbol) => {
    setSymbol(selectedSymbol);
    setActiveView('trading');
  };

  const views = {
    settings: (
      <div className="settings-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Settings</h2>
          <label>
            Dark Mode
            <input type="checkbox" onChange={toggleTheme} checked={theme === 'dark'} style={{ marginLeft: 5 }}/>
          </label>
        </div>
        <div>
          <strong>Binance:</strong>
          <input
            type="text"
            placeholder="Binance API Key"
            value={binanceApiKey}
            onChange={e => setBinanceApiKey(e.target.value)}
            style={{ marginRight: 10, marginLeft: 5 }}
          />
          <input
            type="password"
            placeholder="Binance API Secret"
            value={binanceApiSecret}
            onChange={e => setBinanceApiSecret(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <strong>Kraken:</strong>&nbsp;&nbsp;
          <input
            type="text"
            placeholder="Kraken API Key"
            value={krakenApiKey}
            onChange={e => setKrakenApiKey(e.target.value)}
            style={{ marginRight: 10 }}
          />
          <input
            type="password"
            placeholder="Kraken API Secret"
            value={krakenApiSecret}
            onChange={e => setKrakenApiSecret(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <strong>Google AI:</strong>
          <input
            type="password"
            placeholder="Gemini AI API Key"
            value={geminiAiApiKey}
            onChange={e => setGeminiAiApiKey(e.target.value)}
            style={{ marginLeft: 5, width: '300px' }}
          />
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: '20px' }}>
          <label>
            Trading Pair (for main bot):&nbsp;
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Select Trading Strategy:&nbsp;
            <select value={strategy} onChange={e => setStrategy(e.target.value)}>
              <option value="conservativeConfluence">Conservative Confluence</option>
              <option value="movingAverageCrossover">Moving Average Crossover</option>
              <option value="mlPredictor">ML Price Predictor</option>
              <option value="custom">Custom (advanced)</option>
            </select>
          </label>
        </div>
        <button onClick={clearSettings} style={{ marginTop: 20, backgroundColor: '#ffc107' }}>
          Clear and Reset All Saved Settings
        </button>
      </div>
    ),
    trading: (
      <Dashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        strategy={strategy}
        symbol={symbol}
        geminiAiApiKey={geminiAiApiKey}
      />
    ),
    portfolio: (
      <PortfolioDashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
      />
    ),
    orders: (
      <OrderManager
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
      />
    ),
    performance: (
      <PerformanceTracker
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
      />
    ),
    scanner: (
      <MarketScanner
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        strategy={strategy}
        onSelectSymbol={handleSelectSymbolFromScanner}
      />
    ),
    arbitrage: (
      <ArbitrageDashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        krakenApiKey={krakenApiKey}
        krakenApiSecret={krakenApiSecret}
      />
    ),
    backtesting: (
      <BacktestingDashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        strategy={strategy}
        symbol={symbol}
      />
    ),
    strategyBuilder: <StrategyBuilder />,
    tradingview: <TradingViewChart symbol={symbol} />, // Add new view
    about: <About />,
  };

  return (
    <div className={`App ${theme}`}>
      <SystemProvider>
        <Layout activeView={activeView} setActiveView={setActiveView}>
          {views[activeView] || views.trading}
        </Layout>
      </SystemProvider>
    </div>
  );
}

export default App;
      <MarketScanner
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        strategy={strategy}
        onSelectSymbol={handleSelectSymbolFromScanner}
      />
    ),
    arbitrage: (
      <ArbitrageDashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        krakenApiKey={krakenApiKey}
        krakenApiSecret={krakenApiSecret}
      />
    ),
    backtesting: (
      <BacktestingDashboard
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        strategy={strategy}
        symbol={symbol}
      />
    ),
    strategyBuilder: (
      <StrategyBuilder
        binanceApiKey={binanceApiKey}
        binanceApiSecret={binanceApiSecret}
        krakenApiKey={krakenApiKey}
        krakenApiSecret={krakenApiSecret}
        geminiAiApiKey={geminiAiApiKey}
      />
    ),
    about: <About />,
  };

  return (
    <div className={`App ${theme}`}>
      <SystemProvider>
        <Layout activeView={activeView} setActiveView={setActiveView}>
          {views[activeView] || views.trading}
        </Layout>
      </SystemProvider>
    </div>
  );
}

export default App;
