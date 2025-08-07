# DeFi Aggregator

A modern React application for DeFi protocol aggregation with wallet connection functionality.

## Features

- 🔗 **Wallet Connection**: Connect with MetaMask and other popular wallets
- 🌐 **Multi-Chain Support**: Ethereum, Polygon, Optimism, Arbitrum, Base, and Sepolia
- 🎨 **Modern UI**: Beautiful interface with RainbowKit components
- ⚡ **Fast & Responsive**: Built with React and optimized for performance
- 🧪 **Comprehensive Testing**: Full unit test coverage for all components

## Tech Stack

- **React 19** - Latest React with modern features
- **Wagmi v2** - React hooks for Ethereum
- **RainbowKit** - Beautiful wallet connection UI
- **Viem** - TypeScript interface for Ethereum
- **Ethers** - Complete Ethereum library
- **Jest & Testing Library** - Comprehensive testing framework

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

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner in watch mode
- `npm test -- --watchAll=false` - Runs tests once and exits
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

- **WalletProvider** - Tests provider configuration and setup
- **WalletConnection** - Tests wallet connection states and UI
- **App** - Tests main application integration

### Test Structure

```
src/
├── components/
│   ├── WalletProvider.test.jsx    # Provider configuration tests
│   └── WalletConnection.test.jsx  # Wallet connection UI tests
├── App.test.js                    # Main app integration tests
├── test-utils.js                  # Testing utilities and helpers
└── setupTests.js                  # Jest configuration
```

## Project Structure

```
src/
├── components/
│   ├── WalletProvider.jsx    # Wagmi and RainbowKit configuration
│   └── WalletConnection.jsx  # Wallet connection UI component
├── App.js                    # Main application component
├── App.css                   # Application styles
├── index.js                  # Application entry point
├── index.css                 # Global styles
├── test-utils.js             # Testing utilities
└── setupTests.js             # Jest setup configuration
```

## Wallet Setup

For detailed wallet connection setup instructions, see [WALLET_SETUP.md](./WALLET_SETUP.md).

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
