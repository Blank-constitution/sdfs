import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import MarketScanner from './components/MarketScanner';
import ArbitrageDashboard from './components/ArbitrageDashboard';
import BacktestingDashboard from './components/BacktestingDashboard';
import StrategyBuilder from './components/StrategyBuilder';
import PortfolioDashboard from './components/PortfolioDashboard';
import OrderManager from './components/OrderManager';
import PerformanceTracker from './components/PerformanceTracker';
import About from './components/About';
import Layout from './components/Layout';
import { saveSettings, loadSettings, clearSettings } from './settingsManager';
import { useTheme } from './contexts/ThemeContext';
import { SystemProvider, useSystem } from './contexts/SystemContext';
import './App.css';

const initialSettings = loadSettings();

// SECURITY: This function checks if we're in a web deployment context
// where storing API keys is unsafe
const isWebDeployment = () => {
  return !window.electron && 
         window.location.hostname !== 'localhost' && 
         window.location.hostname !== '127.0.0.1';
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const system = useSystem?.(); // Optional chaining as it might be null outside provider
  
  // State for storing API keys - will be empty strings in web deployment
  const [binanceApiKey, setBinanceApiKey] = useState(isWebDeployment() ? '' : (initialSettings.binanceApiKey || ''));
  const [binanceApiSecret, setBinanceApiSecret] = useState(isWebDeployment() ? '' : (initialSettings.binanceApiSecret || ''));
  const [krakenApiKey, setKrakenApiKey] = useState(isWebDeployment() ? '' : (initialSettings.krakenApiKey || ''));
  const [krakenApiSecret, setKrakenApiSecret] = useState(isWebDeployment() ? '' : (initialSettings.krakenApiSecret || ''));
  const [geminiAiApiKey, setGeminiAiApiKey] = useState(isWebDeployment() ? '' : (initialSettings.geminiAiApiKey || ''));
  
  const [strategy, setStrategy] = useState(initialSettings.strategy || 'conservativeConfluence');
  const [symbol, setSymbol] = useState(initialSettings.symbol || 'BTCUSDT');
  const [activeView, setActiveView] = useState('trading');
  
  // Display warning about web security
  const [showSecurityWarning] = useState(isWebDeployment());

  // Effect to save all settings whenever any of them change
  useEffect(() => {
    // SECURITY: Only save API keys in Electron desktop app or local development
    if (isWebDeployment()) {
      const webSafeSettings = { strategy, symbol };
      saveSettings(webSafeSettings);
    } else {
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
    }
    
    // Sync to orchestrator if available
    if (system?.refreshConfig) {
      system.refreshConfig({ 
        symbol, 
        strategy, 
        binanceApiKey, 
        binanceApiSecret, 
        geminiAiApiKey 
      });
    }
  }, [
    binanceApiKey, binanceApiSecret, krakenApiKey, krakenApiSecret,
    geminiAiApiKey, strategy, symbol, system
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
        
        {showSecurityWarning && (
          <div className="security-warning">
            <strong>⚠️ Security Notice:</strong> For web deployments, API keys should be set on the server.
            Direct API key entry is disabled for security reasons. Please use the desktop app or contact
            your administrator to configure API access.
          </div>
        )}
        
        {!showSecurityWarning && (
          <>
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
          </>
        )}
        
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
