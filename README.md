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

## Security Notes

- API keys are stored locally in your browser's localStorage
- Keys with trading permissions should be used with caution
- Consider using API keys with read-only access for testing

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

Trading cryptocurrency involves significant risk. This software is provided "as is" without warranty of any kind. Use at your own risk.
