import React from 'react';
import '../App.css'; // We'll use the main CSS file for layout styles

const Layout = ({ children, activeView, setActiveView }) => {
  const menuItems = [
    { id: 'trading', label: 'Trading Bot' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'orders', label: 'Order Manager' },
    { id: 'performance', label: 'Performance' },
    { id: 'scanner', label: 'Market Scanner' },
    { id: 'strategyBuilder', label: 'Strategy Builder' },
    { id: 'backtesting', label: 'Backtesting' },
    { id: 'arbitrage', label: 'Arbitrage Bot' },
    { id: 'settings', label: 'Settings' },
    { id: 'about', label: 'About' },
    { id: 'tradingview', label: 'Chart' }, // TradingView chart button
  ];

  return (
    <div className="app-layout">
      <div className="sidebar">
        <h1 className="sidebar-header">Trading Bot</h1>
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-button ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
