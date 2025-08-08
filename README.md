# DeFi Aggregator

A modern React application for DeFi protocol aggregation with comprehensive wallet integration, real-time gas prices, token swapping, and transaction monitoring.

![DeFi Aggregator Interface](screenshot.png)

*DeFiHub - A comprehensive DeFi aggregator with token swapping, lending/borrowing, and portfolio tracking*

## Features

- 🔗 **Wallet Connection**: Connect with MetaMask and other popular wallets via RainbowKit
- 🌐 **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism
- ⛽ **Real-Time Gas Prices**: Live gas price monitoring across multiple networks
- 💰 **Token Swapping**: DEX aggregator integration with 1inch API
- 📊 **Portfolio Tracking**: Real-time token balance monitoring
- 📈 **Transaction History**: Recent activity tracking with blockchain data
- 🏦 **Lending Section**: DeFi lending protocol integration
- 🎨 **Modern UI**: Beautiful interface with gradient designs and responsive layout
- 📱 **Fully Responsive**: Adaptive layout that scales perfectly across all screen sizes
- ⚡ **Fast & Responsive**: Built with React and optimized for performance
- 🧪 **Comprehensive Testing**: Full unit test coverage for all components

## Recent Updates

### 🎯 **Single-Page Application Focus**
- Removed navigation links (Swap, Lending, Derivatives, Portfolio) to focus on core functionality
- Streamlined interface for better user experience
- All features accessible from the main dashboard

### 📱 **Enhanced Responsive Design**
- **Fully Responsive Layout**: Components now scale proportionally with screen size
- **Flexible Grid System**: Three-column layout that adapts to different screen sizes
- **Mobile Optimized**: Perfect experience on desktop, tablet, and mobile devices
- **Proportional Scaling**: Components expand to fill available horizontal space

### 🎨 **UI Improvements**
- Removed dashboard cards (Total Balance, 24H Change, Lending APY, Active Positions) for cleaner interface
- Maintained DashboardCard component for future use
- Enhanced visual hierarchy and spacing

## Tech Stack

- **React 19** - Latest React with modern features
- **Wagmi v2** - React hooks for Ethereum
- **RainbowKit** - Beautiful wallet connection UI
- **Viem** - TypeScript interface for Ethereum
- **Ethers.js** - Complete Ethereum library
- **1inch API** - DEX aggregator for token swaps
- **Jest & Testing Library** - Comprehensive testing framework

## Core Components

### Main Dashboard Components
- **TokenSwap** - DEX aggregator for token swapping with real-time quotes
- **LendingSection** - DeFi lending protocol interface (Compound, Aave)
- **NetworkStatus** - Real-time gas price monitoring across networks
- **YourAssets** - Portfolio tracking with token balances
- **RecentActivity** - Transaction history with blockchain integration

### Infrastructure
- **WalletProvider** - Wagmi and RainbowKit configuration
- **ConnectWalletButton** - Wallet connection UI
- **Header** - Application branding and wallet status
- **DashboardCard** - Reusable card component (available for future use)

## Responsive Layout

The application features a sophisticated responsive design that adapts to any screen size:

### Desktop (1400px+)
- **Three-column layout**: TokenSwap | LendingSection | Sidebar (NetworkStatus, YourAssets, RecentActivity)
- **Equal column widths**: All components scale proportionally
- **Full width utilization**: Components expand to fill available space

### Tablet (768px - 1400px)
- **Two-column layout**: Main content | Sidebar
- **Adaptive sidebar**: Sidebar components arrange horizontally when space allows
- **Optimized spacing**: Reduced gaps for better tablet experience

### Mobile (768px and below)
- **Single-column layout**: All components stack vertically
- **Touch-friendly**: Optimized for mobile interaction
- **Compact design**: Reduced padding and spacing for mobile screens

## Services

- **GasPriceService** - Real-time gas price fetching with exponential backoff
- **TokenBalanceService** - ERC-20 token balance monitoring
- **LendingService** - DeFi lending protocol integration

## Getting Started

### Prerequisites

- Node.js v22.18.0 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd defi-aggregator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional):
```bash
# Copy the example environment file
cp docs/Environment-Setup.md .env.example

# Create your .env file with your API keys
REACT_APP_1INCH_API_KEY=your_1inch_api_key
REACT_APP_ALCHEMY_API_KEY=your_alchemy_api_key
```

4. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner in watch mode
- `npm test -- --watchAll=false` - Runs tests once and exits
- `npm test -- --coverage --watchAll=false` - Runs tests with coverage
- `npm run eject` - Ejects from Create React App (irreversible)

