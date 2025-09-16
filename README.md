# Advanced Cryptocurrency Trading Bot

A comprehensive cryptocurrency trading platform with advanced features including AI analysis, ML-based strategies, backtesting, and multi-exchange support.

## Features

- Live trading with multiple strategies
- Multi-exchange support (Binance, Kraken, Gemini)
- Market scanner with opportunity scoring
- Portfolio management dashboard
- Performance tracking and analytics
- Order management
- Visual strategy builder
- Strategy backtesting
- AI-powered market analysis (Google Gemini)
- Dark/Light theme

## Getting Started

### Prerequisites

- Node.js (v20.x recommended)
- npm (v10 or higher)
- Exchange API keys (Binance, Kraken, Gemini)
- Google Gemini API key (for AI analysis)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. For desktop application development:
   ```
   npm run electron:dev
   ```

### Building for Production

To build a desktop application:

```
npm run electron:dist
```

The packaged application will be available in the `dist` folder.

### Deploying to Vercel (Web Version)

This project can be deployed as a web application on Vercel.

#### Option 1: Connect to Git (Recommended)

1. **Create a Git Repository**: Push your code to GitHub, GitLab, or Bitbucket
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/your-repo-name.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Sign up/in at [vercel.com](https://vercel.com)
   - Click "New Project" and select "Import Git Repository"
   - Select your repository and follow the setup wizard
   - Under "Environment Variables", add your API keys:
     - `REACT_APP_BINANCE_API_KEY`
     - `REACT_APP_BINANCE_API_SECRET`

3. **Automatic Deployments**: Now, whenever you push changes to your repository, Vercel will automatically deploy the latest version.

#### Option 2: Manual Deployment (without Git)

1. **Install Vercel CLI**: `npm install -g vercel`
2. **Deploy from Local Directory**:
   ```bash
   vercel
   ```
3. **Set Environment Variables**:
   ```bash
   vercel env add REACT_APP_BINANCE_API_KEY
   vercel env add REACT_APP_BINANCE_API_SECRET
   ```
4. **Redeploy to Production**:
   ```bash
   vercel --prod
   ```

When using this method, you'll need to run `vercel --prod` each time you want to update your application.

## Usage

1. Enter your API keys in the Settings section
2. Select a trading pair and strategy
3. Use the navigation buttons to switch between different views
4. Enable live trading only when you're ready to execute real trades

## Arbitrage Trading Capabilities

The platform includes a sophisticated arbitrage system that identifies and executes profitable trading opportunities across three distinct strategies:

### 1. Cross-Exchange Arbitrage
- **Mechanism**: Exploits price differences of the same asset between different exchanges (e.g., BTC cheaper on Binance, more expensive on Kraken)
- **Implementation**: Real-time scanning of common pairs across exchanges with configurable profit thresholds
- **Execution**: Simultaneous buy on cheaper exchange and sell on more expensive exchange
- **Risk Controls**: Customizable minimum profit percentage, accounting for fees and slippage

### 2. Triangular Arbitrage
- **Mechanism**: Identifies profitable trading loops within a single exchange (e.g., BTC → ETH → USDT → BTC)
- **Implementation**: Analyzes all possible triangular paths for a selected base asset
- **Execution**: Sequential execution of all legs in the triangular path
- **Example**: Convert 1 BTC to ETH, then ETH to USDT, then USDT back to BTC ending with >1 BTC

### 3. Statistical Arbitrage (Beta)
- **Mechanism**: Mean-reversion strategies on correlated pairs
- **Implementation**: Tracks historical correlation and deviation patterns
- **Execution**: Opens positions when assets deviate from statistical norms, closes when relationship normalizes

### Arbitrage Dashboard Features
- **Real-time Opportunity Scanner**: Continuously monitors markets for profitable opportunities
- **Performance Tracking**: Visual display of historical arbitrage profits
- **Auto-Trading**: Optional automated execution when opportunities exceed specified thresholds
- **Custom Parameters**: Adjustable minimum profit percentage, trade size, and scan interval
- **Manual Override**: Option to manually review and execute individual arbitrage opportunities

### Requirements for Arbitrage Trading
- API keys with trading permissions for all exchanges
- Sufficient balances on all exchanges involved
- Recommended: Start with small position sizes to validate profitability accounting for fees and execution latency

To access the Arbitrage Dashboard, select "Arbitrage" from the main navigation menu.

## How Each Core Feature Works (Internal Overview)

### 1. Live Trading Engine
- Dashboard polls market data (ticker + historical klines).
- Strategy selected (e.g. conservativeConfluence / movingAverageCrossover / mlPredictor) returns a signal: BUY / SELL / HOLD plus metadata.
- If Live Trading toggle is ON and signal differs from last executed:
  1. Position size determined (extend with your RiskManager if added).
  2. placeOrder() (Binance REST) called.
  3. Result logged + notification event dispatched.
- Safety: Only executes once per signal transition (tracked with a ref).

### 2. Market Scanner
- Iterates through symbol list (or subset) → fetches 24h stats + optional mini historical series.
- Computes scores (volatility, volume, momentum etc.).
- Returns ranked list; selecting a symbol routes to trading view.

### 3. Portfolio Dashboard
- Fetches account balances → filters non‑zero.
- For each asset:
  - If USD stable → direct value.
  - Else pulls `ASSETUSDT` price.
- Aggregates into:
  - totalValue
  - allocation%
  - pie chart dataset
- Uses notification system for success/error.

### 4. Order Manager
- Calls openOrders endpoint.
- Renders table with cancel button (DELETE /api/v3/order).
- Auto refresh interval + manual refresh.

### 5. Performance Tracker
- Loads trade history (myTrades).
- Pairs BUY with matching SELL (simple size match) → creates completed round trips.
- Computes:
  - Win rate
  - Profit factor
  - Avg win / loss
  - Cumulative P&L curve
  - Best / worst trade %
- Displays trade table with color-coded outcomes.

### 6. Backtesting (High-Level Pattern)
- Loads historical klines (fixed interval).
- Simulates bar-by-bar:
  - Applies chosen strategy logic.
  - Tracks virtual positions, P&L, equity curve.
- Reports summary stats (extend with sharpe, max drawdown later).

### 7. Strategy Builder (Visual)
- UI constructs rule blocks (e.g. MA fast > MA slow AND RSI < 30).
- Rules serialized to JSON config.
- Engine interprets JSON each evaluation cycle to output a signal.

### 8. Arbitrage Dashboard
- Runs continuous scans of markets for arbitrage opportunities.
- Implements three strategies: cross-exchange, triangular, and statistical arbitrage.
- Calculates real profit potential accounting for exchange fees, slippage, and execution risks.
- Maintains historical performance metrics with visualizations.
- Features auto-trading capability with configurable risk parameters.
- Uses WebSocket connections where available for low-latency price updates.

### 9. Notification System
- Global context holds queue.
- addNotification(message, type) → auto-dismiss after timeout.
- Used by Portfolio, Orders, Trading signals.

### 10. Settings & Persistence
- settingsManager persists JSON in localStorage.
- Auto‑saves on every controlled input change.
- Clear button wipes & reloads.

### 11. Theming
- ThemeContext toggles 'light' / 'dark'; class added at root.
- CSS variables supply colors.

### 12. Error Boundary
- Catches React render/runtime subtree errors.
- Displays recovery panel + reload option.

## ML / AI Strategy (Current & Future)

### Present (Stub)
- mlPredictor strategy uses simple momentum heuristics (priceChangePercent thresholds).
- Returns HOLD if neutral to avoid noise.

### Upgrade Path
1. Collect dataset (klines + engineered features).
2. Train model externally (Python TF/PyTorch).
3. Export to ONNX or TF.js Layers format.
4. Load in app (lazy import):
   - On first use: load model file from /public/models/model.json (web) or local file path (Electron).
5. Preprocess live window (normalize / scale).
6. Run prediction → map logits to signal (e.g. probability(up) > 0.6 → BUY).
7. Add confidence gating (min threshold).
8. Log every inference (timestamp, inputs hash, output) for audit.

### Risk Integration
- Model confidence can scale position size:
  - size = baseSize * clamp(confidence, 0.5–1.5)

## Dynamic Strategy Loading (External / Plugin Concept)

### Goals
- Add new strategies without rebuilding.
- Allow user drop‑in scripts (Electron mode).
- Support JSON rule packs (web safe).

### Approaches
| Mode | Method | Notes |
|------|--------|-------|
| JSON Rule Sets | Interpret conditions (indicators, thresholds) | Already aligned with Strategy Builder. |
| JS Plugin (Electron) | Require/import local JS in /strategies | Node fs access available. |
| Remote Config | Fetch from hosted URL (https) JSON | Keep CORS + signature in mind. |

### Suggested Registry Pattern (Pseudocode)
```js
// strategies/registry.js
const registry = {
  movingAverageCrossover: fnRef1,
  conservativeConfluence: fnRef2,
  // injected dynamically
};
export function registerStrategy(key, handler){ registry[key] = handler; }
export function getStrategy(key){ return registry[key]; }
```

### Loading External JS (Electron Only)
```js
const fs = window.require?.('fs');
const path = window.require?.('path');
const strategiesDir = path.join(process.cwd(), 'strategies');

fs.readdirSync(strategiesDir)
  .filter(f => f.endsWith('.js'))
  .forEach(f => {
    const mod = require(path.join(strategiesDir, f));
    if (mod.key && mod.run) registerStrategy(mod.key, mod.run);
  });
```

### Loading JSON Rules (Web & Electron)
```js
fetch('/strategies.json')
 .then(r=>r.json())
 .then(list => list.forEach(ruleDef => registerStrategy(ruleDef.key, buildInterpreter(ruleDef))));
```

## Packaging & Post-Build Modification

### After Building the .exe
- The bundled app (Electron) is static; JS source is packaged (ASAR).
- To modify logic:
  - Change source → rebuild (`npm run electron:dist`).
- OPTIONAL: Enable external “strategies” folder:
  - Configure Electron not to ASAR that folder.
  - On startup, dynamically load external strategies (no rebuild).

### Quick Rebuild Cycle
```bash
npm run build
npm run electron:dist
```

### One-Click Launch
- Output NSIS installer (Windows) from electron-builder → installs start menu shortcut.
- Auto updates require additional setup (publish config + code signing).

## Recommended Final Hardening

| Area | Action |
|------|--------|
| Logging | Central log service or rotating log file. |
| Rate Limits | Backoff & queue (already partially present in API abstraction). |
| Order Replay Guard | Store last N order hashes to prevent duplicates. |
| Precision Handling | Use exchange filters for stepSize / tickSize rounding. |
| Config Validation | Schema-check strategy JSON before registering. |
| Secrets | Move trading API keys to secure backend (serverless proxy) for web deployment. |
| Model Versioning | Include modelVersion in logs for audit. |

## Full Usage Flow (End User)

1. Launch app (web or desktop).
2. Open Settings → enter Binance (and Kraken if needed) keys.
3. Go to Market Scanner → pick symbol → auto-switch to Trading.
4. Observe signals; keep Live Trading OFF initially.
5. (Optional) Adjust strategy selection.
6. Enable Live Trading when comfortable.
7. Monitor:
   - Portfolio value & allocation
   - Open orders & cancellations
   - Performance metrics for improvement
8. Export / backup logs (add button if not present).
9. Update or drop in new strategy JSON/plugin for extension.

## Troubleshooting & Common Errors

| Symptom | Fix |
|---------|-----|
| SyntaxError in App.js | Remove duplicate trailing JSX / ensure single export. |
| ESLint parser error (@babel/eslint-parser) | `npm i -D eslint-scope @babel/eslint-parser` or add `.env` → `ESLINT_NO_DEV_ERRORS=true`. |
| WebSocket / network throttling | Add exponential backoff & retry; verify API key permissions. |
| Order rejected (LOT_SIZE / PRICE_FILTER) | Apply rounding: quantity = floor(qty / stepSize)*stepSize. |
| CORS failing on exchange private endpoints (web) | Use Vercel serverless proxy route with signing server-side. |
| Model load failure | Check path `/public/models/model.json` exists & served; verify version mismatch. |

## Extending Without Rebuild (Electron Mode)

1. Create `/strategies` folder beside executable (if configured unpacked).
2. Drop file:
```js
// myCustomEdge.js
module.exports.key = 'edgeArb';
module.exports.run = (ctx) => {
  // ctx: { candles, ticker, account, helpers }
  return { signal: 'HOLD', reason: 'Template', confidence: 0.5 };
};
```
3. Restart app → registry auto-includes `edgeArb`.

## Security Notes (Augmented)

- NEVER embed real API keys in a public web deployment.
- For production trading:
  - Use restricted IP whitelisted keys.
  - Disable withdrawal permissions.
  - Log every outbound order (idempotency).
  - Add an emergency “Global Kill Switch” toggle stored outside UI state (e.g., file flag).

## Roadmap (Post-ML Integration)

| Phase | Goal |
|-------|------|
| 1 | Add candle cache + feature pipeline (EMA, RSI, ATR, volume profile). |
| 2 | Train supervised model (classification: up / flat / down). |
| 3 | Confidence-weighted sizing, dynamic stop-loss (ATR x factor). |
| 4 | Regime detection (volatility cluster / trending vs mean-revert). |
| 5 | Multi-model ensemble + fallback to deterministic rules. |
| 6 | Telemetry (performance per strategy version). |

## Final Check List Before “Production”

- [ ] Remove console.log noise
- [ ] Add centralized error logger
- [ ] Test with testnet (Binance testnet keys)
- [ ] Validate rounding logic per symbol filters
- [ ] Simulate network failures (retry paths)
- [ ] Verify strategy hot-swap works (if enabled)
- [ ] Document risk parameters for each strategy

## Updating After Packaging

| Need | Action |
|------|--------|
| Change strategy logic | Edit source → rebuild installer. |
| Add new JSON strategy | Drop into remote URL / local folder (if loader implemented). |
| Patch model | Replace model file + bump modelVersion constant. |

## Disclaimer (Extended)
This tool is for educational purposes. Past performance ≠ future results. Use minimal capital while validating. You are solely responsible for configuration, risk controls, and compliance in your jurisdiction.

### Autonomous Orchestrator (New)
A central service loop (orchestrator) now:
- Pulls market + historical snapshots
- Delegates to strategy registry
- Evaluates risk (size, kill switch, loss cap)
- Emits events (order executed / blocked / errors)
- Supports live toggle & global kill switch
- Exposes status via SystemStatusPanel

Event Flow:
MARKET_SNAPSHOT → STRATEGY_SIGNAL → (Risk Gate) → ORDER_EXECUTED / ORDER_ERROR → HEARTBEAT

Extend:
- Register custom strategies via strategyRegistry
- Add advanced risk rules in riskManager
- Hook external logger on eventBus

### Real Market Data Approach (No Testnet)

This system uses real market data exclusively and avoids Binance testnet completely:

1. **Why Avoid Testnet**:
   - Testnet charts/prices don't reflect real market conditions
   - Testnet trading volume is artificial and unrealistic
   - Testnet execution doesn't mimic real market behavior
   - Strategies performing well on testnet often fail in production

2. **Our Approach - Real Data Only**:
   - All backtesting uses historical production data
   - All signal generation uses real-time market data
   - All executions use real exchange APIs (with small positions)
   - Risk management uses real market depth and liquidity

3. **Real Data Sources**:
   - **Alpha Vantage API**: Professional financial data feed
   - **Twelve Data API**: Enterprise-grade market data
   - **Binance Production API**: Real market data (not testnet)
   - **Historical CSV Files**: Archived real market data

4. **Safe Testing With Real Data**:
   - Start with minimum position sizes (e.g., $10-$50)
   - Use tight stop-losses configured in risk manager
   - Daily loss limits prevent cascading failures
   - Emergency kill switch for immediate system halt

### Risk-Managed Real Trading

For safe real-market trading:

1. **Progressive Position Sizing**:
   - Phase 1: Paper trading with real data (no execution)
   - Phase 2: Micro positions ($10-$50)
   - Phase 3: Small positions ($50-$200)
   - Phase 4: Normal positions (based on account %)

2. **Position Sizing Formula**:
   ```
   position = accountBalance * riskPerTrade * confidence / stopLossDistance
   ```

3. **Maximum Risk Settings**:
   - Max daily drawdown: 2% of account
   - Max position size: 5% of account
   - Max open positions: 3-5 concurrent trades

## Secure Deployment Architecture

For production use, the recommended deployment consists of:

1. **Backend Trading Engine** (Server/Desktop)
   - Core trading logic on secured server
   - Database for storing trades, performance metrics
   - JWT-based authentication system
   - Risk management modules
   - WebSocket server for real-time updates

2. **Web Monitoring Interface** (Mobile/Remote)
   - Lightweight monitoring dashboard
   - Read/controlled access via permission system
   - Cannot modify core trading code or introduce security risks
   - Available at `/web-client/index.html`

3. **Admin Interface** (Local/Protected)
   - Full access to all system features
   - Strategy modification capabilities
   - Risk parameter adjustments
   - Only accessible from authorized IPs

### Authentication & Authorization

The system uses JWT-based authentication with role-based access control:

| Role | Permissions | Suitable For |
|------|-------------|-------------|
| admin | Read, Write, Execute, System | You (system owner) |
| trader | Read, Write, Execute | Trusted associates |
| viewer | Read-only | Remote monitoring |

Example creating a read-only user:
```bash
POST /api/users
Authorization: Bearer <admin_token>
{
  "username": "mobile-monitor",
  "password": "secure-password",
  "role": "viewer"
}
```

### Mobile Monitoring Setup

1. Deploy the backend on your server/desktop machine
2. Host the web client files or access directly from `/web-client/index.html`
3. Connect using server URL and your credentials
4. Monitor live trading status, receive real-time signals

### ML Model Integration

For advanced ML strategies:
1. Train your model in Python (TensorFlow/PyTorch)
2. Export to TensorFlow.js format
3. Place model files in `/public/models/`
4. Select "mlPredictor" strategy

## Automatic Updates & Real-Time Operation

### Application Auto-Updates

1. **Electron Desktop App Auto-Updates**:
   - The system can be configured to check for and apply updates automatically
   - Updates are fetched securely from your specified repository
   - Users are notified when updates are available

   To enable auto-updates, add to `package.json`:
   ```json
   "build": {
     "publish": [{
       "provider": "github",
       "owner": "yourusername",
       "repo": "your-repo-name"
     }]
   }
   ```

2. **Web Version Updates** (on Vercel):
   - Automatic deployment when changes are pushed to connected repository
   - No user action required - refreshing the page applies updates

### Real-Time Data & Trading

1. **Market Data Auto-Refresh**:
   - Price and chart data automatically refreshes (default: every 30 seconds)
   - WebSocket connections maintain live price feeds when available
   - Historical data is cached to reduce API load

2. **Autonomous Trading**:
   - The orchestrator runs continuously once started
   - Signals are automatically generated based on market conditions
   - When Live Trading is enabled, orders execute automatically
   - All actions are logged and available in real-time via WebSocket

3. **Customizing Refresh Rates**:
   - Market data polling interval: `orchestratorState.loopMs` (default: 20000ms)
   - Portfolio refresh: Configurable in settings (default: 60000ms)
   - Order status updates: Auto-refresh every 30 seconds when active

### System Health Monitoring

1. **Heartbeat Mechanism**:
   - The system emits heartbeat events to confirm operation
   - Mobile/web monitoring shows last heartbeat timestamp
   - Automatic reconnection if connection is lost

2. **Error Recovery**:
   - Automatic retry with exponential backoff for API failures
   - Graceful degradation if one data source is unavailable
   - Notifications for persistent errors requiring attention