## Testing

The project includes comprehensive unit tests for all components:

### Running Tests

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once
npm test -- --watchAll=false

# Run tests with coverage
npm test -- --coverage --watchAll=false
```

### Test Coverage

- **NetworkStatus** - Gas price fetching and display tests
- **YourAssets** - Token balance monitoring tests
- **RecentActivity** - Transaction history tests
- **TokenSwap** - DEX integration and swap functionality tests
- **LendingSection** - DeFi lending interface tests
- **ConnectWalletButton** - Wallet connection UI tests
- **DashboardCard** - Reusable component tests
- **Header** - Navigation and branding tests

### Test Structure

```
tst/
├── components/
│   ├── NetworkStatus.test.jsx      # Gas price monitoring tests
│   ├── YourAssets.test.jsx         # Portfolio tracking tests
│   ├── RecentActivity.test.jsx     # Transaction history tests
│   ├── TokenSwap.test.jsx          # DEX integration tests
│   ├── LendingSection.test.jsx     # Lending interface tests
│   ├── ConnectWalletButton.test.jsx # Wallet connection tests
│   ├── DashboardCard.test.jsx      # Reusable component tests
│   ├── Header.test.jsx             # Navigation tests
│   ├── WalletProvider.test.jsx     # Provider configuration tests
│   └── WalletConnection.test.jsx   # Wallet connection UI tests
├── App.test.js                     # Main app integration tests
└── setup/                          # Test setup utilities
```

## Project Structure

```
src/
├── components/
│   ├── NetworkStatus.jsx           # Real-time gas price monitoring
│   ├── YourAssets.jsx              # Portfolio tracking
│   ├── RecentActivity.jsx          # Transaction history
│   ├── TokenSwap.jsx               # DEX aggregator interface
│   ├── LendingSection.jsx          # DeFi lending interface
│   ├── ConnectWalletButton.jsx     # Wallet connection UI
│   ├── DashboardCard.jsx           # Reusable card component
│   ├── Header.jsx                  # Application branding
│   ├── WalletProvider.jsx          # Wagmi and RainbowKit setup
│   └── WalletConnection.jsx        # Wallet connection logic
├── services/
│   ├── gasPriceService.js          # Gas price fetching service
│   ├── tokenBalanceService.js      # Token balance monitoring
│   └── lendingService.js           # DeFi lending protocol integration
├── App.js                          # Main application component
├── App.css                         # Application styles with responsive design
├── index.js                        # Application entry point
├── index.css                       # Global styles
└── setupTests.js                   # Jest setup configuration

docs/
├── Environment-Setup.md            # API key setup instructions
├── NetworkStatus.md                # Gas price component documentation
├── YourAssets.md                   # Portfolio tracking documentation
├── RecentActivity.md               # Transaction history documentation
├── TokenSwap.md                    # DEX integration documentation
├── ViemIntegration.md              # Viem integration guide
└── WALLET_SETUP.md                 # Wallet connection setup

tst/
├── components/                     # Component test files
├── setup/                          # Test setup utilities
└── utils/                          # Testing utilities
```

## API Integration

### 1inch DEX Aggregator
- Real-time token swap quotes
- Multi-DEX routing
- Slippage protection
- Transaction execution

### Gas Price APIs
- Multi-network gas price monitoring
- Exponential backoff for rate limiting
- Cached data fallback
- Real-time updates

### Blockchain Data
- ERC-20 token balance monitoring
- Transaction history fetching
- Block data parsing
- Contract interaction

### DeFi Lending Protocols
- Compound protocol integration
- Aave protocol integration
- Supply and borrow functionality
- Interest rate monitoring

## Environment Variables Required
- `REACT_APP_1INCH_API_KEY` - 1inch API key for token swaps
- `REACT_APP_ALCHEMY_API_KEY` - Alchemy API key for blockchain data

## Documentation

- [Environment Setup](./docs/Environment-Setup.md) - API key configuration
- [NetworkStatus](./docs/NetworkStatus.md) - Gas price monitoring
- [YourAssets](./docs/YourAssets.md) - Portfolio tracking
- [RecentActivity](./docs/RecentActivity.md) - Transaction history
- [TokenSwap](./docs/TokenSwap.md) - DEX integration
- [Viem Integration](./docs/ViemIntegration.md) - Blockchain integration
- [Wallet Setup](./docs/WALLET_SETUP.md) - Wallet connection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your new functionality
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License.
